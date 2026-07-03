#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite for Conactivos HR Application
Tests all endpoints with both admin and employee roles
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Optional

# Backend URL
BASE_URL = "https://workforce-app-92.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDENTIALS = {
    "email": "admin1@conactivos.com",
    "password": "admin123"
}

EMPLOYEE_CREDENTIALS = {
    "email": "juan.perez@conactivos.com",
    "password": "employee123"
}

# Global variables to store tokens and IDs
admin_token = None
employee_token = None
test_data = {}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(test_name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def make_request(method: str, endpoint: str, token: Optional[str] = None, 
                 data: Optional[Dict] = None, expected_status: int = 200) -> tuple:
    """Make HTTP request and return (success, response)"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return False, None
        
        if response.status_code == expected_status:
            return True, response.json() if response.text else None
        else:
            print_error(f"Expected status {expected_status}, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False, None

# ==================== AUTHENTICATION TESTS ====================

def test_authentication():
    """Test authentication endpoints"""
    global admin_token, employee_token
    
    print_test("Authentication")
    
    # Test admin login
    print("\n1. Admin Login")
    success, response = make_request("POST", "/auth/login", data=ADMIN_CREDENTIALS)
    if success and response and "token" in response:
        admin_token = response["token"]
        print_success(f"Admin login successful")
        print_success(f"Admin user: {response['user']['name']} ({response['user']['role']})")
    else:
        print_error("Admin login failed")
        return False
    
    # Test employee login
    print("\n2. Employee Login")
    success, response = make_request("POST", "/auth/login", data=EMPLOYEE_CREDENTIALS)
    if success and response and "token" in response:
        employee_token = response["token"]
        print_success(f"Employee login successful")
        print_success(f"Employee user: {response['user']['name']} ({response['user']['role']})")
    else:
        print_error("Employee login failed")
        return False
    
    # Test token validation (admin)
    print("\n3. Token Validation (Admin)")
    success, response = make_request("GET", "/auth/me", token=admin_token)
    if success and response:
        print_success(f"Admin token valid - User: {response['name']}")
    else:
        print_error("Admin token validation failed")
        return False
    
    # Test token validation (employee)
    print("\n4. Token Validation (Employee)")
    success, response = make_request("GET", "/auth/me", token=employee_token)
    if success and response:
        print_success(f"Employee token valid - User: {response['name']}")
        test_data['employee_id'] = response['_id']
    else:
        print_error("Employee token validation failed")
        return False
    
    return True

# ==================== LEAVE REQUEST TESTS ====================

def test_leave_requests():
    """Test leave request endpoints"""
    print_test("Leave Requests")
    
    # 1. Create leave request as employee
    print("\n1. Create Leave Request (Employee)")
    today = datetime.now().date()
    leave_data = {
        "type": "vacation",
        "start_date": (today + timedelta(days=7)).isoformat(),
        "end_date": (today + timedelta(days=10)).isoformat(),
        "reason": "Vacaciones de verano planificadas",
        "proof_document": None
    }
    success, response = make_request("POST", "/leave-requests", token=employee_token, data=leave_data)
    if success and response:
        test_data['leave_request_id'] = response['_id']
        print_success(f"Leave request created - ID: {response['_id']}")
        print_success(f"Status: {response['status']}, Type: {response['type']}")
    else:
        print_error("Failed to create leave request")
        return False
    
    # 2. Get leave requests as employee (should see only own)
    print("\n2. Get Leave Requests (Employee)")
    success, response = make_request("GET", "/leave-requests", token=employee_token)
    if success and response:
        print_success(f"Retrieved {len(response)} leave request(s) for employee")
        # Verify employee only sees their own requests
        for req in response:
            if req['user_id'] != test_data['employee_id']:
                print_error(f"Employee can see other users' requests!")
                return False
    else:
        print_error("Failed to get leave requests as employee")
        return False
    
    # 3. Get leave requests as admin (should see all)
    print("\n3. Get Leave Requests (Admin)")
    success, response = make_request("GET", "/leave-requests", token=admin_token)
    if success and response:
        print_success(f"Retrieved {len(response)} leave request(s) for admin")
        admin_request_count = len(response)
    else:
        print_error("Failed to get leave requests as admin")
        return False
    
    # 4. Get single leave request
    print("\n4. Get Single Leave Request")
    success, response = make_request("GET", f"/leave-requests/{test_data['leave_request_id']}", 
                                     token=admin_token)
    if success and response:
        print_success(f"Retrieved leave request: {response['type']} - {response['status']}")
    else:
        print_error("Failed to get single leave request")
        return False
    
    # 5. Approve leave request (admin only)
    print("\n5. Approve Leave Request (Admin)")
    approval_data = {"status": "approved"}
    success, response = make_request("PUT", f"/leave-requests/{test_data['leave_request_id']}/approve",
                                     token=admin_token, data=approval_data)
    if success:
        print_success("Leave request approved successfully")
    else:
        print_error("Failed to approve leave request")
        return False
    
    # 6. Verify approval
    print("\n6. Verify Leave Request Approval")
    success, response = make_request("GET", f"/leave-requests/{test_data['leave_request_id']}", 
                                     token=employee_token)
    if success and response and response['status'] == 'approved':
        print_success(f"Leave request status confirmed: {response['status']}")
        print_success(f"Approved by: {response.get('approved_by', 'N/A')}")
    else:
        print_error("Leave request approval not reflected")
        return False
    
    # 7. Test employee cannot approve (should fail)
    print("\n7. Test Employee Cannot Approve (Should Fail)")
    # Create another request first
    leave_data2 = {
        "type": "medical",
        "start_date": (today + timedelta(days=14)).isoformat(),
        "end_date": (today + timedelta(days=14)).isoformat(),
        "reason": "Cita médica de control",
    }
    success, response = make_request("POST", "/leave-requests", token=employee_token, data=leave_data2)
    if success and response:
        test_request_id = response['_id']
        # Try to approve as employee (should fail with 403)
        success, _ = make_request("PUT", f"/leave-requests/{test_request_id}/approve",
                                 token=employee_token, data={"status": "approved"}, 
                                 expected_status=403)
        if not success:
            # This is expected - employee should not be able to approve
            print_success("Employee correctly denied approval permission (403)")
        else:
            print_error("Employee was able to approve - SECURITY ISSUE!")
            return False
    
    return True

# ==================== DASHBOARD TESTS ====================

def test_dashboard():
    """Test dashboard endpoints"""
    print_test("Dashboard Endpoints")
    
    # 1. Get absent employees
    print("\n1. Get Absent Employees")
    success, response = make_request("GET", "/dashboard/absent", token=employee_token)
    if success and response is not None:
        print_success(f"Retrieved {len(response)} absent employee(s)")
        if len(response) > 0:
            for emp in response:
                print_success(f"  - {emp['name']} ({emp['type']}) until {emp['until']}")
    else:
        print_error("Failed to get absent employees")
        return False
    
    # 2. Get birthdays
    print("\n2. Get Birthdays")
    success, response = make_request("GET", "/dashboard/birthdays", token=employee_token)
    if success and response:
        print_success(f"Retrieved birthdays - Today: {len(response['today'])}, Upcoming: {len(response['upcoming'])}")
        if response['today']:
            for bday in response['today']:
                print_success(f"  Today: {bday['name']} - {bday['position']}")
        if response['upcoming']:
            for bday in response['upcoming'][:3]:  # Show first 3
                print_success(f"  Upcoming: {bday['name']} in {bday['days_until']} days")
    else:
        print_error("Failed to get birthdays")
        return False
    
    # 3. Get employee of the month
    print("\n3. Get Employee of the Month")
    success, response = make_request("GET", "/dashboard/employee-of-month", token=employee_token)
    if success:
        if response:
            print_success(f"Employee of the Month: {response['name']} - {response['position']}")
            test_data['employee_of_month_id'] = response['_id']
        else:
            print_success("No employee of the month set")
    else:
        print_error("Failed to get employee of the month")
        return False
    
    return True

# ==================== EVENT TESTS ====================

def test_events():
    """Test event CRUD endpoints"""
    print_test("Events (Calendar)")
    
    # 1. Get all events
    print("\n1. Get All Events")
    success, response = make_request("GET", "/events", token=employee_token)
    if success and response is not None:
        print_success(f"Retrieved {len(response)} event(s)")
        initial_event_count = len(response)
    else:
        print_error("Failed to get events")
        return False
    
    # 2. Create event (admin only)
    print("\n2. Create Event (Admin)")
    today = datetime.now().date()
    event_data = {
        "title": "Reunión de Prueba Automatizada",
        "description": "Evento creado por test automatizado",
        "date": (today + timedelta(days=20)).isoformat()
    }
    success, response = make_request("POST", "/events", token=admin_token, data=event_data)
    if success and response:
        test_data['event_id'] = response['_id']
        print_success(f"Event created - ID: {response['_id']}")
        print_success(f"Title: {response['title']}, Date: {response['date']}")
    else:
        print_error("Failed to create event")
        return False
    
    # 3. Test employee cannot create event (should fail)
    print("\n3. Test Employee Cannot Create Event (Should Fail)")
    success, _ = make_request("POST", "/events", token=employee_token, 
                             data=event_data, expected_status=403)
    if not success:
        print_success("Employee correctly denied event creation permission (403)")
    else:
        print_error("Employee was able to create event - SECURITY ISSUE!")
        return False
    
    # 4. Update event (admin only)
    print("\n4. Update Event (Admin)")
    update_data = {
        "title": "Reunión de Prueba Actualizada",
        "description": "Descripción actualizada por test",
        "date": (today + timedelta(days=21)).isoformat()
    }
    success, response = make_request("PUT", f"/events/{test_data['event_id']}", 
                                     token=admin_token, data=update_data)
    if success:
        print_success("Event updated successfully")
    else:
        print_error("Failed to update event")
        return False
    
    # 5. Verify update
    print("\n5. Verify Event Update")
    success, response = make_request("GET", "/events", token=employee_token)
    if success and response:
        updated_event = next((e for e in response if e['_id'] == test_data['event_id']), None)
        if updated_event and updated_event['title'] == "Reunión de Prueba Actualizada":
            print_success(f"Event update confirmed: {updated_event['title']}")
        else:
            print_error("Event update not reflected")
            return False
    else:
        print_error("Failed to verify event update")
        return False
    
    # 6. Delete event (admin only)
    print("\n6. Delete Event (Admin)")
    success, response = make_request("DELETE", f"/events/{test_data['event_id']}", 
                                     token=admin_token)
    if success:
        print_success("Event deleted successfully")
    else:
        print_error("Failed to delete event")
        return False
    
    # 7. Verify deletion
    print("\n7. Verify Event Deletion")
    success, response = make_request("GET", "/events", token=employee_token)
    if success and response:
        deleted_event = next((e for e in response if e['_id'] == test_data['event_id']), None)
        if not deleted_event:
            print_success("Event deletion confirmed")
        else:
            print_error("Event still exists after deletion")
            return False
    else:
        print_error("Failed to verify event deletion")
        return False
    
    return True

# ==================== GOAL TESTS ====================

def test_goals():
    """Test commercial goals endpoints"""
    print_test("Commercial Goals")
    
    # 1. Get current month's goal
    print("\n1. Get Current Month's Goal")
    success, response = make_request("GET", "/goals", token=employee_token)
    if success and response:
        test_data['goal_id'] = response['_id']
        print_success(f"Retrieved goal - ID: {response['_id']}")
        print_success(f"Goal: ${response['goal_amount']:,.2f}, Current: ${response['current_amount']:,.2f}")
        print_success(f"Percentage: {response['percentage']}%")
    else:
        print_error("Failed to get goals")
        return False
    
    # 2. Update goal (admin only)
    print("\n2. Update Goal (Admin)")
    update_data = {
        "goal_amount": 600000.0,
        "current_amount": 400000.0
    }
    success, response = make_request("PUT", f"/goals/{test_data['goal_id']}", 
                                     token=admin_token, data=update_data)
    if success:
        print_success("Goal updated successfully")
    else:
        print_error("Failed to update goal")
        return False
    
    # 3. Verify update and percentage calculation
    print("\n3. Verify Goal Update and Percentage Calculation")
    success, response = make_request("GET", "/goals", token=employee_token)
    if success and response:
        expected_percentage = round((400000.0 / 600000.0) * 100, 2)
        if (response['goal_amount'] == 600000.0 and 
            response['current_amount'] == 400000.0 and
            abs(response['percentage'] - expected_percentage) < 0.01):
            print_success(f"Goal update confirmed: ${response['goal_amount']:,.2f}")
            print_success(f"Current: ${response['current_amount']:,.2f}")
            print_success(f"Percentage: {response['percentage']}% (expected: {expected_percentage}%)")
        else:
            print_error("Goal update or percentage calculation incorrect")
            return False
    else:
        print_error("Failed to verify goal update")
        return False
    
    # 4. Test employee cannot update goal (should fail)
    print("\n4. Test Employee Cannot Update Goal (Should Fail)")
    success, _ = make_request("PUT", f"/goals/{test_data['goal_id']}", 
                             token=employee_token, data=update_data, expected_status=403)
    if not success:
        print_success("Employee correctly denied goal update permission (403)")
    else:
        print_error("Employee was able to update goal - SECURITY ISSUE!")
        return False
    
    return True

# ==================== CAPSULE TESTS ====================

def test_capsules():
    """Test capsule CRUD endpoints"""
    print_test("Daily Capsules")
    
    # 1. Get all capsules
    print("\n1. Get All Capsules")
    success, response = make_request("GET", "/capsules", token=employee_token)
    if success and response is not None:
        print_success(f"Retrieved {len(response)} capsule(s)")
        initial_capsule_count = len(response)
    else:
        print_error("Failed to get capsules")
        return False
    
    # 2. Create capsule (any authenticated user)
    print("\n2. Create Capsule (Employee)")
    today = datetime.now().date()
    capsule_data = {
        "date": (today + timedelta(days=5)).isoformat(),
        "topic": "Prueba Automatizada de Cápsula",
        "responsible_employee_id": test_data['employee_id'],
        "description": "Cápsula creada por test automatizado"
    }
    success, response = make_request("POST", "/capsules", token=employee_token, data=capsule_data)
    if success and response:
        test_data['capsule_id'] = response['_id']
        print_success(f"Capsule created - ID: {response['_id']}")
        print_success(f"Topic: {response['topic']}")
        print_success(f"Responsible: {response['responsible_employee_name']}")
    else:
        print_error("Failed to create capsule")
        return False
    
    # 3. Update capsule
    print("\n3. Update Capsule")
    update_data = {
        "date": (today + timedelta(days=6)).isoformat(),
        "topic": "Cápsula Actualizada por Test",
        "responsible_employee_id": test_data['employee_id'],
        "description": "Descripción actualizada"
    }
    success, response = make_request("PUT", f"/capsules/{test_data['capsule_id']}", 
                                     token=employee_token, data=update_data)
    if success:
        print_success("Capsule updated successfully")
    else:
        print_error("Failed to update capsule")
        return False
    
    # 4. Verify update
    print("\n4. Verify Capsule Update")
    success, response = make_request("GET", "/capsules", token=employee_token)
    if success and response:
        updated_capsule = next((c for c in response if c['_id'] == test_data['capsule_id']), None)
        if updated_capsule and updated_capsule['topic'] == "Cápsula Actualizada por Test":
            print_success(f"Capsule update confirmed: {updated_capsule['topic']}")
        else:
            print_error("Capsule update not reflected")
            return False
    else:
        print_error("Failed to verify capsule update")
        return False
    
    # 5. Delete capsule
    print("\n5. Delete Capsule")
    success, response = make_request("DELETE", f"/capsules/{test_data['capsule_id']}", 
                                     token=employee_token)
    if success:
        print_success("Capsule deleted successfully")
    else:
        print_error("Failed to delete capsule")
        return False
    
    # 6. Verify deletion
    print("\n6. Verify Capsule Deletion")
    success, response = make_request("GET", "/capsules", token=employee_token)
    if success and response:
        deleted_capsule = next((c for c in response if c['_id'] == test_data['capsule_id']), None)
        if not deleted_capsule:
            print_success("Capsule deletion confirmed")
        else:
            print_error("Capsule still exists after deletion")
            return False
    else:
        print_error("Failed to verify capsule deletion")
        return False
    
    return True

# ==================== NOTIFICATION TESTS ====================

def test_notifications():
    """Test notification endpoints"""
    print_test("Notifications")
    
    # 1. Get notifications for employee
    print("\n1. Get Notifications (Employee)")
    success, response = make_request("GET", "/notifications", token=employee_token)
    if success and response is not None:
        print_success(f"Retrieved {len(response)} notification(s) for employee")
        if len(response) > 0:
            test_data['notification_id'] = response[0]['_id']
            print_success(f"First notification: {response[0]['title']}")
            print_success(f"Read status: {response[0]['read']}")
    else:
        print_error("Failed to get notifications")
        return False
    
    # 2. Get notifications for admin
    print("\n2. Get Notifications (Admin)")
    success, response = make_request("GET", "/notifications", token=admin_token)
    if success and response is not None:
        print_success(f"Retrieved {len(response)} notification(s) for admin")
        if len(response) > 0:
            print_success(f"First notification: {response[0]['title']}")
    else:
        print_error("Failed to get admin notifications")
        return False
    
    # 3. Mark notification as read
    if 'notification_id' in test_data:
        print("\n3. Mark Notification as Read")
        success, response = make_request("PUT", f"/notifications/{test_data['notification_id']}/read",
                                        token=employee_token)
        if success:
            print_success("Notification marked as read")
        else:
            print_error("Failed to mark notification as read")
            return False
        
        # 4. Verify notification was marked as read
        print("\n4. Verify Notification Read Status")
        success, response = make_request("GET", "/notifications", token=employee_token)
        if success and response:
            marked_notif = next((n for n in response if n['_id'] == test_data['notification_id']), None)
            if marked_notif and marked_notif['read']:
                print_success("Notification read status confirmed")
            else:
                print_error("Notification read status not updated")
                return False
        else:
            print_error("Failed to verify notification read status")
            return False
    else:
        print_warning("No notifications available to test read functionality")
    
    return True

# ==================== USER TESTS ====================

def test_users():
    """Test user endpoints"""
    print_test("User Management")
    
    # 1. Get all users
    print("\n1. Get All Users")
    success, response = make_request("GET", "/users", token=employee_token)
    if success and response:
        print_success(f"Retrieved {len(response)} user(s)")
        admin_count = sum(1 for u in response if u['role'] == 'admin')
        employee_count = sum(1 for u in response if u['role'] == 'employee')
        print_success(f"Admins: {admin_count}, Employees: {employee_count}")
    else:
        print_error("Failed to get users")
        return False
    
    # 2. Get single user
    print("\n2. Get Single User")
    success, response = make_request("GET", f"/users/{test_data['employee_id']}", 
                                     token=employee_token)
    if success and response:
        print_success(f"Retrieved user: {response['name']} - {response['position']}")
    else:
        print_error("Failed to get single user")
        return False
    
    return True

# ==================== MAIN TEST RUNNER ====================

def run_all_tests():
    """Run all test suites"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}CONACTIVOS HR APPLICATION - BACKEND API TEST SUITE{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # Run tests in order
    test_suites = [
        ("Authentication", test_authentication),
        ("Leave Requests", test_leave_requests),
        ("Dashboard", test_dashboard),
        ("Events", test_events),
        ("Goals", test_goals),
        ("Capsules", test_capsules),
        ("Notifications", test_notifications),
        ("Users", test_users),
    ]
    
    for suite_name, test_func in test_suites:
        try:
            results[suite_name] = test_func()
        except Exception as e:
            print_error(f"Test suite '{suite_name}' crashed: {str(e)}")
            results[suite_name] = False
    
    # Print summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for suite_name, result in results.items():
        status = f"{Colors.GREEN}PASSED{Colors.END}" if result else f"{Colors.RED}FAILED{Colors.END}"
        print(f"{suite_name}: {status}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    if passed == total:
        print(f"{Colors.GREEN}ALL TESTS PASSED ({passed}/{total}){Colors.END}")
    else:
        print(f"{Colors.RED}SOME TESTS FAILED ({passed}/{total} passed){Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
