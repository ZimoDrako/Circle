"""CIRCLE new-feature backend tests: connections/DMs, weekend digest, reminders, verified lounge."""
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    BASE_URL = "http://localhost:8001"

PASS = "demo1234"
LA = ZoneInfo("America/Los_Angeles")


# ---------- helpers ----------
def login(email: str) -> tuple[str, dict]:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PASS}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"]


def auth_h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def demo_users():
    """Login demo0..demo3 and return their tokens/users."""
    out = {}
    for i in range(4):
        email = f"demo{i}@circle.demo"
        tok, u = login(email)
        out[i] = {"token": tok, "user": u, "auth": auth_h(tok)}
    return out


# =========================================================================
# Connections + DM circles
# =========================================================================
class TestConnections:
    def test_self_connect_400(self, demo_users):
        me = demo_users[0]
        r = requests.post(f"{BASE_URL}/api/connections/{me['user']['id']}", headers=me["auth"])
        assert r.status_code == 400

    def test_pending_out_then_mutual_connect(self, demo_users):
        d0, d1 = demo_users[0], demo_users[1]
        # demo0 -> demo1: pending
        r = requests.post(f"{BASE_URL}/api/connections/{d1['user']['id']}", headers=d0["auth"])
        assert r.status_code == 200, r.text
        conn = r.json()["connection"]
        assert conn["status"] == "pending_out"
        assert conn["circle_id"] is None

        # demo1 sees pending_in on demo0's user detail
        r2 = requests.get(f"{BASE_URL}/api/users/{d0['user']['id']}", headers=d1["auth"])
        assert r2.status_code == 200
        assert r2.json()["connection"]["status"] == "pending_in"

        # demo1 sees 1 incoming
        r3 = requests.get(f"{BASE_URL}/api/connections", headers=d1["auth"])
        assert r3.status_code == 200
        j3 = r3.json()
        assert any(c["user"]["id"] == d0["user"]["id"] for c in j3["incoming"]), j3

        # mutual tap: demo1 -> demo0 accepts + creates DM
        r4 = requests.post(f"{BASE_URL}/api/connections/{d0['user']['id']}", headers=d1["auth"])
        assert r4.status_code == 200, r4.text
        conn2 = r4.json()["connection"]
        assert conn2["status"] == "connected"
        assert conn2["circle_id"]
        dm_id = conn2["circle_id"]

        # GET circle -> type=dm, name = other user's full name
        r5 = requests.get(f"{BASE_URL}/api/circles/{dm_id}", headers=d0["auth"])
        assert r5.status_code == 200
        c = r5.json()["circle"]
        assert c["type"] == "dm"
        expected_name_for_d0 = f"{d1['user']['first_name']} {d1['user']['last_name']}"
        assert c["name"] == expected_name_for_d0, c

        # d1 view -> name is d0's name
        r5b = requests.get(f"{BASE_URL}/api/circles/{dm_id}", headers=d1["auth"])
        assert r5b.status_code == 200
        expected_name_for_d1 = f"{d0['user']['first_name']} {d0['user']['last_name']}"
        assert r5b.json()["circle"]["name"] == expected_name_for_d1

        # /circles?dm=true lists it
        r6 = requests.get(f"{BASE_URL}/api/circles?dm=true", headers=d0["auth"])
        assert r6.status_code == 200
        dms = r6.json()["circles"]
        assert any(x["id"] == dm_id and x["type"] == "dm" for x in dms), [x["id"] for x in dms]

        # /circles?mine=true does NOT include DM
        r7 = requests.get(f"{BASE_URL}/api/circles?mine=true", headers=d0["auth"])
        assert r7.status_code == 200
        assert all(x["id"] != dm_id for x in r7.json()["circles"])

        # Both members can post messages
        r8 = requests.post(f"{BASE_URL}/api/circles/{dm_id}/messages", headers=d0["auth"], json={"content": "hey d1"})
        assert r8.status_code == 200
        r9 = requests.post(f"{BASE_URL}/api/circles/{dm_id}/messages", headers=d1["auth"], json={"content": "hi d0"})
        assert r9.status_code == 200

        # 3rd user cannot join
        d2 = demo_users[2]
        r10 = requests.post(f"{BASE_URL}/api/circles/{dm_id}/join", headers=d2["auth"])
        assert r10.status_code == 403

        # System welcome msg present
        r11 = requests.get(f"{BASE_URL}/api/circles/{dm_id}/messages", headers=d0["auth"])
        msgs = r11.json()["messages"]
        assert any(m.get("system") and "connected" in m.get("content", "").lower() for m in msgs), msgs

    def test_explicit_accept_and_decline_paths(self, demo_users):
        d2, d3 = demo_users[2], demo_users[3]
        # demo2 -> demo3
        r = requests.post(f"{BASE_URL}/api/connections/{d3['user']['id']}", headers=d2["auth"])
        assert r.status_code == 200
        conn = r.json()["connection"]
        assert conn["status"] == "pending_out"
        cid = conn["id"]

        # demo3 sees incoming
        r2 = requests.get(f"{BASE_URL}/api/connections", headers=d3["auth"])
        incoming = r2.json()["incoming"]
        match = next((x for x in incoming if x["id"] == cid), None)
        assert match, incoming
        assert match["user"]["id"] == d2["user"]["id"]

        # accept
        r3 = requests.post(f"{BASE_URL}/api/connections/{cid}/accept", headers=d3["auth"])
        assert r3.status_code == 200, r3.text
        acc = r3.json()["connection"]
        assert acc["status"] == "connected" and acc["circle_id"]

        # Now decline path: create a fresh request demo0 -> demo3 won't work (already connected via prev test).
        # Use demo0 as requester to a fresh, non-connected pair: pick demo0->demo2? demo0 & demo2 not yet connected.
        d0 = demo_users[0]
        r4 = requests.post(f"{BASE_URL}/api/connections/{d2['user']['id']}", headers=d0["auth"])
        assert r4.status_code == 200
        cid2 = r4.json()["connection"]["id"]
        # But d0 might already have pending w/ d2 from prior runs — status should still be pending_out for a new one.
        r5 = requests.post(f"{BASE_URL}/api/connections/{cid2}/decline", headers=d2["auth"])
        assert r5.status_code == 200, r5.text


