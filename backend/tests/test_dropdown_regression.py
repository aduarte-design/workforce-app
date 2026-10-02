"""Regression tests for dropdown fix - verify backend still feeds employee dropdown correctly."""
import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://workforce-app-92.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin1@conactivos.com", "password": "admin123"})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# GET /api/users feeds the dropdown; must return the full seeded list
def test_get_users_returns_full_list(headers):
    r = requests.get(f"{BASE_URL}/api/users", headers=headers)
    assert r.status_code == 200, r.text
    users = r.json()
    assert isinstance(users, list)
    assert len(users) >= 13, f"expected >=13 users, got {len(users)}"
    emails = [u.get("email") for u in users]
    assert "admin1@conactivos.com" in emails
    assert "juan.perez@conactivos.com" in emails
    # No _id leak as mongo ObjectId / password leak
    for u in users:
        assert "password" not in u
        assert "_id" in u and isinstance(u["_id"], str)
        assert "name" in u


# POST /api/kudos still works with payload coming from dropdown
def test_post_kudos_after_fix(headers):
    users = requests.get(f"{BASE_URL}/api/users", headers=headers).json()
    me = next(u for u in users if u["email"] == "admin1@conactivos.com")
    target = next(u for u in users if u["email"] == "juan.perez@conactivos.com")
    payload = {
        "to_user_id": target["_id"],
        "message": "TEST_dropdown_fix regression kudo",
        "category": "teamwork",
    }
    r = requests.post(f"{BASE_URL}/api/kudos", headers=headers, json=payload)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body.get("to_user_id") == target["_id"]
    assert body.get("message") == payload["message"]


# POST /api/capsules still works with payload coming from dropdown
def test_post_capsules_after_fix(headers):
    users = requests.get(f"{BASE_URL}/api/users", headers=headers).json()
    target = next(u for u in users if u["email"] == "juan.perez@conactivos.com")
    payload = {
        "date": "2026-02-15",
        "topic": "TEST_dropdown_fix regression capsule",
        "responsible_employee_id": target["_id"],
        "description": "regression test for dropdown fix",
    }
    r = requests.post(f"{BASE_URL}/api/capsules", headers=headers, json=payload)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body.get("topic") == payload["topic"]
    assert body.get("responsible_employee_id") == target["_id"]
    # cleanup
    cid = body.get("_id") or body.get("id")
    if cid:
        requests.delete(f"{BASE_URL}/api/capsules/{cid}", headers=headers)
