"""
Backend tests for GET /api/leave-requests/export (xlsx|pdf) and the Likes
notifier integration (kudo-type notifications).

Covers the review_request:
- admin downloads everyone's / employee only own
- filters: date range (overlap: end_date>=start AND start_date<=end), type, status
- auth via Bearer or ?token=; invalid params -> 400; missing auth -> 401
- correct content-type & Content-Disposition attachment filename
- xlsx parsable with header row at row 4
- POST /api/kudos -> recipient gets 'kudo' notifications
"""
import io
import os
import re
from datetime import datetime, timedelta

import pytest
import requests
from openpyxl import load_workbook

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not set")

ADMIN_EMAIL = "admin1@conactivos.com"
ADMIN_PWD = "admin123"
EMP_EMAIL = "juan.perez@conactivos.com"
EMP_PWD = "employee123"


# ---------- fixtures ---------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PWD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def employee_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": EMP_EMAIL, "password": EMP_PWD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_user(admin_token):
    r = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def employee_user(employee_token):
    r = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {employee_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _get(token=None, use_query=False, **params):
    headers = {}
    if token and not use_query:
        headers["Authorization"] = f"Bearer {token}"
    if token and use_query:
        params["token"] = token
    return requests.get(
        f"{BASE_URL}/api/leave-requests/export", headers=headers, params=params, timeout=60
    )


# ---------- auth -------------------------------------------------------------
class TestExportAuth:
    def test_no_auth_401(self):
        r = _get()
        assert r.status_code == 401

    def test_bearer_auth_200(self, admin_token):
        r = _get(token=admin_token, format="xlsx")
        assert r.status_code == 200

    def test_query_token_auth_200(self, admin_token):
        r = _get(token=admin_token, use_query=True, format="xlsx")
        assert r.status_code == 200


# ---------- content-type / disposition --------------------------------------
class TestResponseHeaders:
    def test_xlsx_headers(self, admin_token):
        r = _get(token=admin_token, format="xlsx")
        assert r.status_code == 200
        assert (
            r.headers.get("content-type", "").split(";")[0]
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".xlsx" in cd
        m = re.search(r'filename="([^"]+)"', cd)
        assert m and m.group(1).endswith(".xlsx")

    def test_pdf_headers(self, admin_token):
        r = _get(token=admin_token, format="pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").split(";")[0] == "application/pdf"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".pdf" in cd
        # body must look like a PDF
        assert r.content[:4] == b"%PDF"

    def test_xlsx_scope_filename_admin(self, admin_token):
        r = _get(token=admin_token, format="xlsx")
        cd = r.headers.get("content-disposition", "")
        assert "todos" in cd  # scope = 'todos' for admins

    def test_xlsx_scope_filename_employee(self, employee_token):
        r = _get(token=employee_token, format="xlsx")
        cd = r.headers.get("content-disposition", "")
        assert "juan" in cd.lower()  # scope = first name lowercase for employees


# ---------- xlsx structure ---------------------------------------------------
class TestXlsxStructure:
    def test_header_row_at_row_4(self, admin_token):
        r = _get(token=admin_token, format="xlsx")
        assert r.status_code == 200
        wb = load_workbook(io.BytesIO(r.content))
        ws = wb.active
        headers = [ws.cell(row=4, column=i).value for i in range(1, 10)]
        assert headers == [
            "Empleado", "Tipo", "Desde", "Hasta", "Estado",
            "Motivo", "Comprobante", "Aprobado por", "Creada",
        ]

    def test_xlsx_contains_rows_for_admin(self, admin_token):
        r = _get(token=admin_token, format="xlsx")
        wb = load_workbook(io.BytesIO(r.content))
        ws = wb.active
        # at least one data row below header (row 5+)
        assert ws.cell(row=5, column=1).value is not None, "admin export should have >=1 novedad"


# ---------- scope: admin vs employee ----------------------------------------
class TestScope:
    def test_admin_sees_more_than_employee(self, admin_token, employee_token, admin_user, employee_user):
        a = _get(token=admin_token, format="xlsx")
        e = _get(token=employee_token, format="xlsx")
        wa = load_workbook(io.BytesIO(a.content)).active
        we = load_workbook(io.BytesIO(e.content)).active
        admin_count = sum(1 for row in wa.iter_rows(min_row=5, values_only=True) if row[0])
        emp_count = sum(1 for row in we.iter_rows(min_row=5, values_only=True) if row[0])
        assert admin_count >= emp_count

    def test_employee_only_own_rows(self, employee_token, employee_user):
        r = _get(token=employee_token, format="xlsx")
        ws = load_workbook(io.BytesIO(r.content)).active
        names = {row[0] for row in ws.iter_rows(min_row=5, values_only=True) if row[0]}
        if names:
            assert names == {employee_user["name"]}, f"employee got other users' rows: {names}"


# ---------- filters: type / status / date -----------------------------------
class TestFilters:
    def test_invalid_type_400(self, admin_token):
        r = _get(token=admin_token, format="xlsx", type="bogus")
        assert r.status_code == 400

    def test_invalid_status_400(self, admin_token):
        r = _get(token=admin_token, format="xlsx", status="bogus")
        assert r.status_code == 400

    def test_invalid_date_400(self, admin_token):
        r = _get(token=admin_token, format="xlsx", start="2026/01/01")
        assert r.status_code == 400

    def test_type_filter(self, admin_token):
        r = _get(token=admin_token, format="xlsx", type="telework")
        ws = load_workbook(io.BytesIO(r.content)).active
        types = {row[1] for row in ws.iter_rows(min_row=5, values_only=True) if row[1]}
        if types:
            assert types == {"Teletrabajo"}, f"type filter leaked: {types}"

    def test_status_filter_approved(self, admin_token):
        r = _get(token=admin_token, format="xlsx", status="approved")
        ws = load_workbook(io.BytesIO(r.content)).active
        statuses = {row[4] for row in ws.iter_rows(min_row=5, values_only=True) if row[4]}
        if statuses:
            assert statuses == {"Aprobada"}, f"status filter leaked: {statuses}"

    def test_date_overlap_logic(self, admin_token):
        """Overlap: end_date >= start AND start_date <= end — rows outside must be excluded."""
        start = "2026-10-01"
        end = "2026-10-31"
        r = _get(token=admin_token, format="xlsx", start=start, end=end)
        ws = load_workbook(io.BytesIO(r.content)).active
        for row in ws.iter_rows(min_row=5, values_only=True):
            if not row[0]:
                continue
            s, e = row[2], row[3]
            # must overlap [start, end]
            assert str(e) >= start, f"row ends before window: {row}"
            assert str(s) <= end, f"row starts after window: {row}"

    def test_combined_filters_pdf(self, admin_token):
        r = _get(token=admin_token, format="pdf", type="vacation", status="pending",
                 start="2026-01-01", end="2026-12-31")
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"


# ---------- Likes notifier (backend integration) ----------------------------
class TestKudoNotifications:
    def test_kudo_creates_notification_for_recipient(self, admin_token, employee_token, employee_user):
        # Pre-count unread kudo notifications for juan
        before = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {employee_token}"},
            timeout=20,
        ).json()
        before_count = sum(1 for n in before if n.get("type") == "kudo")

        payload = {
            "to_user_id": employee_user["_id"],
            "message": "TEST_ kudo notification backend verification",
            "category": "teamwork",
        }
        r = requests.post(
            f"{BASE_URL}/api/kudos",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload,
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text

        after = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {employee_token}"},
            timeout=20,
        ).json()
        kudos = [n for n in after if n.get("type") == "kudo"]
        assert len(kudos) == before_count + 1, "no new kudo notification for recipient"
        latest = kudos[0]
        assert latest.get("title") and "Like" in latest["title"]
        assert "like" in latest.get("message", "").lower()
