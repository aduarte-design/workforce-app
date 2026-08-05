"""Backend regression tests for Conactivos HR app (iteration 5).

Focus: validate bug fixes for
- /api/dashboard/birthdays (date arithmetic fix - includes today + upcoming)
- POST /api/seed idempotency + counts
- /api/dashboard/absent (Pedro Sánchez medical leave today)
- /api/goals (current month 65% completion)
- /api/dashboard/employee-of-month (Juan Pérez)
- Auth (admin + employee login)
- Leave create/approve flow
- Kudos create
- Admin-only guards (403 for employee) on /api/reports/stats, /api/events POST, /api/goals PUT
"""
import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://workforce-app-92.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin1@conactivos.com"
ADMIN_PASSWORD = "admin123"
EMPLOYEE_EMAIL = "juan.perez@conactivos.com"
EMPLOYEE_PASSWORD = "employee123"


# ---------------------- Fixtures ----------------------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def seed_db(api_client):
    """Reset database once at session start."""
    r = api_client.post(f"{API}/seed")
    assert r.status_code == 200, f"Seed failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("admins") == 3
    assert data.get("employees") == 10
    return data


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def employee_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD})
    assert r.status_code == 200, f"Employee login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def employee_headers(employee_token):
    return {"Authorization": f"Bearer {employee_token}", "Content-Type": "application/json"}


