"""CIRCLE backend API tests - full E2E coverage."""
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # fallback to local
    BASE_URL = "http://localhost:8001"
BASE_URL = BASE_URL.rstrip("/")

DEMO_EMAIL = "demo0@circle.demo"
DEMO_PASS = "demo1234"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def me_user(session, auth):
    r = session.get(f"{BASE_URL}/api/auth/me", headers=auth)
    assert r.status_code == 200
    return r.json()["user"]


# ----------------- Auth -----------------
class TestAuth:
    def test_health(self, session):
        r = session.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_login_demo(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
        assert r.status_code == 200
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["onboarded"] is True

    def test_login_bad_pass(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, session, auth):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=auth)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["id"] and u["first_name"]

    def test_me_missing_token(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_signup_and_onboarding(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@test.demo"
        r = session.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "first_name": "Test",
                "last_name": "User",
                "email": email,
                "password": "testpass123",
                "date_of_birth": "2003-01-01",
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["onboarded"] is False
        assert data["user"]["verified"] is False
        tok = data["token"]
        hdr = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

        # duplicate signup
        r2 = session.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "first_name": "Test",
                "last_name": "User",
                "email": email,
                "password": "testpass123",
                "date_of_birth": "2003-01-01",
            },
        )
        assert r2.status_code == 400

        # verify-student
        r3 = session.post(f"{BASE_URL}/api/auth/verify-student", headers=hdr)
        assert r3.status_code == 200
        assert r3.json()["user"]["verified"] is True

        # onboarding save
        r4 = session.post(
            f"{BASE_URL}/api/onboarding",
            headers=hdr,
            json={
                "looking_for": ["Study buddies"],
                "interests": ["Hiking", "Coffee"],
                "social_style": {"q1": "a", "q2": "b"},
                "personality": {"extraversion": 60, "openness": 70},
                "year": "Junior",
                "major": "CS",
                "availability_days": ["Mon", "Wed"],
                "availability_times": ["Evening"],
            },
        )
        assert r4.status_code == 200, r4.text
        assert r4.json()["user"]["onboarded"] is True


# ----------------- Matches / Users -----------------
class TestMatches:
    def test_matches_returns_ranked(self, session, auth):
        r = session.get(f"{BASE_URL}/api/matches", headers=auth)
        assert r.status_code == 200
        m = r.json()["matches"]
        assert len(m) >= 29, f"Expected 29+ demo matches, got {len(m)}"
        # ranked descending
        scores = [x["compatibility"] for x in m]
        assert scores == sorted(scores, reverse=True)
        # compatibility 0..100
        for x in m:
            assert 0 <= x["compatibility"] <= 100
            assert isinstance(x["reasons"], list) and len(x["reasons"]) >= 1
            assert "shared_interests" in x

    def test_get_user_detail(self, session, auth, me_user):
        r = session.get(f"{BASE_URL}/api/matches", headers=auth)
        target_id = r.json()["matches"][0]["user"]["id"]
        r2 = session.get(f"{BASE_URL}/api/users/{target_id}", headers=auth)
        assert r2.status_code == 200
        d = r2.json()
        assert d["user"]["id"] == target_id
        assert "compatibility" in d and "reasons" in d and "shared_interests" in d


