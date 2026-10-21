"""Backend tests for Novedades module (formerly Permisos) + Teletrabajo type.

Covers:
- POST /api/leave-requests accepts type 'telework'
- GET /api/dashboard/novedades returns {today, upcoming} with approved-only requests
  * today: start<=today<=end
  * upcoming: start>today, sorted by start_date
- GET /api/reports/stats leaves.by_type includes 'telework'
"""
import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://workforce-app-92.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EMPLOYEE = {"email": "juan.perez@conactivos.com", "password": "employee123"}
ADMIN = {"email": "admin1@conactivos.com", "password": "admin123"}


@pytest.fixture(scope="module")
def employee_token():
    r = requests.post(f"{API}/auth/login", json=EMPLOYEE, timeout=20)
    assert r.status_code == 200, f"Login employee failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"Login admin failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----------- POST /api/leave-requests accepts 'telework' -----------
class TestLeaveRequestTelework:
    def test_create_telework_leave(self, employee_token):
        start = (datetime.utcnow().date() + timedelta(days=14)).isoformat()
        end = (datetime.utcnow().date() + timedelta(days=14)).isoformat()
        payload = {
            "type": "telework",
            "start_date": start,
            "end_date": end,
            "reason": "TEST_ telework novedad from pytest",
        }
        r = requests.post(f"{API}/leave-requests", json=payload, headers=_h(employee_token), timeout=20)
        assert r.status_code in (200, 201), f"Create telework failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("type") == "telework"
        assert body.get("status") == "pending"
        assert body.get("start_date") == start
        assert body.get("end_date") == end
        pytest.telework_id = body.get("_id") or body.get("id")

    def test_telework_listed_in_my_leaves(self, employee_token):
        r = requests.get(f"{API}/leave-requests", headers=_h(employee_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert any(l.get("type") == "telework" for l in data), "Telework leave not in my-leaves"


# ----------- Reports stats includes telework -----------
class TestReportsStatsTelework:
    def test_stats_by_type_has_telework(self, admin_token):
        r = requests.get(f"{API}/reports/stats", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, f"stats failed: {r.status_code} {r.text}"
        data = r.json()
        assert "leaves" in data and "by_type" in data["leaves"]
        by_type = data["leaves"]["by_type"]
        assert "telework" in by_type, f"'telework' missing from by_type: {by_type}"
        assert "vacation" in by_type and "medical" in by_type and "normal" in by_type
        assert isinstance(by_type["telework"], int)
        assert by_type["telework"] >= 1, "Expected at least 1 telework after test_create_telework_leave"


# ----------- Dashboard novedades endpoint -----------
class TestDashboardNovedades:
    def test_novedades_shape(self, employee_token):
        r = requests.get(f"{API}/dashboard/novedades", headers=_h(employee_token), timeout=20)
        assert r.status_code == 200, f"novedades failed: {r.status_code} {r.text}"
        data = r.json()
        assert "today" in data and "upcoming" in data
        assert isinstance(data["today"], list)
        assert isinstance(data["upcoming"], list)

    def test_novedades_only_approved(self, employee_token, admin_token):
        """All items in today+upcoming must be approved."""
        r = requests.get(f"{API}/dashboard/novedades", headers=_h(employee_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        # Fetch all leave requests via admin to cross-check status of each request_id
        r2 = requests.get(f"{API}/leave-requests", headers=_h(admin_token), timeout=20)
        assert r2.status_code == 200
        all_leaves = r2.json()
        by_id = {l.get("_id") or l.get("id"): l for l in all_leaves}
        for item in data["today"] + data["upcoming"]:
            rid = item.get("request_id")
            if rid and rid in by_id:
                assert by_id[rid]["status"] == "approved", f"Non-approved request in novedades: {rid}"

    def test_today_section_date_boundaries(self, employee_token):
        """today items must have start<=today<=end."""
        r = requests.get(f"{API}/dashboard/novedades", headers=_h(employee_token), timeout=20)
        today = datetime.utcnow().date().isoformat()
        data = r.json()
        for item in data["today"]:
            assert item["start_date"] <= today <= item["end_date"], f"Bad today item: {item}"

    def test_upcoming_section_future_and_sorted(self, employee_token):
        """upcoming items must have start > today and be sorted by start_date ascending."""
        r = requests.get(f"{API}/dashboard/novedades", headers=_h(employee_token), timeout=20)
        today = datetime.utcnow().date().isoformat()
        data = r.json()
        prev = None
        for item in data["upcoming"]:
            assert item["start_date"] > today, f"Upcoming not future: {item}"
            if prev is not None:
                assert item["start_date"] >= prev, "Upcoming not sorted ascending by start_date"
            prev = item["start_date"]

    def test_approved_telework_appears_in_upcoming(self, employee_token, admin_token):
        """Create a future telework, approve it, verify it appears in upcoming."""
        start = (datetime.utcnow().date() + timedelta(days=21)).isoformat()
        end = (datetime.utcnow().date() + timedelta(days=22)).isoformat()
        payload = {
            "type": "telework",
            "start_date": start,
            "end_date": end,
            "reason": "TEST_ future telework to approve",
        }
        r = requests.post(f"{API}/leave-requests", json=payload, headers=_h(employee_token), timeout=20)
        assert r.status_code in (200, 201), r.text
        req_id = r.json().get("_id") or r.json().get("id")
        assert req_id

        # Admin approves
        r2 = requests.put(
            f"{API}/leave-requests/{req_id}/approve",
            json={"status": "approved"},
            headers=_h(admin_token),
            timeout=20,
        )
        assert r2.status_code == 200, f"Approve failed: {r2.status_code} {r2.text}"

        # Check novedades upcoming
        r3 = requests.get(f"{API}/dashboard/novedades", headers=_h(employee_token), timeout=20)
        assert r3.status_code == 200
        upcoming = r3.json()["upcoming"]
        found = [i for i in upcoming if i.get("request_id") == req_id]
        assert found, f"Approved future telework not found in upcoming. Got: {[(i.get('request_id'), i.get('type')) for i in upcoming]}"
        assert found[0]["type"] == "telework"
        assert found[0]["start_date"] == start
        assert found[0]["end_date"] == end

    def test_novedades_requires_auth(self):
        r = requests.get(f"{API}/dashboard/novedades", timeout=20)
        assert r.status_code in (401, 403), f"Expected 401/403 unauth, got {r.status_code}"
