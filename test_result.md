#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Aplicación de Recursos Humanos para Conactivos con gestión de perfiles, solicitudes de permisos (vacaciones, citas médicas, permisos), dashboard con ausentes/cumpleaños/empleado del mes, calendario de eventos editable, metas comerciales editables, y cápsulas diarias."

backend:
  - task: "Autenticación con JWT"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Sistema de login/register implementado con bcrypt y JWT. Límite de 3 admins configurado. Probado con curl exitosamente."

  - task: "Gestión de Usuarios"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "CRUD de usuarios con roles (admin/employee). Endpoint de listado y detalle funcionando."

  - task: "Solicitudes de Permisos"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Sistema completo de solicitudes con aprobación/rechazo. Soporte para documentos en base64. Probado con curl y backend_test.py - funciona correctamente. Empleados reciben 403 al intentar aprobar (verificado manualmente)."

  - task: "Dashboard Endpoints"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Endpoints para ausentes, cumpleaños, y empleado del mes. Probado con curl exitosamente."

  - task: "Calendario de Eventos"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "CRUD completo de eventos. Solo admins pueden crear/editar/eliminar - probado manualmente con curl (empleados reciben 403)."

  - task: "Metas Comerciales"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Sistema de metas con cálculo automático de porcentaje. Probado con curl exitosamente."

  - task: "Cápsulas Diarias"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "CRUD de cápsulas con asignación de empleado responsable. Probado en backend_test.py - crear, actualizar, eliminar funcionan correctamente."

  - task: "Sistema de Notificaciones"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Notificaciones creadas automáticamente al crear solicitudes (admins) y aprobar/rechazar (empleado). Probado en backend_test.py exitosamente."

  - task: "Seeding de Datos"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Endpoint de seed con 3 admins y 10 empleados. Probado exitosamente con curl."

frontend:
  - task: "Sistema de Autenticación"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/contexts/AuthContext.tsx, /app/frontend/app/login.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "AuthContext con login/register/logout. Pantalla de login con credenciales de prueba visibles. Pendiente de testing."

  - task: "Dashboard Principal"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Dashboard con empleados ausentes, cumpleaños (hoy y próximos), y empleado del mes. Botón de seed si DB está vacía. Pendiente de testing."

  - task: "Solicitudes de Permisos"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/solicitudes.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Pantalla completa con listado, creación de solicitudes, adjuntar documentos (imagen picker), y aprobación/rechazo para admins. Pendiente de testing."

  - task: "Calendario de Eventos"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/calendario.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Calendario con eventos próximos y pasados. CRUD solo para admins. Pendiente de testing."

  - task: "Metas Comerciales"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/metas.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Pantalla de metas con barra de progreso, estadísticas, y edición para admins. Pendiente de testing."

  - task: "Cápsulas Diarias"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/capsulas.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Sistema de cápsulas con creación/edición para todos, selector de empleado responsable. Pendiente de testing."

  - task: "Lista de Empleados"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/empleados/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Listado de empleados con búsqueda, indicadores de rol admin y empleado del mes. Pendiente de testing."

  - task: "Navegación por Tabs"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Navegación por tabs con 5 secciones: Inicio, Solicitudes, Calendario, Metas, Cápsulas. Pendiente de testing."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Sistema de Autenticación"
    - "Dashboard Principal"
    - "Solicitudes de Permisos"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "MVP completo de app de RRHH implementado. Backend con todos los endpoints funcionando (autenticación, usuarios, solicitudes, dashboard, eventos, metas, cápsulas, notificaciones). Frontend con 5 tabs y todas las funcionalidades. DB seeded con 3 admins y 10 empleados. Credenciales en test_credentials.md. Listo para testing completo del backend."