"""SEC-002/003/004 + hardening tests for CIRCLE.

Focus: membership enforcement, upload validation, safe search, password rule,
message length, security headers, and (LAST) auth rate-limit.
"""
import base64
import io
import os
import time
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "http://localhost:8001").rstrip("/")

PASS = "demo1234"

# 1x1 transparent PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _login(email: str) -> tuple[str, dict]:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PASS}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"]


@pytest.fixture(scope="module")
def demo0():
    tok, u = _login("demo0@circle.demo")
    return {"tok": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def demo1():
    tok, u = _login("demo1@circle.demo")
    return {"tok": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def demo2():
    tok, u = _login("demo2@circle.demo")
    return {"tok": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


# ---------------------- SEC-002: membership enforcement ----------------------
class TestMembershipEnforcement:
    def test_group_preview_but_messages_blocked(self, demo0):
        r = requests.get(f"{BASE_URL}/api/circles", headers=demo0["h"], timeout=15)
        assert r.status_code == 200
        circles = r.json()["circles"]
        # non-lounge, non-dm, not already member
        target = next(
            (c for c in circles if not c.get("is_member") and c.get("type") != "dm" and not c.get("is_lounge")),
            None,
        )
        if not target:
            # Create one from demo1's perspective so demo0 is not a member
            tok1, u1 = _login("demo1@circle.demo")
            h1 = {"Authorization": f"Bearer {tok1}", "Content-Type": "application/json"}
            r2 = requests.post(
                f"{BASE_URL}/api/circles",
                headers=h1,
                json={"name": f"TEST Sec {uuid.uuid4().hex[:6]}", "member_ids": []},
                timeout=15,
            )
            assert r2.status_code == 200, r2.text
            cid = r2.json()["circle"]["id"]
        else:
            cid = target["id"]

        # preview allowed
        rc = requests.get(f"{BASE_URL}/api/circles/{cid}", headers=demo0["h"], timeout=15)
        assert rc.status_code == 200, rc.text
        assert rc.json()["circle"]["is_member"] is False

        # messages blocked
        rm = requests.get(f"{BASE_URL}/api/circles/{cid}/messages", headers=demo0["h"], timeout=15)
        assert rm.status_code == 403, f"expected 403 got {rm.status_code} {rm.text}"

        # join
        rj = requests.post(f"{BASE_URL}/api/circles/{cid}/join", headers=demo0["h"], timeout=15)
        assert rj.status_code == 200

        # now messages OK
        rm2 = requests.get(f"{BASE_URL}/api/circles/{cid}/messages", headers=demo0["h"], timeout=15)
        assert rm2.status_code == 200

    def test_dm_is_private_to_third_party(self, demo0, demo1, demo2):
        # ensure demo0 <-> demo1 DM exists (accept duplicates gracefully)
        h0 = {**demo0["h"], "Content-Type": "application/json"}
        h1 = {**demo1["h"], "Content-Type": "application/json"}
        r1 = requests.post(f"{BASE_URL}/api/connections/{demo1['user']['id']}", headers=h0, timeout=15)
        assert r1.status_code in (200, 400), r1.text
        r2 = requests.post(f"{BASE_URL}/api/connections/{demo0['user']['id']}", headers=h1, timeout=15)
        assert r2.status_code in (200, 400)

        # find dm circle for demo0 with demo1
        rd = requests.get(f"{BASE_URL}/api/circles?dm=true", headers=demo0["h"], timeout=15)
        assert rd.status_code == 200
        dm = next(
            (c for c in rd.json()["circles"] if demo1["user"]["id"] in c["member_ids"]),
            None,
        )
        assert dm, "DM circle demo0<->demo1 not found"
        dm_id = dm["id"]

        # third-party demo2: get 404
        r3g = requests.get(f"{BASE_URL}/api/circles/{dm_id}", headers=demo2["h"], timeout=15)
        assert r3g.status_code == 404, f"expected 404 got {r3g.status_code} {r3g.text}"
        r3m = requests.get(f"{BASE_URL}/api/circles/{dm_id}/messages", headers=demo2["h"], timeout=15)
        assert r3m.status_code == 403, f"expected 403 got {r3m.status_code} {r3m.text}"

        # members can read/send
        rmem = requests.get(f"{BASE_URL}/api/circles/{dm_id}/messages", headers=demo0["h"], timeout=15)
        assert rmem.status_code == 200
        rsend = requests.post(
            f"{BASE_URL}/api/circles/{dm_id}/messages",
            headers={**h0},
            json={"content": f"TEST dm hi {uuid.uuid4().hex[:4]}"},
            timeout=15,
        )
        assert rsend.status_code == 200
        rmem1 = requests.get(f"{BASE_URL}/api/circles/{dm_id}/messages", headers=demo1["h"], timeout=15)
        assert rmem1.status_code == 200


# ---------------------- SEC-003: upload validation ----------------------
class TestUploadValidation:
    def test_reject_non_image(self, demo0):
        files = {"file": ("evil.html", b"<html>x</html>", "text/html")}
        r = requests.post(f"{BASE_URL}/api/upload", headers=demo0["h"], files=files, timeout=20)
        assert r.status_code == 415, f"expected 415 got {r.status_code} {r.text}"

    def test_accept_png_and_download_with_headers(self, demo0):
        files = {"file": ("pixel.png", PNG_BYTES, "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", headers=demo0["h"], files=files, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("path") and j.get("url", "").startswith("/api/files/")

        # download with token query param
        dl_url = f"{BASE_URL}{j['url']}?token={demo0['tok']}"
        r2 = requests.get(dl_url, timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/png")
        assert r2.headers.get("x-content-type-options", "").lower() == "nosniff"

    def test_download_requires_auth(self, demo0):
        # upload one first
        files = {"file": ("pixel.png", PNG_BYTES, "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", headers=demo0["h"], files=files, timeout=30)
        assert r.status_code == 200
        url = r.json()["url"]
        # no token
        r2 = requests.get(f"{BASE_URL}{url}", timeout=15)
        assert r2.status_code == 401


# ---------------------- SEC-004: search safety ----------------------
class TestSearchSafety:
    @pytest.mark.parametrize(
        "path,q",
        [
            ("/api/events", "(a+)+$"),
            ("/api/users", ".*"),
            ("/api/recommendations", "["),
        ],
    )
    def test_regex_literal(self, demo0, path, q):
        r = requests.get(f"{BASE_URL}{path}", headers=demo0["h"], params={"q": q}, timeout=15)
        assert r.status_code == 200, f"{path} q={q!r} -> {r.status_code} {r.text[:120]}"

    def test_q_too_long_422(self, demo0):
        long_q = "a" * 81
        for p in ("/api/events", "/api/users", "/api/recommendations"):
            r = requests.get(f"{BASE_URL}{p}", headers=demo0["h"], params={"q": long_q}, timeout=15)
            assert r.status_code == 422, f"{p} -> {r.status_code} {r.text[:120]}"


# ---------------------- Hardening ----------------------
class TestHardening:
    def test_signup_short_password_422(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "first_name": "T",
                "last_name": "U",
                "email": f"test_short_{uuid.uuid4().hex[:6]}@test.demo",
                "password": "short",
                "date_of_birth": "2003-01-01",
            },
            timeout=15,
        )
        assert r.status_code == 422, f"got {r.status_code} {r.text}"

    def test_signup_valid_password_and_me(self):
        email = f"test_pw_{uuid.uuid4().hex[:6]}@test.demo"
        r = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "first_name": "T",
                "last_name": "U",
                "email": email,
                "password": "abcdefgh",
                "date_of_birth": "2003-01-01",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r2.status_code == 200
        # public_user() intentionally omits email; verify identity via id round-trip
        assert r2.json()["user"]["id"] == r.json()["user"]["id"]

    def test_message_length_cap(self, demo0):
        # find a circle demo0 is a member of
        r = requests.get(f"{BASE_URL}/api/circles?mine=true", headers=demo0["h"], timeout=15)
        assert r.status_code == 200
        circles = r.json()["circles"]
        assert circles, "demo0 has no mine circles"
        cid = circles[0]["id"]
        # 2001 chars -> 422
        big = "x" * 2001
        r1 = requests.post(
            f"{BASE_URL}/api/circles/{cid}/messages",
            headers={**demo0["h"], "Content-Type": "application/json"},
            json={"content": big},
            timeout=15,
        )
        assert r1.status_code == 422, f"got {r1.status_code} {r1.text}"
        # normal ok
        r2 = requests.post(
            f"{BASE_URL}/api/circles/{cid}/messages",
            headers={**demo0["h"], "Content-Type": "application/json"},
            json={"content": "TEST normal message"},
            timeout=15,
        )
        assert r2.status_code == 200

    def test_security_headers_on_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200
        h = {k.lower(): v for k, v in r.headers.items()}
        assert h.get("x-content-type-options", "").lower() == "nosniff"
        assert h.get("x-frame-options", "").upper() == "DENY"
        assert h.get("referrer-policy", "").lower() == "no-referrer"


# ---------------------- REGRESSION (quick) ----------------------
class TestRegression:
    def test_matches(self, demo0):
        r = requests.get(f"{BASE_URL}/api/matches", headers=demo0["h"], timeout=15)
        assert r.status_code == 200

    def test_events(self, demo0):
        r = requests.get(f"{BASE_URL}/api/events", headers=demo0["h"], timeout=15)
        assert r.status_code == 200
        eid = r.json()["events"][0]["id"]
        r2 = requests.get(f"{BASE_URL}/api/events/{eid}/attendees", headers=demo0["h"], timeout=15)
        assert r2.status_code == 200

    def test_circles_mine(self, demo0):
        r = requests.get(f"{BASE_URL}/api/circles?mine=true", headers=demo0["h"], timeout=15)
        assert r.status_code == 200

    def test_lounge_unlocked_for_demo0(self, demo0):
        r = requests.get(f"{BASE_URL}/api/lounge", headers=demo0["h"], timeout=15)
        assert r.status_code == 200
        assert r.json()["locked"] is False

    def test_digest(self, demo0):
        r = requests.get(f"{BASE_URL}/api/digest/weekend", headers=demo0["h"], timeout=15)
        assert r.status_code == 200

    def test_reminders(self, demo0):
        r = requests.get(f"{BASE_URL}/api/reminders", headers=demo0["h"], timeout=15)
        assert r.status_code == 200

    def test_connections(self, demo0):
        r = requests.get(f"{BASE_URL}/api/connections", headers=demo0["h"], timeout=15)
        assert r.status_code == 200


# ---------------------- Rate limit (MUST be last) ----------------------
@pytest.mark.order("last")
class TestZZZRateLimit:
    """Runs last (alphabetical / -k order). 30 fails/min/IP -> 31st = 429."""

    def test_login_rate_limit(self):
        got_429 = False
        for i in range(45):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": f"rl_{uuid.uuid4().hex[:4]}@x.demo", "password": "wrong"},
                timeout=10,
            )
            if r.status_code == 429:
                got_429 = True
                break
        assert got_429, "expected 429 within 45 attempts"
