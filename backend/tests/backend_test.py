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
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from passlib.context import CryptContext

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



# ---------------------- Pausas Activas ----------------------
class TestPausasActivas:
    def test_list_requires_auth(self, api_client):
        r = api_client.get(f"{API}/pausas-activas")
        assert r.status_code in (401, 403), f"expected 401/403 without auth; got {r.status_code}"

    def test_random_requires_auth(self, api_client):
        r = api_client.get(f"{API}/pausas-activas/random")
        assert r.status_code in (401, 403), f"expected 401/403 without auth; got {r.status_code}"

    def test_list_returns_10_sorted(self, api_client, admin_headers):
        r = api_client.get(f"{API}/pausas-activas", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 10, f"expected 10 pausas, got {len(data)}"
        # sorted by order asc
        orders = [p["order"] for p in data]
        assert orders == sorted(orders), f"pausas not sorted asc: {orders}"
        assert orders == list(range(1, 11)), f"expected orders 1..10, got {orders}"

    def test_list_item_shape(self, api_client, admin_headers):
        r = api_client.get(f"{API}/pausas-activas", headers=admin_headers)
        data = r.json()
        required_fields = ("_id", "order", "name", "description", "focus_area",
                           "duration_seconds", "instructions", "image_base64")
        for p in data:
            for f in required_fields:
                assert f in p, f"missing field '{f}' in pausa: {p.get('name')}"
            assert isinstance(p["_id"], str)
            assert isinstance(p["order"], int)
            assert isinstance(p["name"], str) and p["name"].strip()
            assert isinstance(p["description"], str) and p["description"].strip()
            assert isinstance(p["focus_area"], str) and p["focus_area"].strip()
            assert isinstance(p["duration_seconds"], int) and p["duration_seconds"] > 0
            assert isinstance(p["instructions"], list)
            assert len(p["instructions"]) >= 3, (
                f"pausa '{p['name']}' has only {len(p['instructions'])} instructions; expected >= 3"
            )
            assert all(isinstance(step, str) and step.strip() for step in p["instructions"])
            assert isinstance(p["image_base64"], str) and p["image_base64"]
            assert p["image_base64"].startswith("data:image"), (
                f"pausa '{p['name']}' image_base64 must start with 'data:image'"
            )

    def test_random_returns_valid_pausa(self, api_client, employee_headers):
        r = api_client.get(f"{API}/pausas-activas/random", headers=employee_headers)
        assert r.status_code == 200, r.text
        p = r.json()
        assert isinstance(p, dict)
        for f in ("_id", "order", "name", "description", "focus_area",
                  "duration_seconds", "instructions", "image_base64"):
            assert f in p, f"missing field '{f}' in random pausa"
        assert 1 <= p["order"] <= 10
        assert len(p["instructions"]) >= 3
        assert p["image_base64"].startswith("data:image")

    def test_seed_does_not_touch_pausas(self, api_client, admin_headers):
        """POST /api/seed must NOT wipe pausas_activas collection."""
        # count before
        r0 = api_client.get(f"{API}/pausas-activas", headers=admin_headers)
        assert r0.status_code == 200
        before = len(r0.json())
        assert before == 10

        # re-seed (wipes users -> stale admin_headers token; re-login after)
        r_seed = api_client.post(f"{API}/seed")
        assert r_seed.status_code == 200

        # fresh admin token because seed rebuilt users with new _ids
        r_login = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r_login.status_code == 200, r_login.text
        fresh_headers = {"Authorization": f"Bearer {r_login.json()['token']}", "Content-Type": "application/json"}

        # count after must still be 10
        r1 = api_client.get(f"{API}/pausas-activas", headers=fresh_headers)
        assert r1.status_code == 200, r1.text
        after = len(r1.json())
        assert after == 10, f"seed should not touch pausas_activas; before={before} after={after}"


# ---------------------- GET /api/users bug fix (iteration 7) ----------------------
# Bug: capsules/kudos employee picker was dropping records when the DB had users
# with missing optional fields (position, role, etc.) due to strict Pydantic validation.
# Fix: /api/users now returns all users unlimited, sorted by name asc, with safe
# defaults backfilled for missing fields.
class TestGetUsersAllRecords:
    MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME = os.environ.get("DB_NAME", "test_database")

    @pytest.fixture(scope="class", autouse=True)
    def reseed(self, api_client):
        """Reseed DB to ensure a clean 13-user baseline (seed may have been called elsewhere)."""
        r = api_client.post(f"{API}/seed")
        assert r.status_code == 200

    @pytest.fixture(scope="class")
    def fresh_admin_headers(self, api_client):
        """Fresh token after reseed."""
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}

    def test_requires_auth_without_token(self, api_client):
        r = api_client.get(f"{API}/users")
        assert r.status_code in (401, 403), f"expected 401/403; got {r.status_code}"

    def test_returns_exactly_13_users(self, api_client, fresh_admin_headers):
        r = api_client.get(f"{API}/users", headers=fresh_admin_headers)
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list)
        assert len(users) == 13, f"expected 13 users (3 admins + 10 employees), got {len(users)}"
        admins = [u for u in users if u.get("role") == "admin"]
        employees = [u for u in users if u.get("role") == "employee"]
        assert len(admins) == 3
        assert len(employees) == 10

    def test_sorted_alphabetically_by_name(self, api_client, fresh_admin_headers):
        r = api_client.get(f"{API}/users", headers=fresh_admin_headers)
        names = [u["name"] for u in r.json()]
        assert names == sorted(names), f"users should be sorted by name asc; got {names}"

    def test_each_user_has_required_fields(self, api_client, fresh_admin_headers):
        r = api_client.get(f"{API}/users", headers=fresh_admin_headers)
        users = r.json()
        required = ("_id", "email", "name", "position", "role",
                    "profile_photo", "phone", "birthdate", "hire_date",
                    "is_employee_of_month")
        for u in users:
            for f in required:
                assert f in u, f"user {u.get('email')} missing key '{f}'"
            assert isinstance(u["_id"], str)
            assert isinstance(u["is_employee_of_month"], bool)
            assert "password" not in u, f"password leaked for {u.get('email')}"

    def test_legacy_user_with_missing_fields_not_dropped(self, api_client, fresh_admin_headers):
        """Insert a user directly into Mongo WITHOUT position / is_employee_of_month
        and confirm GET /api/users still returns 14 items and backfills defaults."""
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

        async def _insert_legacy():
            client = AsyncIOMotorClient(self.MONGO_URL)
            db = client[self.DB_NAME]
            # ensure clean
            await db.users.delete_many({"email": "legacy@conactivos.com"})
            await db.users.insert_one({
                "email": "legacy@conactivos.com",
                "name": "Zulma Legacy",
                "role": "employee",
                "password": pwd_ctx.hash("legacypass"),
            })
            client.close()

        async def _delete_legacy():
            client = AsyncIOMotorClient(self.MONGO_URL)
            db = client[self.DB_NAME]
            await db.users.delete_many({"email": "legacy@conactivos.com"})
            client.close()

        try:
            asyncio.run(_insert_legacy())

            r = api_client.get(f"{API}/users", headers=fresh_admin_headers)
            assert r.status_code == 200, r.text
            users = r.json()
            assert len(users) == 14, (
                f"legacy user with missing fields dropped by endpoint; got {len(users)}"
            )

            legacy = next((u for u in users if u["email"] == "legacy@conactivos.com"), None)
            assert legacy is not None, "Zulma Legacy not returned by /api/users"
            assert legacy["name"] == "Zulma Legacy"
            # backfill defaults
            assert legacy["position"] == "Empleado", f"position should default to 'Empleado'; got {legacy.get('position')!r}"
            assert legacy["is_employee_of_month"] is False
            assert legacy["profile_photo"] is None
            assert legacy["phone"] is None
            assert legacy["birthdate"] is None
            assert legacy["hire_date"] is None
            assert legacy["role"] == "employee"
            assert "password" not in legacy

            # alphabetic sort should still hold with the new entry
            names = [u["name"] for u in users]
            assert names == sorted(names), "users not sorted after legacy insert"
        finally:
            asyncio.run(_delete_legacy())

    def test_endpoint_uses_unlimited_to_list(self):
        """Grep /app/backend/server.py get_users to confirm no 1000-cap."""
        with open("/app/backend/server.py") as f:
            src = f.read()
        # locate get_users function body
        idx = src.find("async def get_users(")
        assert idx != -1, "get_users function not found"
        # take ~2000 chars after
        chunk = src[idx:idx + 2000]
        assert "to_list(length=None)" in chunk, "get_users must use to_list(length=None)"
        assert "to_list(1000)" not in chunk, "get_users still has 1000 cap"
        assert "response_model=List[UserResponse]" not in chunk, (
            "get_users should not use strict response_model that drops records"
        )

    def test_get_user_by_id_still_works(self, api_client, fresh_admin_headers):
        """Regression: /api/users/{id} still returns a single user."""
        r = api_client.get(f"{API}/users", headers=fresh_admin_headers)
        users = r.json()
        target = next(u for u in users if u["email"] == ADMIN_EMAIL)
        r2 = api_client.get(f"{API}/users/{target['_id']}", headers=fresh_admin_headers)
        assert r2.status_code == 200, r2.text
        single = r2.json()
        assert single["email"] == ADMIN_EMAIL
        assert single["_id"] == target["_id"]
        assert "password" not in single

    def test_capsules_endpoint_reachable(self, api_client, fresh_admin_headers):
        """Regression: /api/capsules still reachable (does not depend on /api/users)."""
        r = api_client.get(f"{API}/capsules", headers=fresh_admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_kudos_endpoint_reachable(self, api_client, fresh_admin_headers):
        """Regression: /api/kudos still reachable."""
        r = api_client.get(f"{API}/kudos", headers=fresh_admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_kudo_still_works_after_fix(self, api_client, fresh_admin_headers):
        """POST /api/kudos still works end-to-end (needs valid to_user_id from /users)."""
        r = api_client.post(
            f"{API}/auth/login",
            json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD},
        )
        assert r.status_code == 200
        emp_headers = {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}

        users = api_client.get(f"{API}/users", headers=fresh_admin_headers).json()
        laura = next(u for u in users if u["email"] == "laura.gomez@conactivos.com")
        r = api_client.post(
            f"{API}/kudos",
            json={"to_user_id": laura["_id"], "message": "TEST_regression_kudo", "category": "teamwork"},
            headers=emp_headers,
        )
        assert r.status_code == 200, r.text
