"""Backend tests for new features: file upload/download, leave attachment, and kudos monthly ranking."""
import os
import io
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://workforce-app-92.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EMP_EMAIL = "juan.perez@conactivos.com"
EMP_PASS = "employee123"
OTHER_EMP_EMAIL = "laura.gomez@conactivos.com"
OTHER_EMP_PASS = "employee123"
ADMIN_EMAIL = "admin1@conactivos.com"
ADMIN_PASS = "admin123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"], data["user"]


@pytest.fixture(scope="module")
def employee_token():
    tok, _ = _login(EMP_EMAIL, EMP_PASS)
    return tok


@pytest.fixture(scope="module")
def other_token():
    tok, _ = _login(OTHER_EMP_EMAIL, OTHER_EMP_PASS)
    return tok


@pytest.fixture(scope="module")
def admin_token():
    tok, _ = _login(ADMIN_EMAIL, ADMIN_PASS)
    return tok


# ---- Minimal valid PNG (1x1) ----
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
    "890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)
PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


# ---- Upload tests ----

class TestUpload:
    def test_upload_requires_auth(self):
        files = {"file": ("x.png", PNG_BYTES, "image/png")}
        r = requests.post(f"{API}/upload", files=files, timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_upload_png_success(self, employee_token):
        files = {"file": ("photo.png", PNG_BYTES, "image/png")}
        r = requests.post(
            f"{API}/upload", files=files,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "file_id" in data and data["file_id"]
        assert data["filename"] == "photo.png"
        assert data["content_type"] == "image/png"
        assert data["size"] == len(PNG_BYTES)
        pytest.file_id_png = data["file_id"]

    def test_upload_pdf_success(self, employee_token):
        files = {"file": ("doc.pdf", PDF_BYTES, "application/pdf")}
        r = requests.post(
            f"{API}/upload", files=files,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["content_type"] == "application/pdf"
        pytest.file_id_pdf = data["file_id"]

    def test_upload_rejects_txt(self, employee_token):
        files = {"file": ("hello.txt", b"hello", "text/plain")}
        r = requests.post(
            f"{API}/upload", files=files,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=30,
        )
        assert r.status_code == 400, r.text

    def test_upload_rejects_oversize(self, employee_token):
        # 5MB + 1 byte of PDF content
        big = b"%PDF-" + (b"A" * (5 * 1024 * 1024))
        files = {"file": ("big.pdf", big, "application/pdf")}
        r = requests.post(
            f"{API}/upload", files=files,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=120,
        )
        assert r.status_code == 413, f"expected 413 got {r.status_code} {r.text[:200]}"


# ---- File access tests ----

class TestFileAccess:
    def test_owner_can_download_with_bearer(self, employee_token):
        fid = getattr(pytest, "file_id_png", None)
        assert fid, "upload test must run first"
        r = requests.get(
            f"{API}/files/{fid}",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.content == PNG_BYTES
        assert "image/png" in r.headers.get("content-type", "").lower()

    def test_owner_can_download_with_query_token(self, employee_token):
        fid = getattr(pytest, "file_id_png", None)
        r = requests.get(f"{API}/files/{fid}?token={employee_token}", timeout=30)
        assert r.status_code == 200
        assert r.content == PNG_BYTES

    def test_no_auth_returns_401(self):
        fid = getattr(pytest, "file_id_png", None)
        r = requests.get(f"{API}/files/{fid}", timeout=20)
        assert r.status_code in (401, 403)

    def test_other_employee_forbidden(self, other_token):
        fid = getattr(pytest, "file_id_png", None)
        r = requests.get(
            f"{API}/files/{fid}",
            headers={"Authorization": f"Bearer {other_token}"}, timeout=20,
        )
        assert r.status_code == 403, r.text

    def test_admin_can_download(self, admin_token):
        fid = getattr(pytest, "file_id_png", None)
        r = requests.get(
            f"{API}/files/{fid}",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=20,
        )
        assert r.status_code == 200


# ---- Leave request with attachment ----

class TestLeaveWithAttachment:
    def test_create_leave_with_valid_attachment(self, employee_token):
        fid = getattr(pytest, "file_id_pdf", None)
        payload = {
            "type": "medical",
            "start_date": "2026-02-10",
            "end_date": "2026-02-10",
            "reason": "TEST_ medical with pdf",
            "attachment_id": fid,
        }
        r = requests.post(
            f"{API}/leave-requests", json=payload,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "attachment" in data, "attachment missing in response"
        att = data["attachment"]
        assert att["file_id"] == fid
        assert att["filename"] == "doc.pdf"
        assert att["content_type"] == "application/pdf"
        assert att["size"] == len(PDF_BYTES)
        pytest.leave_id = data["_id"]

        # Verify persistence
        r2 = requests.get(
            f"{API}/leave-requests/{pytest.leave_id}",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert r2.status_code == 200
        assert r2.json().get("attachment", {}).get("file_id") == fid

    def test_create_leave_without_attachment_still_works(self, employee_token):
        payload = {
            "type": "normal",
            "start_date": "2026-03-10",
            "end_date": "2026-03-10",
            "reason": "TEST_ no attachment",
        }
        r = requests.post(
            f"{API}/leave-requests", json=payload,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert "attachment" not in r.json() or r.json().get("attachment") is None

    def test_other_users_attachment_returns_404(self, other_token):
        """Another user cannot use someone else's attachment_id."""
        fid = getattr(pytest, "file_id_pdf", None)
        payload = {
            "type": "medical",
            "start_date": "2026-04-10",
            "end_date": "2026-04-10",
            "reason": "TEST_ steal attachment",
            "attachment_id": fid,
        }
        r = requests.post(
            f"{API}/leave-requests", json=payload,
            headers={"Authorization": f"Bearer {other_token}"}, timeout=20,
        )
        assert r.status_code == 404, f"expected 404 got {r.status_code} {r.text}"

    def test_invalid_attachment_id(self, employee_token):
        payload = {
            "type": "normal",
            "start_date": "2026-04-10",
            "end_date": "2026-04-10",
            "reason": "TEST_ invalid",
            "attachment_id": "not-an-objectid",
        }
        r = requests.post(
            f"{API}/leave-requests", json=payload,
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert r.status_code == 400, r.text


# ---- Kudos ranking ----

class TestKudosRanking:
    def test_default_current_month(self, employee_token):
        r = requests.get(
            f"{API}/kudos/ranking",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        now = datetime.utcnow()
        assert data["month"] == f"{now.year:04d}-{now.month:02d}"
        assert isinstance(data["total_likes"], int)
        assert isinstance(data["ranking"], list)
        assert len(data["ranking"]) <= 10
        for i, entry in enumerate(data["ranking"]):
            assert entry["rank"] == i + 1
            assert "user_id" in entry
            assert "name" in entry
            assert "count" in entry
            assert "position" in entry
            assert "profile_photo" in entry

    def test_specific_month(self, employee_token):
        r = requests.get(
            f"{API}/kudos/ranking?month=2026-01",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["month"] == "2026-01"

    def test_invalid_month_returns_400(self, employee_token):
        r = requests.get(
            f"{API}/kudos/ranking?month=bad-format",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert r.status_code == 400, r.text

    def test_ranking_requires_auth(self):
        r = requests.get(f"{API}/kudos/ranking", timeout=20)
        assert r.status_code in (401, 403)

    def test_ranking_refreshes_after_like(self, employee_token):
        # Get users to find a target
        rusers = requests.get(
            f"{API}/users", headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert rusers.status_code == 200
        users = rusers.json()
        me = next(u for u in users if u["email"] == EMP_EMAIL)
        target = next(u for u in users if u["email"] == OTHER_EMP_EMAIL)

        # Baseline count for target
        r0 = requests.get(
            f"{API}/kudos/ranking",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        baseline = next(
            (e["count"] for e in r0.json()["ranking"] if e["user_id"] == target["_id"]), 0
        )

        # Send a like
        rl = requests.post(
            f"{API}/kudos",
            json={"to_user_id": target["_id"], "message": "TEST_ ranking refresh", "category": "teamwork"},
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        assert rl.status_code == 200, rl.text

        # Re-query ranking
        r1 = requests.get(
            f"{API}/kudos/ranking",
            headers={"Authorization": f"Bearer {employee_token}"}, timeout=20,
        )
        new_count = next(
            (e["count"] for e in r1.json()["ranking"] if e["user_id"] == target["_id"]), 0
        )
        assert new_count == baseline + 1, f"expected {baseline + 1}, got {new_count}"