# ----------------- Events -----------------
class TestEvents:
    def test_list_events(self, session, auth):
        r = session.get(f"{BASE_URL}/api/events", headers=auth)
        assert r.status_code == 200
        events = r.json()["events"]
        assert len(events) >= 15, f"Expected 15+ seeded events, got {len(events)}"
        assert "interested_count" in events[0]

    def test_get_event(self, session, auth):
        events = session.get(f"{BASE_URL}/api/events", headers=auth).json()["events"]
        eid = events[0]["id"]
        r = session.get(f"{BASE_URL}/api/events/{eid}", headers=auth)
        assert r.status_code == 200
        assert r.json()["event"]["id"] == eid

    def test_rsvp_flow(self, session, auth):
        events = session.get(f"{BASE_URL}/api/events", headers=auth).json()["events"]
        eid = events[0]["id"]
        r = session.post(f"{BASE_URL}/api/events/{eid}/rsvp?status=going", headers=auth)
        assert r.status_code == 200
        assert r.json()["status"] == "going"
        # verify persistence
        r2 = session.get(f"{BASE_URL}/api/events/{eid}", headers=auth)
        assert r2.json()["event"]["my_status"] == "going"
        # cancel
        r3 = session.post(f"{BASE_URL}/api/events/{eid}/rsvp?status=none", headers=auth)
        assert r3.status_code == 200

    def test_attendees(self, session, auth):
        events = session.get(f"{BASE_URL}/api/events", headers=auth).json()["events"]
        eid = events[0]["id"]
        # ensure at least self is attendee
        session.post(f"{BASE_URL}/api/events/{eid}/rsvp?status=interested", headers=auth)
        r = session.get(f"{BASE_URL}/api/events/{eid}/attendees", headers=auth)
        assert r.status_code == 200
        attendees = r.json()["attendees"]
        assert isinstance(attendees, list)
        if len(attendees) >= 2:
            scores = [a["compatibility"] for a in attendees]
            assert scores == sorted(scores, reverse=True)


# ----------------- Circles + Messages -----------------
class TestCircles:
    def test_create_circle_and_messages(self, session, auth, me_user):
        # pick 2 members from matches
        matches = session.get(f"{BASE_URL}/api/matches", headers=auth).json()["matches"]
        other_ids = [matches[0]["user"]["id"], matches[1]["user"]["id"]]

        # get an event
        events = session.get(f"{BASE_URL}/api/events", headers=auth).json()["events"]
        eid = events[0]["id"]

        r = session.post(
            f"{BASE_URL}/api/circles",
            headers=auth,
            json={"name": f"TEST Circle {uuid.uuid4().hex[:6]}", "member_ids": other_ids, "event_id": eid},
        )
        assert r.status_code == 200, r.text
        c = r.json()["circle"]
        assert me_user["id"] in c["member_ids"]
        assert len(c["member_ids"]) == 3

        # get circle - members expanded, event attached
        r2 = session.get(f"{BASE_URL}/api/circles/{c['id']}", headers=auth)
        assert r2.status_code == 200
        cc = r2.json()["circle"]
        assert len(cc["members"]) == 3
        assert cc.get("event") and cc["event"]["id"] == eid

        # system message should exist
        r3 = session.get(f"{BASE_URL}/api/circles/{c['id']}/messages", headers=auth)
        assert r3.status_code == 200
        msgs = r3.json()["messages"]
        assert any(m.get("system") for m in msgs)

        # send message
        r4 = session.post(f"{BASE_URL}/api/circles/{c['id']}/messages", headers=auth, json={"content": "Hi TEST"})
        assert r4.status_code == 200
        assert r4.json()["message"]["content"] == "Hi TEST"

        # verify persistence
        r5 = session.get(f"{BASE_URL}/api/circles/{c['id']}/messages", headers=auth)
        contents = [m["content"] for m in r5.json()["messages"]]
        assert "Hi TEST" in contents

    def test_circles_mine(self, session, auth, me_user):
        r = session.get(f"{BASE_URL}/api/circles?mine=true", headers=auth)
        assert r.status_code == 200
        circles = r.json()["circles"]
        for c in circles:
            assert me_user["id"] in c["member_ids"]


# ----------------- Recommendations / Clubs -----------------
class TestOther:
    def test_recommendations(self, session, auth):
        r = session.get(f"{BASE_URL}/api/recommendations", headers=auth)
        assert r.status_code == 200
        recs = r.json()["recommendations"]
        assert len(recs) >= 5, f"Expected 5+ seeded recs, got {len(recs)}"

    def test_clubs(self, session, auth):
        r = session.get(f"{BASE_URL}/api/clubs", headers=auth)
        assert r.status_code == 200
        clubs = r.json()["clubs"]
        assert len(clubs) >= 8, f"Expected 8+ seeded clubs, got {len(clubs)}"

    def test_report(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/reports",
            headers=auth,
            json={"target_type": "user", "target_id": "some-id", "reason": "TEST report"},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
