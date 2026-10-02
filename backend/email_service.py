"""
Email sending module via Emergent-managed Resend.
Includes guardrail gate (G2+G3 structural checks).
"""
import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()
logger = logging.getLogger(__name__)

# Hardcoded constant — never read from env
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Conactivos RRHH")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "https://conactivos.com.co").rstrip("/")


# ---------------- Guardrail Gate ----------------

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


# ---------------- Core Send Function ----------------

async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not configured; skipping email send")
        return None
    _assert_safe_email(subject, html)
    payload = {
        "to": [to],
        "subject": subject,
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return None


# ---------------- Templates ----------------

_WRAPPER = """
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;font-family:Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:560px;">
      <tr><td style="background:#122c2a;padding:20px 24px;">
        <h1 style="margin:0;color:#b68a2e;font-size:20px;font-weight:800;letter-spacing:-0.5px;">{brand}</h1>
      </td></tr>
      <tr><td style="padding:28px 24px;color:#1f2937;font-size:14px;line-height:1.6;">
        {body}
      </td></tr>
      <tr><td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;">
        Enviado por {brand}. Nunca te pedimos tu contraseña o datos bancarios por correo.
      </td></tr>
    </table>
  </td></tr>
</table>
"""


def _wrap(body_html: str) -> str:
    return _WRAPPER.format(brand=escape(EMAIL_FROM_NAME), body=body_html)


TYPE_LABELS = {"vacation": "Vacaciones", "medical": "Cita médica", "normal": "Permiso"}


def tpl_leave_created(employee_name: str, leave_type: str, start_date: str, end_date: str, reason: str) -> tuple[str, str]:
    subject = f"Nueva solicitud de {TYPE_LABELS.get(leave_type, 'permiso').lower()} — {employee_name}"
    body = f"""
      <p style="margin:0 0 12px;font-size:16px;color:#122c2a;"><strong>Nueva solicitud por aprobar</strong></p>
      <p>Hola, {escape(employee_name)} acaba de enviar una solicitud:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;">Tipo</td>
            <td style="padding:10px 14px;color:#122c2a;font-weight:600;">{escape(TYPE_LABELS.get(leave_type, leave_type))}</td></tr>
        <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;">Fechas</td>
            <td style="padding:10px 14px;color:#122c2a;font-weight:600;">{escape(start_date)} → {escape(end_date)}</td></tr>
        <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;">Motivo</td>
            <td style="padding:10px 14px;color:#122c2a;">{escape(reason or '—')}</td></tr>
      </table>
      <p>Entra a la app para aprobar o rechazar la solicitud.</p>
    """
    return subject, _wrap(body)


def tpl_leave_decision(employee_name: str, leave_type: str, status: str, start_date: str, end_date: str, admin_name: str) -> tuple[str, str]:
    approved = status == "approved"
    verb = "aprobada" if approved else "rechazada"
    color = "#10b981" if approved else "#dc2626"
    emoji = "✅" if approved else "❌"
    subject = f"{emoji} Tu solicitud fue {verb}"
    body = f"""
      <p style="margin:0 0 12px;font-size:16px;color:#122c2a;"><strong>Hola {escape(employee_name)},</strong></p>
      <p>Tu solicitud de <strong>{escape(TYPE_LABELS.get(leave_type, leave_type).lower())}</strong> del
         <strong>{escape(start_date)}</strong> al <strong>{escape(end_date)}</strong> fue
         <strong style="color:{color};">{verb}</strong> por {escape(admin_name)}.</p>
      <p>Puedes ver los detalles completos en la app.</p>
    """
    return subject, _wrap(body)


def tpl_password_reset(user_name: str, temp_password: str) -> tuple[str, str]:
    subject = "Tu contraseña temporal"
    body = f"""
      <p style="margin:0 0 12px;font-size:16px;color:#122c2a;"><strong>Hola {escape(user_name)},</strong></p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Te generamos una
         contraseña temporal para que puedas ingresar y crear una nueva:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;">
        <tr><td align="center">
          <div style="display:inline-block;background:#122c2a;color:#b68a2e;padding:16px 28px;
                      border-radius:12px;font-family:'Courier New',monospace;font-size:22px;
                      font-weight:800;letter-spacing:2px;">
            {escape(temp_password)}
          </div>
        </td></tr>
      </table>
      <p>Inicia sesión con esta contraseña temporal. Al entrar, la app te pedirá crear una
         contraseña nueva y permanente.</p>
      <p style="font-size:12px;color:#6b7280;">Por tu seguridad, esta contraseña temporal
         solo puede usarse una vez y debe cambiarse en el próximo inicio de sesión. Si no
         solicitaste este cambio, contacta a tu administrador.</p>
    """
    return subject, _wrap(body)