# ---------------------- Auth ----------------------
class TestAuth:
    def test_admin_login(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert "token" in data

    def test_employee_login(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "employee"
        assert data["user"]["name"] == "Juan Pérez"

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self, api_client, admin_headers):
        r = api_client.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------------------- Seed / Counts ----------------------
class TestSeedCounts:
    def test_users_count(self, api_client, admin_headers):
        r = api_client.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        admins = [u for u in users if u["role"] == "admin"]
        employees = [u for u in users if u["role"] == "employee"]
        assert len(admins) == 3, f"expected 3 admins, got {len(admins)}"
        assert len(employees) == 10, f"expected 10 employees, got {len(employees)}"

    def test_leaves_count(self, api_client, admin_headers):
        r = api_client.get(f"{API}/leave-requests", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_events_count(self, api_client, admin_headers):
        r = api_client.get(f"{API}/events", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_capsules_count(self, api_client, admin_headers):
        r = api_client.get(f"{API}/capsules", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_kudos_count(self, api_client, admin_headers):
        r = api_client.get(f"{API}/kudos", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) == 6


# ---------------------- Dashboard ----------------------
class TestDashboard:
    def test_birthdays_shape(self, api_client, admin_headers):
        r = api_client.get(f"{API}/dashboard/birthdays", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert "today" in data and "upcoming" in data
        assert isinstance(data["today"], list)
        assert isinstance(data["upcoming"], list)

    def test_birthdays_today_includes_juan(self, api_client, admin_headers):
        """Fix validation: seed sets Juan Pérez birthday to today via _bday(1992, 0)."""
        r = api_client.get(f"{API}/dashboard/birthdays", headers=admin_headers)
        data = r.json()
        today_names = [u["name"] for u in data["today"]]
        assert "Juan Pérez" in today_names, f"Juan Pérez should be birthday-today; got today={today_names}"

    def test_birthdays_upcoming_days_positive(self, api_client, admin_headers):
        """Fix validation: days_until must be > 0 (was returning 0 for tomorrow-birthdays previously)."""
        r = api_client.get(f"{API}/dashboard/birthdays", headers=admin_headers)
        data = r.json()
        assert len(data["upcoming"]) >= 3, f"Expected at least Laura (3d), Pedro (8d), Sofía (15d), Miguel (22d) upcoming; got {len(data['upcoming'])}"
        for entry in data["upcoming"]:
            assert entry["days_until"] > 0, f"days_until must be > 0, got {entry}"
            assert entry["days_until"] <= 30
        # Verify Laura Gómez (3 days), Pedro (8), Sofía (15), Miguel (22) are in upcoming
        names = [u["name"] for u in data["upcoming"]]
        for expected in ("Laura Gómez", "Pedro Sánchez", "Sofía López", "Miguel Torres"):
            assert expected in names, f"{expected} should be in upcoming birthdays; got {names}"

    def test_birthdays_upcoming_sorted(self, api_client, admin_headers):
        r = api_client.get(f"{API}/dashboard/birthdays", headers=admin_headers)
        data = r.json()
        days = [u["days_until"] for u in data["upcoming"]]
        assert days == sorted(days), f"upcoming must be sorted by days_until: {days}"

    def test_absent_pedro_medical(self, api_client, admin_headers):
        r = api_client.get(f"{API}/dashboard/absent", headers=admin_headers)
        assert r.status_code == 200
        absent = r.json()
        assert isinstance(absent, list)
        pedro = [a for a in absent if a.get("name") == "Pedro Sánchez"]
        assert len(pedro) == 1, f"Expected Pedro Sánchez absent today with medical; got {absent}"
        assert pedro[0]["type"] == "medical"

    def test_employee_of_month_juan(self, api_client, admin_headers):
        r = api_client.get(f"{API}/dashboard/employee-of-month", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["name"] == "Juan Pérez"
        assert data["is_employee_of_month"] is True
        assert "_id" in data
        assert isinstance(data["_id"], str)  # not raw ObjectId

    def test_no_password_leak(self, api_client, admin_headers):
        r = api_client.get(f"{API}/dashboard/employee-of-month", headers=admin_headers)
        data = r.json()
        assert "password" not in data


# ---------------------- Goals ----------------------
class TestGoals:
    def test_current_month_goal_65pct(self, api_client, admin_headers):
        r = api_client.get(f"{API}/goals", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        now = datetime.utcnow()
        assert data["month"] == now.month
        assert data["year"] == now.year
        assert data["goal_amount"] == 500000.0
        assert data["current_amount"] == 325000.0
        assert data["percentage"] == 65.0


# ---------------------- Leave create/approve flow ----------------------
class TestLeaveFlow:
    def test_full_flow(self, api_client, employee_headers, admin_headers):
        payload = {
            "type": "normal",
            "start_date": "2030-01-01",
            "end_date": "2030-01-02",
            "reason": "TEST_leave_flow"
        }
        # 1) Employee creates leave
        r = api_client.post(f"{API}/leave-requests", json=payload, headers=employee_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["status"] == "pending"
        leave_id = created["_id"]
        assert isinstance(leave_id, str)

        # 2) Admin approves
        r = api_client.put(
            f"{API}/leave-requests/{leave_id}/approve",
            json={"status": "approved"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text

        # 3) Employee fetches and sees approved
        r = api_client.get(f"{API}/leave-requests/{leave_id}", headers=employee_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    def test_employee_cannot_approve(self, api_client, employee_headers):
        # Fetch any leave to try approving
        r = api_client.get(f"{API}/leave-requests", headers=employee_headers)
        assert r.status_code == 200
        leaves = r.json()
        if leaves:
            leave_id = leaves[0]["_id"]
            r = api_client.put(
                f"{API}/leave-requests/{leave_id}/approve",
                json={"status": "approved"},
                headers=employee_headers,
            )
            assert r.status_code == 403


# ---------------------- Kudos ----------------------
class TestKudos:
    def test_create_kudo(self, api_client, employee_headers, admin_headers):
        # Get another user id
        r = api_client.get(f"{API}/users", headers=admin_headers)
        users = r.json()
        other = next(u for u in users if u["email"] == "laura.gomez@conactivos.com")
        payload = {
            "to_user_id": other["_id"],
            "message": "TEST_kudo great work!",
            "category": "teamwork"
        }
        r = api_client.post(f"{API}/kudos", json=payload, headers=employee_headers)
        assert r.status_code == 200, r.text
        kudo = r.json()
        assert kudo["to_user_name"] == "Laura Gómez"
        assert kudo["from_user_name"] == "Juan Pérez"
        assert kudo["category"] == "teamwork"

    def test_cannot_kudo_self(self, api_client, employee_headers):
        # Fetch juan's id
        r = api_client.get(f"{API}/auth/me", headers=employee_headers)
        juan_id = r.json()["_id"]
        r = api_client.post(
            f"{API}/kudos",
            json={"to_user_id": juan_id, "message": "self kudo", "category": "teamwork"},
            headers=employee_headers,
        )
        assert r.status_code == 400


# ---------------------- Admin-only guards ----------------------
class TestAdminGuards:
    def test_reports_stats_admin_ok(self, api_client, admin_headers):
        r = api_client.get(f"{API}/reports/stats", headers=admin_headers)
        assert r.status_code == 200
        stats = r.json()
        assert "employees" in stats
        assert "leaves" in stats
        assert "kudos" in stats

    def test_reports_stats_employee_forbidden(self, api_client, employee_headers):
        r = api_client.get(f"{API}/reports/stats", headers=employee_headers)
        assert r.status_code == 403

    def test_events_post_employee_forbidden(self, api_client, employee_headers):
        r = api_client.post(
            f"{API}/events",
            json={"title": "TEST_event", "description": "x", "date": "2030-01-01"},
            headers=employee_headers,
        )
        assert r.status_code == 403

    def test_events_post_admin_ok(self, api_client, admin_headers):
        r = api_client.post(
            f"{API}/events",
            json={"title": "TEST_event_admin", "description": "x", "date": "2030-01-01"},
            headers=admin_headers,
        )
        assert r.status_code == 200

    def test_goals_put_employee_forbidden(self, api_client, employee_headers, admin_headers):
        r = api_client.get(f"{API}/goals", headers=admin_headers)
        goal_id = r.json()["_id"]
        r = api_client.put(
            f"{API}/goals/{goal_id}",
            json={"current_amount": 400000.0},
            headers=employee_headers,
        )
        assert r.status_code == 403

    def test_unauthenticated_401(self, api_client):
        r = api_client.get(f"{API}/reports/stats")
        assert r.status_code in (401, 403)
