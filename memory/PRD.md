# Conactivos - HR Mobile App PRD

## Overview
Aplicación móvil de Recursos Humanos para Conactivos que centraliza la gestión del personal, permisos, eventos, metas comerciales y comunicación diaria del equipo.

## Tech Stack
- **Frontend:** Expo Router + React Native + TypeScript
- **Backend:** FastAPI + MongoDB (Motor)
- **Auth:** JWT + bcrypt
- **UI:** React Native components + @expo/vector-icons

## User Roles
- **Admin (max 3):** Full access - manage employees, approve leaves, edit events/goals
- **Employee:** View info, request leaves, create/edit capsules

## Features Implemented

### 1. Authentication
- Login with corporate email + password
- JWT-based session persistence
- Auto-redirect based on auth state
- Max 3 admins enforcement

### 2. Dashboard (Home)
- Employee of the Month (with photo & position)
- Absent Employees Today (from approved leave requests)
- Today's Birthdays
- Upcoming Birthdays (next 30 days with days countdown)
- Quick access to employee list

### 3. Leave Requests (Solicitudes)
- Types: Vacaciones, Cita Médica, Permiso normal
- Date range selection
- Attach proof documents (base64 image)
- Admin approval/rejection workflow
- Auto-notifications to admins on creation
- Auto-notifications to employee on approval/rejection

### 4. Events Calendar (Calendario)
- List upcoming and past events
- Full CRUD for admins (create, edit, delete)
- Visual date badges (day + month)
- Employee view-only

### 5. Commercial Goals (Metas)
- Monthly goal display with:
  - Progress bar (color-coded by %)
  - Achieved amount vs Remaining
  - Automatic percentage calculation
- Admin-only editing
- Achievement celebration banner (100%+)

### 6. Capsules (Cápsulas)
- Daily meeting topics
- Assign responsible employee
- Full CRUD for all users
- Upcoming vs past capsules separation

### 7. Employees List
- Search by name/position/email
- Role indicators (Admin badge)
- Employee of the month star
- Profile photo support

### 8. Notifications System
- Auto-created on leave request events
- Read/unread tracking
- Backend endpoints ready for push integration

## Seed Data
- 3 Administradores (admin1-3@conactivos.com / admin123)
- 10 Empleados (employee123)
- Sample leave requests, events, goals, and capsules

## Design System
- Brand colors: #122c2a (dark green), #b68a2e (gold)
- Rounded corners (12px cards)
- Ionicons for iconography
- Tab navigation with 5 sections

## API Endpoints
- `/api/auth/*` - login, register, me
- `/api/users` - CRUD users
- `/api/leave-requests` - CRUD + approval
- `/api/dashboard/*` - absent, birthdays, employee-of-month
- `/api/events` - CRUD events
- `/api/goals` - get + update
- `/api/capsules` - CRUD capsules
- `/api/notifications` - list + mark read
- `/api/seed` - populate sample data

## Testing Status
- ✅ Backend: All endpoints tested (auth, CRUD, permissions)
- ✅ Frontend: All screens verified visually
- ✅ Role-based permissions working (403 for unauthorized actions)
- ✅ Seed data loaded successfully
