"""Backend regression tests for Conactivos HR app.

Covers:
- Auth (email/password login, /auth/me, /auth/session Google Auth error path)
- Dashboard endpoints (absent, birthdays, employee-of-month)
- Content endpoints (goals, capsules, kudos, leave-requests)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://workforce-app-92.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin1@conactivos.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    """Login as admin and return JWT."""
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    assert "token" in data, f"No token in response: {data}"
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ------------------- Auth -------------------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_auth_me(self, api_client, auth_headers):
        r = api_client.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL

    def test_auth_session_invalid_session_id(self, api_client):
        """New Google Auth endpoint - invalid session_id must return 401."""
        r = api_client.post(f"{API}/auth/session", json={"session_id": "invalid-session-id-xyz-nonexistent"})
        assert r.status_code == 401, f"Expected 401 for invalid session, got {r.status_code}: {r.text}"

    def test_auth_session_missing_field(self, api_client):
        r = api_client.post(f"{API}/auth/session", json={})
        assert r.status_code in (400, 422)


# ------------------- Dashboard -------------------
class TestDashboard:
    def test_absent(self, api_client, auth_headers):
        r = api_client.get(f"{API}/dashboard/absent", headers=auth_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_birthdays(self, api_client, auth_headers):
        r = api_client.get(f"{API}/dashboard/birthdays", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # It could be dict or list depending on impl; accept either
        assert isinstance(data, (list, dict))

    def test_employee_of_month(self, api_client, auth_headers):
        r = api_client.get(f"{API}/dashboard/employee-of-month", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Could be None or object
        if data:
            assert "name" in data or "email" in data


# ------------------- Content -------------------
class TestContent:
    def test_goals(self, api_client, auth_headers):
        r = api_client.get(f"{API}/goals", headers=auth_headers)
        assert r.status_code == 200, r.text
        # Endpoint returns current-month goal object (or list of goals depending on impl)
        data = r.json()
        assert isinstance(data, (list, dict))
        if isinstance(data, dict):
            # Current-month goal shape
            assert "goal_amount" in data or "month" in data

    def test_capsules(self, api_client, auth_headers):
        r = api_client.get(f"{API}/capsules", headers=auth_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_kudos(self, api_client, auth_headers):
        r = api_client.get(f"{API}/kudos", headers=auth_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_leave_requests(self, api_client, auth_headers):
        r = api_client.get(f"{API}/leave-requests", headers=auth_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_no_mongo_id_leak(self, api_client, auth_headers):
        """Verify responses don't leak raw MongoDB _id ObjectId serialization issues."""
        r = api_client.get(f"{API}/kudos", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        if items:
            first = items[0]
            # _id may be str-serialized, but must not be a raw ObjectId dict
            if "_id" in first:
                assert isinstance(first["_id"], str)
