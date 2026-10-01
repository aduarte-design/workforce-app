from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta
from bson import ObjectId
import bcrypt
from email_service import (
    send_email,
    tpl_leave_created,
    tpl_leave_decision,
    tpl_password_reset,
    APP_PUBLIC_URL,
)
import secrets as _secrets
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'conactivos-secret-key-2026')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    password: str
    name: str
    position: str
    profile_photo: Optional[str] = None  # base64
    phone: Optional[str] = None
    role: Literal["admin", "employee"] = "employee"
    birthdate: Optional[str] = None  # YYYY-MM-DD
    hire_date: Optional[str] = None
    is_employee_of_month: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: str
    name: str
    position: str
    profile_photo: Optional[str] = None
    phone: Optional[str] = None
    role: str
    birthdate: Optional[str] = None
    hire_date: Optional[str] = None
    is_employee_of_month: bool = False

    class Config:
        populate_by_name = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    position: str
    phone: Optional[str] = None
    role: Literal["admin", "employee"] = "employee"
    birthdate: Optional[str] = None
    hire_date: Optional[str] = None
    profile_photo: Optional[str] = None

class LeaveRequest(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    user_name: Optional[str] = None
    type: Literal["vacation", "medical", "normal"]
    start_date: str
    end_date: str
    reason: str
    status: Literal["pending", "approved", "rejected"] = "pending"
    proof_document: Optional[str] = None  # base64
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class LeaveRequestCreate(BaseModel):
    type: Literal["vacation", "medical", "normal"]
    start_date: str
    end_date: str
    reason: str
    proof_document: Optional[str] = None

class LeaveRequestApprove(BaseModel):
    status: Literal["approved", "rejected"]

class Event(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    title: str
    description: Optional[str] = None
    date: str
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: str

class CommercialGoal(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    month: int
    year: int
    goal_amount: float
    current_amount: float = 0.0
    percentage: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CommercialGoalUpdate(BaseModel):
    goal_amount: Optional[float] = None
    current_amount: Optional[float] = None

class Capsule(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    date: str
    topic: str
    responsible_employee_id: str
    responsible_employee_name: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class CapsuleCreate(BaseModel):
    date: str
    topic: str
    responsible_employee_id: str
    description: Optional[str] = None

class Kudo(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    from_user_id: str
    from_user_name: str
    to_user_id: str
    to_user_name: str
    message: str
    category: Literal["teamwork", "innovation", "leadership", "excellence", "helpful"]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class KudoCreate(BaseModel):
    to_user_id: str
    message: str
    category: Literal["teamwork", "innovation", "leadership", "excellence", "helpful"]

class Notification(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    title: str
    message: str
    type: str
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        user["_id"] = str(user["_id"])
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserRegister, credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Check auth: only admins can create users (unless bootstrap - no users exist)
    total_users = await db.users.count_documents({})
    if total_users > 0:
        # Require admin auth
        try:
            token = credentials.credentials
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            current_user = await db.users.find_one({"_id": ObjectId(user_id)})
            if not current_user or current_user.get("role") != "admin":
                raise HTTPException(status_code=403, detail="Solo administradores pueden crear empleados")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Autenticación requerida")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Check admin limit (max 3 admins)
    if user_data.role == "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count >= 3:
            raise HTTPException(status_code=400, detail="Máximo 3 administradores permitidos")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password"] = hashed_password
    user_dict["created_at"] = datetime.utcnow()
    user_dict["is_employee_of_month"] = False
    
    result = await db.users.insert_one(user_dict)
    
    # Create token for the new user
    token = create_access_token({"sub": str(result.inserted_id)})
    
    return {
        "token": token,
        "user": {
            "_id": str(result.inserted_id),
            "email": user_data.email,
            "name": user_data.name,
            "role": user_data.role
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": str(user["_id"])})
    
    return {
        "token": token,
        "user": {
            "_id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }

class GoogleSessionRequest(BaseModel):
    session_id: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


@api_router.post("/auth/password-reset/request")
async def password_reset_request(payload: PasswordResetRequest):
    """Send a password-reset email if the user exists.
    Always returns 200 to avoid leaking which emails are registered.
    """
    user = await db.users.find_one({"email": payload.email})
    if user:
        token = _secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": str(user["_id"]),
            "email": user["email"],
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "used": False,
            "created_at": datetime.utcnow(),
        })
        reset_url = f"{APP_PUBLIC_URL}/reset-password?token={token}"
        try:
            subject, html = tpl_password_reset(user_name=user["name"], reset_url=reset_url)
            await send_email(to=user["email"], subject=subject, html=html)
        except Exception as _e:
            logger.warning(f"Failed sending password-reset email: {_e}")
    return {"message": "Si el correo está registrado, enviaremos instrucciones para restablecer la contraseña."}


@api_router.post("/auth/password-reset/confirm")
async def password_reset_confirm(payload: PasswordResetConfirm):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    token_doc = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Token inválido o ya usado")
    if token_doc["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Solicita uno nuevo.")

    hashed = hash_password(payload.new_password)
    await db.users.update_one(
        {"_id": ObjectId(token_doc["user_id"])},
        {"$set": {"password": hashed}},
    )
    await db.password_reset_tokens.update_one(
        {"_id": token_doc["_id"]},
        {"$set": {"used": True, "used_at": datetime.utcnow()}},
    )
    return {"message": "Contraseña restablecida correctamente"}


@api_router.post("/auth/session")
async def google_session(request: GoogleSessionRequest):
    """Exchange Emergent session_id for a JWT token (Google Auth)"""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Sesión inválida o expirada")
            
            google_data = response.json()
            email = google_data.get("email")
            name = google_data.get("name")
            picture = google_data.get("picture")
            
            if not email:
                raise HTTPException(status_code=401, detail="No se pudo obtener el correo de Google")
            
            # Look up user by email - only allow existing users
            user = await db.users.find_one({"email": email})
            if not user:
                raise HTTPException(
                    status_code=403,
                    detail="Tu correo no está registrado. Contacta al administrador para crear tu cuenta."
                )
            
            # Update profile photo if we don't have one and Google has one
            if not user.get("profile_photo") and picture:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"profile_photo": picture}}
                )
                user["profile_photo"] = picture
            
            # Generate JWT
            token = create_access_token({"sub": str(user["_id"])})
            
            return {
                "token": token,
                "user": {
                    "_id": str(user["_id"]),
                    "email": user["email"],
                    "name": user["name"],
                    "role": user["role"]
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error autenticando con Google: {str(e)}")

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== USER ROUTES ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find().to_list(1000)
    for user in users:
        user["_id"] = str(user["_id"])
        user.pop("password", None)
    return users

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    # Users can only update themselves unless they're admin
    if current_user["role"] != "admin" and current_user["_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Don't allow password or role updates through this endpoint
    updates.pop("password", None)
    updates.pop("role", None)
    updates.pop("_id", None)
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}


@api_router.get("/users/{user_id}/export-pdf")
async def export_user_pdf(user_id: str, current_user: dict = Depends(require_admin)):
    """Admin-only. Returns a PDF with full employee data: profile, leave history, likes received/sent."""
    from fastapi.responses import Response as FastAPIResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    )
    import io

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    leaves = await db.leave_requests.find({"user_id": user_id}).sort("start_date", -1).to_list(500)
    kudos_received = await db.kudos.find({"to_user_id": user_id}).sort("created_at", -1).to_list(500)
    kudos_sent = await db.kudos.find({"from_user_id": user_id}).sort("created_at", -1).to_list(500)

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    GREEN = colors.HexColor("#122c2a")
    GOLD = colors.HexColor("#b68a2e")
    GRAY = colors.HexColor("#6b7280")

    title_style = ParagraphStyle("TitleGreen", parent=styles["Heading1"], textColor=GREEN, fontSize=20, spaceAfter=4)
    sub_style = ParagraphStyle("Sub", parent=styles["Normal"], textColor=GRAY, fontSize=10, spaceAfter=10)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], textColor=GOLD, fontSize=14, spaceAfter=6, spaceBefore=10)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14)

    elements = []

    # Header
    elements.append(Paragraph("Expediente de Empleado", title_style))
    elements.append(Paragraph("Conactivos — Departamento de Recursos Humanos", sub_style))

    # Profile table
    elements.append(Paragraph("Datos Personales", h2_style))
    role_label = "Administrador" if user.get("role") == "admin" else "Empleado"
    profile_rows = [
        ["Nombre completo", str(user.get("name", "—"))],
        ["Correo", str(user.get("email", "—"))],
        ["Cargo", str(user.get("position", "—"))],
        ["Rol", role_label],
        ["Teléfono", str(user.get("phone") or "—")],
        ["Fecha de nacimiento", str(user.get("birthdate") or "—")],
        ["Fecha de ingreso", str(user.get("hire_date") or "—")],
        ["Empleado del mes", "Sí" if user.get("is_employee_of_month") else "No"],
        ["ID interno", str(user.get("_id"))],
    ]
    t = Table(profile_rows, colWidths=[50 * mm, 110 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f9fafb")),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (1, 0), (1, -1), [colors.white, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t)

    # Leave history
    elements.append(Paragraph(f"Historial de Permisos y Ausencias ({len(leaves)})", h2_style))
    if not leaves:
        elements.append(Paragraph("<i>Sin registros de permisos.</i>", body_style))
    else:
        rows = [["Tipo", "Desde", "Hasta", "Estado", "Motivo"]]
        type_map = {"vacation": "Vacaciones", "medical": "Cita médica", "normal": "Permiso"}
        status_map = {"pending": "Pendiente", "approved": "Aprobada", "rejected": "Rechazada"}
        for lv in leaves:
            rows.append([
                type_map.get(lv.get("type"), lv.get("type", "—")),
                str(lv.get("start_date", "—")),
                str(lv.get("end_date", "—")),
                status_map.get(lv.get("status"), lv.get("status", "—")),
                Paragraph(escape_pdf(str(lv.get("reason", "") or "—")), body_style),
            ])
        lt = Table(rows, colWidths=[25 * mm, 25 * mm, 25 * mm, 25 * mm, 60 * mm], repeatRows=1)
        lt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(lt)

    # Kudos received
    elements.append(Paragraph(f"Likes Recibidos ({len(kudos_received)})", h2_style))
    if not kudos_received:
        elements.append(Paragraph("<i>Aún no ha recibido likes.</i>", body_style))
    else:
        rows = [["De", "Categoría", "Mensaje", "Fecha"]]
        for k in kudos_received:
            created = k.get("created_at")
            date_str = created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else str(created)[:10]
            rows.append([
                str(k.get("from_user_name", "—")),
                str(k.get("category", "—")),
                Paragraph(escape_pdf(str(k.get("message", "—"))), body_style),
                date_str,
            ])
        kt = Table(rows, colWidths=[35 * mm, 25 * mm, 75 * mm, 25 * mm], repeatRows=1)
        kt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(kt)

    # Kudos sent
    elements.append(Paragraph(f"Likes Enviados ({len(kudos_sent)})", h2_style))
    if not kudos_sent:
        elements.append(Paragraph("<i>No ha enviado likes.</i>", body_style))
    else:
        rows = [["Para", "Categoría", "Mensaje", "Fecha"]]
        for k in kudos_sent:
            created = k.get("created_at")
            date_str = created.strftime("%Y-%m-%d") if hasattr(created, "strftime") else str(created)[:10]
            rows.append([
                str(k.get("to_user_name", "—")),
                str(k.get("category", "—")),
                Paragraph(escape_pdf(str(k.get("message", "—"))), body_style),
                date_str,
            ])
        kt = Table(rows, colWidths=[35 * mm, 25 * mm, 75 * mm, 25 * mm], repeatRows=1)
        kt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GREEN),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(kt)

    # Footer
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=GRAY, spaceBefore=16)
    elements.append(Paragraph(
        f"Documento generado el {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC por {current_user.get('name')} ({current_user.get('email')}). "
        "Confidencial — Uso exclusivo del Dpto. de RRHH.",
        footer_style,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    safe_name = (user.get("name") or "empleado").replace(" ", "_").replace("/", "-")
    filename = f"Expediente_{safe_name}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def escape_pdf(s: str) -> str:
    """Escape special chars for ReportLab Paragraph."""
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Delete an employee or admin. Admin-only. Cannot delete yourself.
    Cascades: removes user's leaves, kudos sent/received, notifications, and unsets
    responsibilities in capsules/events.
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID de usuario inválido")

    if user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Never allow deleting the last remaining admin
    if target.get("role") == "admin":
        remaining_admins = await db.users.count_documents({"role": "admin"})
        if remaining_admins <= 1:
            raise HTTPException(
                status_code=400,
                detail="No puedes eliminar al último administrador"
            )

    # Cascade cleanup of related data
    await db.leave_requests.delete_many({"user_id": user_id})
    await db.kudos.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.notifications.delete_many({"user_id": user_id})

    # Finally delete the user
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return {
        "message": "Usuario eliminado correctamente",
        "deleted_user_id": user_id,
        "deleted_name": target.get("name"),
    }

# ==================== LEAVE REQUEST ROUTES ====================

@api_router.post("/leave-requests")
async def create_leave_request(
    request_data: LeaveRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    request_dict = request_data.dict()
    request_dict["user_id"] = current_user["_id"]
    request_dict["user_name"] = current_user["name"]
    request_dict["status"] = "pending"
    request_dict["created_at"] = datetime.utcnow()
    
    result = await db.leave_requests.insert_one(request_dict)
    
    # Send notifications and emails to all admins
    admins = await db.users.find({"role": "admin"}).to_list(100)
    subject, html = tpl_leave_created(
        employee_name=current_user["name"],
        leave_type=request_data.type,
        start_date=request_data.start_date,
        end_date=request_data.end_date,
        reason=request_data.reason or "",
    )
    for admin in admins:
        notification = {
            "user_id": str(admin["_id"]),
            "title": "Nueva solicitud de permiso",
            "message": f"{current_user['name']} ha solicitado un permiso de tipo {request_data.type}",
            "type": "leave_request",
            "read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification)
        # Fire-and-forget email (errors are swallowed inside send_email)
        if admin.get("email"):
            try:
                await send_email(to=admin["email"], subject=subject, html=html)
            except Exception as _e:
                logger.warning(f"Failed sending leave email to admin: {_e}")
    
    request_dict["_id"] = str(result.inserted_id)
    return request_dict

@api_router.get("/leave-requests")
async def get_leave_requests(current_user: dict = Depends(get_current_user)):
    # If employee, only show their own requests
    query = {} if current_user["role"] == "admin" else {"user_id": current_user["_id"]}
    
    requests = await db.leave_requests.find(query).sort("created_at", -1).to_list(1000)
    for req in requests:
        req["_id"] = str(req["_id"])
    return requests

@api_router.get("/leave-requests/{request_id}")
async def get_leave_request(request_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.leave_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Employees can only see their own requests
    if current_user["role"] != "admin" and request["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    request["_id"] = str(request["_id"])
    return request

@api_router.put("/leave-requests/{request_id}/approve")
async def approve_reject_leave_request(
    request_id: str,
    approval_data: LeaveRequestApprove,
    current_user: dict = Depends(require_admin)
):
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    
    request = await db.leave_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    result = await db.leave_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": approval_data.status,
            "approved_by": current_user["_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    # Send notification + email to the employee
    notification = {
        "user_id": request["user_id"],
        "title": "Solicitud de permiso actualizada",
        "message": f"Tu solicitud de permiso ha sido {approval_data.status}",
        "type": "leave_request_update",
        "read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)

    # Email the employee
    try:
        employee = await db.users.find_one({"_id": ObjectId(request["user_id"])})
        if employee and employee.get("email"):
            subject, html = tpl_leave_decision(
                employee_name=employee["name"],
                leave_type=request.get("type", "normal"),
                status=approval_data.status,
                start_date=request.get("start_date", ""),
                end_date=request.get("end_date", ""),
                admin_name=current_user["name"],
            )
            await send_email(to=employee["email"], subject=subject, html=html)
    except Exception as _e:
        logger.warning(f"Failed sending leave decision email: {_e}")
    
    return {"message": f"Request {approval_data.status} successfully"}

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/absent")
async def get_absent_employees(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().date().isoformat()
    
    # Find approved leave requests that include today
    absent_requests = await db.leave_requests.find({
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today}
    }).to_list(1000)
    
    absent_employees = []
    for req in absent_requests:
        user = await db.users.find_one({"_id": ObjectId(req["user_id"])})
        if user:
            absent_employees.append({
                "_id": str(user["_id"]),
                "name": user["name"],
                "position": user["position"],
                "profile_photo": user.get("profile_photo"),
                "type": req["type"],
                "reason": req.get("reason", ""),
                "start_date": req["start_date"],
                "end_date": req["end_date"],
                "until": req["end_date"],
            })
    
    return absent_employees

@api_router.get("/dashboard/birthdays")
async def get_birthdays(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({"birthdate": {"$exists": True, "$ne": None}}).to_list(1000)
    
    today_date = datetime.utcnow().date()
    today_str = today_date.strftime("%m-%d")
    
    birthdays_today = []
    birthdays_upcoming = []
    
    for user in users:
        if user.get("birthdate"):
            try:
                birth_date = datetime.strptime(user["birthdate"], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                continue
            birth_month_day = birth_date.strftime("%m-%d")
            
            user_info = {
                "_id": str(user["_id"]),
                "name": user["name"],
                "position": user["position"],
                "birthdate": user["birthdate"],
                "profile_photo": user.get("profile_photo")
            }
            
            if birth_month_day == today_str:
                birthdays_today.append(user_info)
            else:
                # Check if birthday is within next 30 days (using pure date arithmetic)
                try:
                    this_year_birthday = birth_date.replace(year=today_date.year)
                except ValueError:
                    # Handles Feb 29 on non-leap years
                    this_year_birthday = birth_date.replace(year=today_date.year, day=28)
                if this_year_birthday < today_date:
                    try:
                        this_year_birthday = birth_date.replace(year=today_date.year + 1)
                    except ValueError:
                        this_year_birthday = birth_date.replace(year=today_date.year + 1, day=28)
                
                days_until = (this_year_birthday - today_date).days
                if 0 < days_until <= 30:
                    user_info["days_until"] = days_until
                    birthdays_upcoming.append(user_info)
    
    # Sort upcoming by days_until
    birthdays_upcoming.sort(key=lambda x: x.get("days_until", 999))
    
    return {
        "today": birthdays_today,
        "upcoming": birthdays_upcoming
    }

@api_router.get("/dashboard/employee-of-month")
async def get_employee_of_month(current_user: dict = Depends(get_current_user)):
    employee = await db.users.find_one({"is_employee_of_month": True})
    if employee:
        employee["_id"] = str(employee["_id"])
        employee.pop("password", None)
        return employee
    return None

@api_router.put("/dashboard/employee-of-month/{user_id}")
async def set_employee_of_month(user_id: str, current_user: dict = Depends(require_admin)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Remove previous employee of the month
    await db.users.update_many({}, {"$set": {"is_employee_of_month": False}})
    
    # Set new employee of the month
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_employee_of_month": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Employee of the month updated"}

# ==================== EVENT ROUTES ====================

@api_router.get("/events")
async def get_events(current_user: dict = Depends(get_current_user)):
    events = await db.events.find().sort("date", 1).to_list(1000)
    for event in events:
        event["_id"] = str(event["_id"])
    return events

@api_router.post("/events")
async def create_event(event_data: EventCreate, current_user: dict = Depends(require_admin)):
    event_dict = event_data.dict()
    event_dict["created_by"] = current_user["_id"]
    event_dict["created_at"] = datetime.utcnow()
    
    result = await db.events.insert_one(event_dict)
    event_dict["_id"] = str(result.inserted_id)
    return event_dict

@api_router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    event_data: EventCreate,
    current_user: dict = Depends(require_admin)
):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    result = await db.events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": event_data.dict()}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event updated successfully"}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(require_admin)):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=400, detail="Invalid event ID")
    
    result = await db.events.delete_one({"_id": ObjectId(event_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event deleted successfully"}

# ==================== COMMERCIAL GOAL ROUTES ====================

@api_router.get("/goals")
async def get_goals(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow()
    goal = await db.commercial_goals.find_one({
        "month": today.month,
        "year": today.year
    })
    
    if goal:
        goal["_id"] = str(goal["_id"])
        return goal
    
    # Create default goal for current month if doesn't exist
    default_goal = {
        "month": today.month,
        "year": today.year,
        "goal_amount": 0.0,
        "current_amount": 0.0,
        "percentage": 0.0,
        "updated_at": datetime.utcnow()
    }
    result = await db.commercial_goals.insert_one(default_goal)
    default_goal["_id"] = str(result.inserted_id)
    return default_goal

@api_router.put("/goals/{goal_id}")
async def update_goal(
    goal_id: str,
    goal_data: CommercialGoalUpdate,
    current_user: dict = Depends(require_admin)
):
    if not ObjectId.is_valid(goal_id):
        raise HTTPException(status_code=400, detail="Invalid goal ID")
    
    update_dict = {k: v for k, v in goal_data.dict().items() if v is not None}
    
    # Recalculate percentage if amounts are updated
    goal = await db.commercial_goals.find_one({"_id": ObjectId(goal_id)})
    if goal:
        goal_amount = update_dict.get("goal_amount", goal.get("goal_amount", 0))
        current_amount = update_dict.get("current_amount", goal.get("current_amount", 0))
        
        if goal_amount > 0:
            update_dict["percentage"] = round((current_amount / goal_amount) * 100, 2)
        else:
            update_dict["percentage"] = 0.0
    
    update_dict["updated_at"] = datetime.utcnow()
    
    result = await db.commercial_goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    return {"message": "Goal updated successfully"}

# ==================== CAPSULE ROUTES ====================

@api_router.get("/capsules")
async def get_capsules(current_user: dict = Depends(get_current_user)):
    capsules = await db.capsules.find().sort("date", -1).to_list(1000)
    for capsule in capsules:
        capsule["_id"] = str(capsule["_id"])
    return capsules

@api_router.post("/capsules")
async def create_capsule(capsule_data: CapsuleCreate, current_user: dict = Depends(get_current_user)):
    # Get employee name
    employee = await db.users.find_one({"_id": ObjectId(capsule_data.responsible_employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    capsule_dict = capsule_data.dict()
    capsule_dict["responsible_employee_name"] = employee["name"]
    capsule_dict["created_at"] = datetime.utcnow()
    
    result = await db.capsules.insert_one(capsule_dict)
    capsule_dict["_id"] = str(result.inserted_id)
    return capsule_dict

@api_router.put("/capsules/{capsule_id}")
async def update_capsule(
    capsule_id: str,
    capsule_data: CapsuleCreate,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(capsule_id):
        raise HTTPException(status_code=400, detail="Invalid capsule ID")
    
    # Get employee name
    employee = await db.users.find_one({"_id": ObjectId(capsule_data.responsible_employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_dict = capsule_data.dict()
    update_dict["responsible_employee_name"] = employee["name"]
    
    result = await db.capsules.update_one(
        {"_id": ObjectId(capsule_id)},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Capsule not found")
    
    return {"message": "Capsule updated successfully"}

@api_router.delete("/capsules/{capsule_id}")
async def delete_capsule(capsule_id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(capsule_id):
        raise HTTPException(status_code=400, detail="Invalid capsule ID")
    
    result = await db.capsules.delete_one({"_id": ObjectId(capsule_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Capsule not found")
    
    return {"message": "Capsule deleted successfully"}

# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user["_id"]}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for notif in notifications:
        notif["_id"] = str(notif["_id"])
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["_id"]},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

# ==================== KUDOS ROUTES ====================

@api_router.get("/kudos")
async def get_kudos(current_user: dict = Depends(get_current_user)):
    kudos = await db.kudos.find().sort("created_at", -1).limit(100).to_list(100)
    for kudo in kudos:
        kudo["_id"] = str(kudo["_id"])
    return kudos

@api_router.post("/kudos")
async def create_kudo(kudo_data: KudoCreate, current_user: dict = Depends(get_current_user)):
    if kudo_data.to_user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="No puedes darte likes a ti mismo")
    
    to_user = await db.users.find_one({"_id": ObjectId(kudo_data.to_user_id)})
    if not to_user:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    kudo_dict = kudo_data.dict()
    kudo_dict["from_user_id"] = current_user["_id"]
    kudo_dict["from_user_name"] = current_user["name"]
    kudo_dict["to_user_name"] = to_user["name"]
    kudo_dict["created_at"] = datetime.utcnow()
    
    result = await db.kudos.insert_one(kudo_dict)
    
    # Notify ALL users (except the sender) — recipient gets a personalized title/message
    all_users = await db.users.find({}, {"_id": 1}).to_list(1000)
    now = datetime.utcnow()
    notifications_batch = []
    for u in all_users:
        uid = str(u["_id"])
        if uid == current_user["_id"]:
            continue
        is_recipient = uid == kudo_data.to_user_id
        if is_recipient:
            title = "¡Recibiste un Like!"
            message = f"{current_user['name']} te ha dado un like: {kudo_data.message[:60]}"
        else:
            title = "Nuevo Like en el equipo"
            message = f"{current_user['name']} le dio un like a {to_user['name']}"
        notifications_batch.append({
            "user_id": uid,
            "title": title,
            "message": message,
            "type": "kudo",
            "read": False,
            "created_at": now,
        })
    if notifications_batch:
        await db.notifications.insert_many(notifications_batch)
    
    kudo_dict["_id"] = str(result.inserted_id)
    return kudo_dict

@api_router.get("/kudos/user/{user_id}")
async def get_user_kudos(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all kudos received by a user"""
    kudos = await db.kudos.find({"to_user_id": user_id}).sort("created_at", -1).to_list(100)
    for kudo in kudos:
        kudo["_id"] = str(kudo["_id"])
    return kudos

@api_router.get("/kudos/leaderboard")
async def get_kudos_leaderboard(current_user: dict = Depends(get_current_user)):
    """Get top employees by kudos count"""
    pipeline = [
        {"$group": {
            "_id": "$to_user_id",
            "to_user_name": {"$first": "$to_user_name"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    leaderboard = await db.kudos.aggregate(pipeline).to_list(10)
    
    # Add user info
    for entry in leaderboard:
        user = await db.users.find_one({"_id": ObjectId(entry["_id"])})
        if user:
            entry["position"] = user.get("position", "")
            entry["profile_photo"] = user.get("profile_photo")
    
    return leaderboard

# ==================== REPORTS ROUTES ====================

@api_router.get("/reports/stats")
async def get_stats(current_user: dict = Depends(require_admin)):
    """Get overall statistics for admin dashboard"""
    total_employees = await db.users.count_documents({"role": "employee"})
    total_admins = await db.users.count_documents({"role": "admin"})
    
    # Leave requests stats
    total_leaves = await db.leave_requests.count_documents({})
    pending_leaves = await db.leave_requests.count_documents({"status": "pending"})
    approved_leaves = await db.leave_requests.count_documents({"status": "approved"})
    rejected_leaves = await db.leave_requests.count_documents({"status": "rejected"})
    
    # By type
    vacation_count = await db.leave_requests.count_documents({"type": "vacation"})
    medical_count = await db.leave_requests.count_documents({"type": "medical"})
    normal_count = await db.leave_requests.count_documents({"type": "normal"})
    
    # Kudos stats
    total_kudos = await db.kudos.count_documents({})
    
    # This month's leaves
    today = datetime.utcnow()
    first_day = datetime(today.year, today.month, 1).isoformat()
    month_leaves = await db.leave_requests.count_documents({
        "created_at": {"$gte": datetime(today.year, today.month, 1)}
    })
    
    return {
        "employees": {
            "total": total_employees,
            "admins": total_admins,
        },
        "leaves": {
            "total": total_leaves,
            "pending": pending_leaves,
            "approved": approved_leaves,
            "rejected": rejected_leaves,
            "this_month": month_leaves,
            "by_type": {
                "vacation": vacation_count,
                "medical": medical_count,
                "normal": normal_count
            }
        },
        "kudos": {
            "total": total_kudos
        }
    }

# ==================== USER PHOTO ====================

class ProfilePhotoUpdate(BaseModel):
    profile_photo: str  # base64

@api_router.put("/users/{user_id}/photo")
async def update_profile_photo(
    user_id: str,
    photo_data: ProfilePhotoUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin" and current_user["_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile_photo": photo_data.profile_photo}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Profile photo updated"}

# ==================== PAUSAS ACTIVAS ====================

class PausaActiva(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    order: int
    name: str
    description: str
    instructions: List[str]
    duration_seconds: int
    focus_area: str
    image_base64: Optional[str] = None

    class Config:
        populate_by_name = True


@api_router.get("/pausas-activas")
async def get_pausas_activas(current_user: dict = Depends(get_current_user)):
    """Return the 10 active-break exercises with illustrations."""
    pausas = await db.pausas_activas.find().sort("order", 1).to_list(50)
    for p in pausas:
        p["_id"] = str(p["_id"])
    return pausas


@api_router.get("/pausas-activas/random")
async def get_random_pausa(current_user: dict = Depends(get_current_user)):
    """Return one random pause suggestion (used when opening from a notification)."""
    import random
    count = await db.pausas_activas.count_documents({})
    if count == 0:
        raise HTTPException(status_code=404, detail="No hay pausas activas configuradas")
    skip = random.randint(0, count - 1)
    pausa = await db.pausas_activas.find().skip(skip).limit(1).to_list(1)
    if not pausa:
        raise HTTPException(status_code=404, detail="No hay pausas activas")
    pausa[0]["_id"] = str(pausa[0]["_id"])
    return pausa[0]


# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_database():
    """Seed the database with sample data"""
    
    # Clear existing data
    await db.users.delete_many({})
    await db.leave_requests.delete_many({})
    await db.events.delete_many({})
    await db.commercial_goals.delete_many({})
    await db.capsules.delete_many({})
    await db.notifications.delete_many({})
    await db.kudos.delete_many({})
    
    # Dynamic dates for admins too
    _today_adm = datetime.utcnow().date()
    def _bday_adm(year: int, days_offset: int) -> str:
        target = _today_adm + timedelta(days=days_offset)
        try:
            return target.replace(year=year).isoformat()
        except ValueError:
            return target.replace(year=year, day=28).isoformat()

    # Create admins
    admin_password = hash_password("admin123")
    admins = [
        {
            "email": "admin1@conactivos.com",
            "password": admin_password,
            "name": "María García",
            "position": "Directora de RRHH",
            "role": "admin",
            "phone": "555-0101",
            "birthdate": _bday_adm(1985, 60),
            "hire_date": "2020-01-15",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "admin2@conactivos.com",
            "password": admin_password,
            "name": "Carlos Rodríguez",
            "position": "Gerente General",
            "role": "admin",
            "phone": "555-0102",
            "birthdate": _bday_adm(1980, 150),
            "hire_date": "2019-06-01",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "admin3@conactivos.com",
            "password": admin_password,
            "name": "Ana Martínez",
            "position": "Coordinadora Administrativa",
            "role": "admin",
            "phone": "555-0103",
            "birthdate": _bday_adm(1988, 210),
            "hire_date": "2020-09-01",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        }
    ]
    
    admin_results = await db.users.insert_many(admins)
    admin_ids = [str(id) for id in admin_results.inserted_ids]
    
    # Create employees
    # Dynamic birthdays so dashboard always has fresh data
    _today = datetime.utcnow().date()
    def _bday(year: int, days_offset: int) -> str:
        """Generate a YYYY-MM-DD string with a birthdate that occurs `days_offset` from today.
        Only month-day matters for the dashboard; year controls displayed age.
        """
        target = _today + timedelta(days=days_offset)
        try:
            return target.replace(year=year).isoformat()
        except ValueError:
            # Handles Feb 29 fallback
            return target.replace(year=year, day=28).isoformat()

    employee_password = hash_password("employee123")
    employees = [
        {
            "email": "juan.perez@conactivos.com",
            "password": employee_password,
            "name": "Juan Pérez",
            "position": "Desarrollador Senior",
            "role": "employee",
            "phone": "555-0201",
            "birthdate": _bday(1992, 0),  # birthday TODAY
            "hire_date": "2021-03-15",
            "is_employee_of_month": True,
            "created_at": datetime.utcnow()
        },
        {
            "email": "laura.gomez@conactivos.com",
            "password": employee_password,
            "name": "Laura Gómez",
            "position": "Diseñadora UX/UI",
            "role": "employee",
            "phone": "555-0202",
            "birthdate": _bday(1994, 3),  # in 3 days
            "hire_date": "2021-05-20",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "pedro.sanchez@conactivos.com",
            "password": employee_password,
            "name": "Pedro Sánchez",
            "position": "Analista de Datos",
            "role": "employee",
            "phone": "555-0203",
            "birthdate": _bday(1990, 8),  # in 8 days
            "hire_date": "2020-11-10",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "sofia.lopez@conactivos.com",
            "password": employee_password,
            "name": "Sofía López",
            "position": "Ejecutiva de Ventas",
            "role": "employee",
            "phone": "555-0204",
            "birthdate": _bday(1995, 15),  # in 15 days
            "hire_date": "2022-01-15",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "miguel.torres@conactivos.com",
            "password": employee_password,
            "name": "Miguel Torres",
            "position": "Desarrollador Frontend",
            "role": "employee",
            "phone": "555-0205",
            "birthdate": _bday(1993, 22),  # in 22 days
            "hire_date": "2021-08-01",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "carmen.diaz@conactivos.com",
            "password": employee_password,
            "name": "Carmen Díaz",
            "position": "Coordinadora de Marketing",
            "role": "employee",
            "phone": "555-0206",
            "birthdate": _bday(1991, 45),  # in ~1.5 months
            "hire_date": "2020-07-15",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "roberto.morales@conactivos.com",
            "password": employee_password,
            "name": "Roberto Morales",
            "position": "Desarrollador Backend",
            "role": "employee",
            "phone": "555-0207",
            "birthdate": _bday(1989, 90),
            "hire_date": "2019-12-01",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "isabel.fernandez@conactivos.com",
            "password": employee_password,
            "name": "Isabel Fernández",
            "position": "Contadora",
            "role": "employee",
            "phone": "555-0208",
            "birthdate": _bday(1987, 120),
            "hire_date": "2020-02-20",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "diego.ramirez@conactivos.com",
            "password": employee_password,
            "name": "Diego Ramírez",
            "position": "Soporte Técnico",
            "role": "employee",
            "phone": "555-0209",
            "birthdate": _bday(1996, 180),
            "hire_date": "2022-04-01",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        },
        {
            "email": "paula.castro@conactivos.com",
            "password": employee_password,
            "name": "Paula Castro",
            "position": "Asistente Administrativa",
            "role": "employee",
            "phone": "555-0210",
            "birthdate": _bday(1997, 240),
            "hire_date": "2022-06-15",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        }
    ]
    
    employee_results = await db.users.insert_many(employees)
    employee_ids = [str(id) for id in employee_results.inserted_ids]
    
    # Create some leave requests
    today = datetime.utcnow().date()
    leave_requests = [
        {
            "user_id": employee_ids[0],
            "user_name": "Juan Pérez",
            "type": "vacation",
            "start_date": (today + timedelta(days=2)).isoformat(),
            "end_date": (today + timedelta(days=5)).isoformat(),
            "reason": "Vacaciones familiares",
            "status": "pending",
            "created_at": datetime.utcnow()
        },
        {
            "user_id": employee_ids[2],
            "user_name": "Pedro Sánchez",
            "type": "medical",
            "start_date": today.isoformat(),
            "end_date": today.isoformat(),
            "reason": "Cita médica de rutina",
            "status": "approved",
            "approved_by": admin_ids[0],
            "approved_at": datetime.utcnow(),
            "created_at": datetime.utcnow() - timedelta(days=1)
        },
        {
            "user_id": employee_ids[5],
            "user_name": "Carmen Díaz",
            "type": "normal",
            "start_date": (today + timedelta(days=1)).isoformat(),
            "end_date": (today + timedelta(days=1)).isoformat(),
            "reason": "Trámite personal",
            "status": "approved",
            "approved_by": admin_ids[1],
            "approved_at": datetime.utcnow(),
            "created_at": datetime.utcnow() - timedelta(days=2)
        }
    ]
    
    await db.leave_requests.insert_many(leave_requests)
    
    # Create events
    events = [
        {
            "title": "Reunión Mensual de Equipo",
            "description": "Revisión de objetivos y avances del mes",
            "date": (today + timedelta(days=5)).isoformat(),
            "created_by": admin_ids[0],
            "created_at": datetime.utcnow()
        },
        {
            "title": "Capacitación de Seguridad",
            "description": "Taller sobre seguridad en el trabajo",
            "date": (today + timedelta(days=10)).isoformat(),
            "created_by": admin_ids[1],
            "created_at": datetime.utcnow()
        },
        {
            "title": "Celebración Cumpleaños del Mes",
            "description": "Compartir por los cumpleaños del mes",
            "date": (today + timedelta(days=15)).isoformat(),
            "created_by": admin_ids[2],
            "created_at": datetime.utcnow()
        }
    ]
    
    await db.events.insert_many(events)
    
    # Create commercial goal for current month
    commercial_goal = {
        "month": today.month,
        "year": today.year,
        "goal_amount": 500000.0,
        "current_amount": 325000.0,
        "percentage": 65.0,
        "updated_at": datetime.utcnow()
    }
    
    await db.commercial_goals.insert_one(commercial_goal)
    
    # Create capsules
    capsules = [
        {
            "date": today.isoformat(),
            "topic": "Atención al cliente y resolución de conflictos",
            "responsible_employee_id": employee_ids[0],
            "responsible_employee_name": "Juan Pérez",
            "description": "Técnicas efectivas para manejar clientes difíciles",
            "created_at": datetime.utcnow()
        },
        {
            "date": (today + timedelta(days=1)).isoformat(),
            "topic": "Nuevas herramientas de productividad",
            "responsible_employee_id": employee_ids[4],
            "responsible_employee_name": "Miguel Torres",
            "description": "Presentación de herramientas para mejorar el flujo de trabajo",
            "created_at": datetime.utcnow()
        },
        {
            "date": (today + timedelta(days=2)).isoformat(),
            "topic": "Estrategias de ventas B2B",
            "responsible_employee_id": employee_ids[3],
            "responsible_employee_name": "Sofía López",
            "description": "Mejores prácticas para cerrar ventas corporativas",
            "created_at": datetime.utcnow()
        }
    ]
    
    await db.capsules.insert_many(capsules)
    
    # Create kudos
    kudos = [
        {
            "from_user_id": employee_ids[1],
            "from_user_name": "Laura Gómez",
            "to_user_id": employee_ids[0],
            "to_user_name": "Juan Pérez",
            "message": "Gracias por tu apoyo en el proyecto de rediseño. Tu experiencia técnica hizo la diferencia.",
            "category": "teamwork",
            "created_at": datetime.utcnow() - timedelta(days=1)
        },
        {
            "from_user_id": admin_ids[0],
            "from_user_name": "María García",
            "to_user_id": employee_ids[0],
            "to_user_name": "Juan Pérez",
            "message": "Excelente presentación al cliente. Muy profesional.",
            "category": "excellence",
            "created_at": datetime.utcnow() - timedelta(days=2)
        },
        {
            "from_user_id": employee_ids[4],
            "from_user_name": "Miguel Torres",
            "to_user_id": employee_ids[3],
            "to_user_name": "Sofía López",
            "message": "Cerraste ese negocio complejo increíble. ¡Felicidades!",
            "category": "excellence",
            "created_at": datetime.utcnow() - timedelta(days=3)
        },
        {
            "from_user_id": employee_ids[2],
            "from_user_name": "Pedro Sánchez",
            "to_user_id": employee_ids[6],
            "to_user_name": "Roberto Morales",
            "message": "Tu propuesta de arquitectura fue innovadora. Gran trabajo.",
            "category": "innovation",
            "created_at": datetime.utcnow() - timedelta(days=4)
        },
        {
            "from_user_id": employee_ids[7],
            "from_user_name": "Isabel Fernández",
            "to_user_id": employee_ids[9],
            "to_user_name": "Paula Castro",
            "message": "Gracias por ayudarme con los reportes. Muy amable.",
            "category": "helpful",
            "created_at": datetime.utcnow() - timedelta(days=5)
        },
        {
            "from_user_id": employee_ids[5],
            "from_user_name": "Carmen Díaz",
            "to_user_id": employee_ids[0],
            "to_user_name": "Juan Pérez",
            "message": "Lideraste el sprint con excelente comunicación.",
            "category": "leadership",
            "created_at": datetime.utcnow() - timedelta(days=6)
        }
    ]
    
    await db.kudos.insert_many(kudos)
    
    return {
        "message": "Database seeded successfully",
        "admins": len(admins),
        "employees": len(employees),
        "credentials": {
            "admin": {
                "email": "admin1@conactivos.com",
                "password": "admin123"
            },
            "employee": {
                "email": "juan.perez@conactivos.com",
                "password": "employee123"
            }
        }
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
