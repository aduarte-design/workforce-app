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
    except jwt.JWTError:
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
    
    # Send notifications to all admins
    admins = await db.users.find({"role": "admin"}).to_list(100)
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
    
    # Send notification to the employee
    notification = {
        "user_id": request["user_id"],
        "title": "Solicitud de permiso actualizada",
        "message": f"Tu solicitud de permiso ha sido {approval_data.status}",
        "type": "leave_request_update",
        "read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
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
                "name": user["name"],
                "position": user["position"],
                "type": req["type"],
                "until": req["end_date"]
            })
    
    return absent_employees

@api_router.get("/dashboard/birthdays")
async def get_birthdays(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({"birthdate": {"$exists": True, "$ne": None}}).to_list(1000)
    
    today = datetime.utcnow()
    today_str = today.strftime("%m-%d")
    
    birthdays_today = []
    birthdays_upcoming = []
    
    for user in users:
        if user.get("birthdate"):
            birth_date = datetime.strptime(user["birthdate"], "%Y-%m-%d")
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
                # Check if birthday is within next 30 days
                this_year_birthday = birth_date.replace(year=today.year)
                if this_year_birthday < today:
                    this_year_birthday = birth_date.replace(year=today.year + 1)
                
                days_until = (this_year_birthday - today).days
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
        raise HTTPException(status_code=400, detail="No puedes darte kudos a ti mismo")
    
    to_user = await db.users.find_one({"_id": ObjectId(kudo_data.to_user_id)})
    if not to_user:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    kudo_dict = kudo_data.dict()
    kudo_dict["from_user_id"] = current_user["_id"]
    kudo_dict["from_user_name"] = current_user["name"]
    kudo_dict["to_user_name"] = to_user["name"]
    kudo_dict["created_at"] = datetime.utcnow()
    
    result = await db.kudos.insert_one(kudo_dict)
    
    # Notify recipient
    notification = {
        "user_id": kudo_data.to_user_id,
        "title": "¡Recibiste un Kudo!",
        "message": f"{current_user['name']} te ha dado un kudo: {kudo_data.message[:50]}",
        "type": "kudo",
        "read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)
    
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
            "birthdate": "1985-03-15",
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
            "birthdate": "1980-07-22",
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
            "birthdate": "1988-11-08",
            "hire_date": "2020-09-01",
            "is_employee_of_month": False,
            "created_at": datetime.utcnow()
        }
    ]
    
    admin_results = await db.users.insert_many(admins)
    admin_ids = [str(id) for id in admin_results.inserted_ids]
    
    # Create employees
    employee_password = hash_password("employee123")
    employees = [
        {
            "email": "juan.perez@conactivos.com",
            "password": employee_password,
            "name": "Juan Pérez",
            "position": "Desarrollador Senior",
            "role": "employee",
            "phone": "555-0201",
            "birthdate": "1992-06-10",
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
            "birthdate": "1994-12-20",
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
            "birthdate": "1990-02-14",
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
            "birthdate": "1995-08-05",
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
            "birthdate": "1993-04-18",
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
            "birthdate": "1991-09-25",
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
            "birthdate": "1989-01-30",
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
            "birthdate": "1987-05-12",
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
            "birthdate": "1996-07-08",
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
            "birthdate": "1997-10-03",
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