# =========================================================================
# Weekend digest
# =========================================================================
class TestDigest:
    def test_weekend_digest_shape(self, demo_users):
        d0 = demo_users[0]
        r = requests.get(f"{BASE_URL}/api/digest/weekend", headers=d0["auth"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("headline", "weekend_label", "total_events", "days"):
            assert k in j, j
        assert isinstance(j["days"], list)
        allowed_labels = {"Friday", "Saturday", "Sunday"}
        for d in j["days"]:
            assert d["label"] in allowed_labels, d
            assert "date" in d and "events" in d
            for e in d["events"]:
                for k in ("interested_count", "going_count", "vibe_count"):
                    assert k in e, e
                assert "my_status" in e
        # LA-tz aware headlines
        now_la = datetime.now(LA)
        wd = now_la.weekday()
        expected_headlines = {
            "This weekend on campus",
            "Plan ahead: this weekend on campus",
            "Happy Friday! Here's your weekend",
            "Next weekend on campus",
        }
        assert j["headline"] in expected_headlines, j["headline"]
        if wd >= 5 and j["total_events"] == 0:
            assert j["headline"] == "Next weekend on campus"


# =========================================================================
# Reminders
# =========================================================================
class TestReminders:
    def test_reminder_window_and_dismiss(self, demo_users):
        d0 = demo_users[0]
        # Create an event ~75 minutes from now in LA tz
        now_la = datetime.now(LA)
        soon = now_la + timedelta(minutes=75)
        date_str = soon.strftime("%Y-%m-%d")
        # Time like "7:30 PM" (no leading zero, uppercase AM/PM)
        time_str = soon.strftime("%I:%M %p").lstrip("0")
        far = now_la + timedelta(hours=5)
        far_date = far.strftime("%Y-%m-%d")
        far_time = far.strftime("%I:%M %p").lstrip("0")

        # Create the reminder-window event
        r = requests.post(
            f"{BASE_URL}/api/events",
            headers=d0["auth"],
            json={
                "title": "TEST reminder event",
                "description": "reminder test",
                "date": date_str,
                "time": time_str,
                "location": "TEST loc",
                "category": "Social",
                "tags": ["TEST"],
            },
        )
        assert r.status_code == 200, r.text
        soon_eid = r.json()["event"]["id"]

        # Create far event
        r2 = requests.post(
            f"{BASE_URL}/api/events",
            headers=d0["auth"],
            json={
                "title": "TEST far event",
                "description": "far test",
                "date": far_date,
                "time": far_time,
                "location": "TEST loc",
                "category": "Social",
                "tags": ["TEST"],
            },
        )
        assert r2.status_code == 200
        far_eid = r2.json()["event"]["id"]

        # RSVP going to both
        for eid in (soon_eid, far_eid):
            r3 = requests.post(f"{BASE_URL}/api/events/{eid}/rsvp?status=going", headers=d0["auth"])
            assert r3.status_code == 200

        # GET reminders: soon should be present, far absent
        r4 = requests.get(f"{BASE_URL}/api/reminders", headers=d0["auth"])
        assert r4.status_code == 200, r4.text
        rems = r4.json()["reminders"]
        ids = {x["id"] for x in rems}
        assert soon_eid in ids, f"soon event {soon_eid} not in reminders {ids}"
        assert far_eid not in ids, f"far event {far_eid} unexpectedly in reminders"
        soon_r = next(x for x in rems if x["id"] == soon_eid)
        assert "starts_in_minutes" in soon_r
        assert 0 <= soon_r["starts_in_minutes"] <= 120

        # Dismiss then verify absent
        r5 = requests.post(f"{BASE_URL}/api/reminders/{soon_eid}/dismiss", headers=d0["auth"])
        assert r5.status_code == 200
        r6 = requests.get(f"{BASE_URL}/api/reminders", headers=d0["auth"])
        ids2 = {x["id"] for x in r6.json()["reminders"]}
        assert soon_eid not in ids2

        # Cleanup RSVP
        for eid in (soon_eid, far_eid):
            requests.post(f"{BASE_URL}/api/events/{eid}/rsvp?status=none", headers=d0["auth"])


# =========================================================================
# Verified lounge
# =========================================================================
class TestLounge:
    def _find_unverified_demo(self):
        """Login demo1, demo3, demo5 etc. and return one that is unverified."""
        # Task says demo1/demo3 are unverified; verify by API
        for i in (1, 3, 5, 7, 9):
            tok, u = login(f"demo{i}@circle.demo")
            if not u.get("verified"):
                return tok, u
        pytest.skip("No unverified demo user found")

    def test_verified_gets_lounge(self, demo_users):
        d0 = demo_users[0]
        # demo0 should already be verified per seed
        assert d0["user"]["verified"] is True, "demo0 expected to be verified"
        r = requests.get(f"{BASE_URL}/api/lounge", headers=d0["auth"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["locked"] is False
        assert j["circle"] is not None
        c = j["circle"]
        assert c["is_lounge"] is True
        assert d0["user"]["id"] in c["member_ids"]  # auto-added
        self._lounge_id = c["id"]

    def test_unverified_locked_and_hidden(self, demo_users):
        tok, u = self._find_unverified_demo()
        h = auth_h(tok)
        r = requests.get(f"{BASE_URL}/api/lounge", headers=h)
        assert r.status_code == 200
        j = r.json()
        assert j["locked"] is True
        assert j["circle"] is None

        # Get lounge id via a verified user
        d0 = demo_users[0]
        r2 = requests.get(f"{BASE_URL}/api/lounge", headers=d0["auth"])
        lounge_id = r2.json()["circle"]["id"]

        # Unverified GET /circles/{id} -> 404
        r3 = requests.get(f"{BASE_URL}/api/circles/{lounge_id}", headers=h)
        assert r3.status_code == 404, r3.text

        # POST join -> 403
        r4 = requests.post(f"{BASE_URL}/api/circles/{lounge_id}/join", headers=h)
        assert r4.status_code == 403, r4.text

        # GET /circles (all) does not list the lounge
        r5 = requests.get(f"{BASE_URL}/api/circles", headers=h)
        assert r5.status_code == 200
        ids = {c["id"] for c in r5.json()["circles"]}
        assert lounge_id not in ids

        # POST /circles verified_only=true by unverified -> 403
        r6 = requests.post(
            f"{BASE_URL}/api/circles",
            headers=h,
            json={"name": "TEST vo", "member_ids": [], "verified_only": True},
        )
        assert r6.status_code == 403

    def test_verify_flow_unlocks_lounge(self):
        """Signup a fresh test user, verify, then /lounge should unlock and auto-add."""
        email = f"test_verify_{uuid.uuid4().hex[:8]}@test.demo"
        r = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "first_name": "TestVerify",
                "last_name": "User",
                "email": email,
                "password": "testpass123",
                "date_of_birth": "2003-01-01",
            },
        )
        assert r.status_code == 200
        tok = r.json()["token"]
        h = auth_h(tok)
        # Lounge locked initially
        r1 = requests.get(f"{BASE_URL}/api/lounge", headers=h)
        assert r1.status_code == 200 and r1.json()["locked"] is True
        # Verify
        r2 = requests.post(f"{BASE_URL}/api/auth/verify-student", headers=h)
        assert r2.status_code == 200 and r2.json()["user"]["verified"] is True
        # Lounge unlocks and auto-adds
        r3 = requests.get(f"{BASE_URL}/api/lounge", headers=h)
        assert r3.status_code == 200
        j3 = r3.json()
        assert j3["locked"] is False and j3["circle"] is not None
        uid = jwt_sub(tok)
        assert uid in j3["circle"]["member_ids"]


def jwt_sub(tok: str) -> str:
    import jwt as _jwt
    JWT_SECRET = os.environ.get("JWT_SECRET", "circle-app-mvp-secret-change-in-prod")
    return _jwt.decode(tok, JWT_SECRET, algorithms=["HS256"])["sub"]


# =========================================================================
# Regression smoke (light)
# =========================================================================
class TestRegression:
    def test_regression_endpoints(self, demo_users):
        d0 = demo_users[0]
        h = d0["auth"]
        for path in ("/api/matches", "/api/events", "/api/circles", "/api/recommendations", "/api/clubs", "/api/auth/me"):
            r = requests.get(f"{BASE_URL}{path}", headers=h)
            assert r.status_code == 200, f"{path}: {r.status_code} {r.text[:200]}"
