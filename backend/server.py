"""CIRCLE - Campus social discovery MVP backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import logging
import bcrypt
import jwt
import requests
import random
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
CAMPUS_TZ = ZoneInfo("America/Los_Angeles")
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "circle-campus"
_storage_key: Optional[str] = None

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="CIRCLE API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("circle")


# ---------------------------------------------------------------------------
# Object storage helpers
# ---------------------------------------------------------------------------
def _init_storage_sync() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def _put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage_sync()
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if r.status_code == 503:
        global _storage_key
        _storage_key = None
        key = _init_storage_sync()
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def _get_object_sync(path: str) -> tuple[bytes, str]:
    key = _init_storage_sync()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    try:
        return await current_user(authorization)
    except HTTPException:
        return None


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SignUpBody(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    date_of_birth: str  # ISO date
    university: str = "California State University, Fullerton"


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class OnboardingBody(BaseModel):
    looking_for: List[str] = []
    interests: List[str] = []
    social_style: dict = {}  # question_id -> answer
    personality: dict = {}  # trait -> 0..100 slider
    year: Optional[str] = None
    major: Optional[str] = None
    lives_on_campus: Optional[bool] = None
    campus_area: Optional[str] = None
    availability_days: List[str] = []
    availability_times: List[str] = []
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None


class EventCreateBody(BaseModel):
    title: str
    description: str
    date: str  # ISO
    time: str
    location: str
    category: str
    tags: List[str] = []
    capacity: Optional[int] = None
    cover_image_url: Optional[str] = None
    event_type: str = "student"  # student | official | hangout


class RecommendationCreateBody(BaseModel):
    title: str
    description: str
    category: str
    location: Optional[str] = None
    tags: List[str] = []
    image_url: Optional[str] = None


class CircleCreateBody(BaseModel):
    name: str
    interests: List[str] = []
    member_ids: List[str] = []
    event_id: Optional[str] = None
    verified_only: bool = False


class MessageBody(BaseModel):
    content: str


class ReportBody(BaseModel):
    target_type: str  # user | event | circle
    target_id: str
    reason: str


# ---------------------------------------------------------------------------
# Compatibility algorithm
# ---------------------------------------------------------------------------
def compatibility(a: dict, b: dict) -> tuple[int, List[str]]:
    reasons: List[str] = []

    a_int = set(a.get("interests") or [])
    b_int = set(b.get("interests") or [])
    shared = a_int & b_int
    interest_score = 0
    if a_int and b_int:
        interest_score = len(shared) / max(len(a_int | b_int), 1)
    for i in list(shared)[:3]:
        reasons.append(f"You both like {i}")

    # social style match: same answer per question
    a_ss = a.get("social_style") or {}
    b_ss = b.get("social_style") or {}
    keys = set(a_ss.keys()) & set(b_ss.keys())
    ss_matches = sum(1 for k in keys if a_ss[k] == b_ss[k])
    social_score = (ss_matches / len(keys)) if keys else 0
    if ss_matches >= 2:
        reasons.append("Similar social style")

    # personality proximity (0..100 sliders)
    a_p = a.get("personality") or {}
    b_p = b.get("personality") or {}
    pkeys = set(a_p.keys()) & set(b_p.keys())
    if pkeys:
        diffs = [abs(a_p[k] - b_p[k]) for k in pkeys]
        personality_score = 1 - (sum(diffs) / (len(diffs) * 100))
    else:
        personality_score = 0

    # looking for overlap
    a_lf = set(a.get("looking_for") or [])
    b_lf = set(b.get("looking_for") or [])
    lf_shared = a_lf & b_lf
    lf_score = (len(lf_shared) / max(len(a_lf | b_lf), 1)) if (a_lf and b_lf) else 0
    if lf_shared:
        reasons.append(f"Both looking for {list(lf_shared)[0]}")

    # availability
    a_days = set(a.get("availability_days") or [])
    b_days = set(b.get("availability_days") or [])
    a_times = set(a.get("availability_times") or [])
    b_times = set(b.get("availability_times") or [])
    day_shared = a_days & b_days
    time_shared = a_times & b_times
    avail_score = 0
    if a_days and b_days:
        avail_score += 0.5 * (len(day_shared) / max(len(a_days | b_days), 1))
    if a_times and b_times:
        avail_score += 0.5 * (len(time_shared) / max(len(a_times | b_times), 1))
    if day_shared and time_shared:
        reasons.append(f"Both available {list(time_shared)[0].lower()}")

    # campus
    campus_score = 0
    if a.get("university") == b.get("university"):
        campus_score += 0.5
    if a.get("year") and a.get("year") == b.get("year"):
        campus_score += 0.5

    total = (
        interest_score * 30
        + social_score * 20
        + personality_score * 15
        + lf_score * 15
        + avail_score * 10
        + campus_score * 10
    )
    total = int(round(min(100, max(0, total))))
    if not reasons:
        reasons.append("You're both on CSUF campus")
    return total, reasons[:5]


# ---------------------------------------------------------------------------
# Utility: serialize
# ---------------------------------------------------------------------------
def public_user(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "first_name": u.get("first_name"),
        "last_name": u.get("last_name"),
        "major": u.get("major"),
        "year": u.get("year"),
        "university": u.get("university"),
        "profile_photo_url": u.get("profile_photo_url"),
        "bio": u.get("bio"),
        "interests": u.get("interests") or [],
        "looking_for": u.get("looking_for") or [],
        "verified": bool(u.get("verified")),
        "onboarded": bool(u.get("onboarded")),
    }


# ---------------------------------------------------------------------------
# Routes: Auth
# ---------------------------------------------------------------------------
@api.post("/auth/signup")
async def signup(body: SignUpBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "first_name": body.first_name,
        "last_name": body.last_name,
        "date_of_birth": body.date_of_birth,
        "university": body.university,
        "verified": False,
        "onboarded": False,
        "interests": [],
        "looking_for": [],
        "social_style": {},
        "personality": {},
        "availability_days": [],
        "availability_times": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return {"token": make_token(user_id), "user": public_user(doc)}


@api.post("/auth/login")
async def login(body: LoginBody):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not verify_password(body.password, u.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(u["id"]), "user": public_user(u)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": public_user(user)}


@api.post("/auth/verify-student")
async def verify_student(user: dict = Depends(current_user)):
    # Simulated verification
    await db.users.update_one({"id": user["id"]}, {"$set": {"verified": True}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"user": public_user(u)}


# ---------------------------------------------------------------------------
# Routes: Onboarding
# ---------------------------------------------------------------------------
@api.post("/onboarding")
async def save_onboarding(body: OnboardingBody, user: dict = Depends(current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["onboarded"] = True
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"user": public_user(u)}


# ---------------------------------------------------------------------------
# Routes: Users / Matches
# ---------------------------------------------------------------------------
@api.get("/matches")
async def get_matches(user: dict = Depends(current_user), limit: int = 30):
    others = await db.users.find(
        {"id": {"$ne": user["id"]}, "onboarded": True}, {"_id": 0, "password_hash": 0}
    ).to_list(500)
    scored = []
    for o in others:
        score, reasons = compatibility(user, o)
        shared = list(set(user.get("interests") or []) & set(o.get("interests") or []))
        scored.append(
            {
                "user": public_user(o),
                "compatibility": score,
                "reasons": reasons,
                "shared_interests": shared[:5],
            }
        )
    scored.sort(key=lambda x: x["compatibility"], reverse=True)
    return {"matches": scored[:limit]}


@api.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(current_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "Not found")
    score, reasons = compatibility(user, u)
    shared = list(set(user.get("interests") or []) & set(u.get("interests") or []))
    return {
        "user": public_user(u),
        "compatibility": score,
        "reasons": reasons,
        "shared_interests": shared,
        "connection": await connection_state(user["id"], user_id),
    }


@api.get("/users")
async def list_users(user: dict = Depends(current_user), q: Optional[str] = None):
    query: dict = {"id": {"$ne": user["id"]}, "onboarded": True}
    if q:
        query["$or"] = [
            {"first_name": {"$regex": q, "$options": "i"}},
            {"last_name": {"$regex": q, "$options": "i"}},
            {"major": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(200)
    return {"users": [public_user(u) for u in users]}


# ---------------------------------------------------------------------------
# Routes: Events
# ---------------------------------------------------------------------------
@api.post("/events")
async def create_event(body: EventCreateBody, user: dict = Depends(current_user)):
    ev = {
        "id": str(uuid.uuid4()),
        "creator_id": user["id"],
        "creator_name": f"{user['first_name']} {user['last_name']}",
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(ev)
    ev.pop("_id", None)
    return {"event": ev}


@api.get("/events")
async def list_events(
    user: Optional[dict] = Depends(optional_user),
    category: Optional[str] = None,
    q: Optional[str] = None,
):
    query: dict = {}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(200)
    # attach counts
    for e in events:
        e["interested_count"] = await db.event_attendees.count_documents(
            {"event_id": e["id"], "status": {"$in": ["interested", "going"]}}
        )
        e["going_count"] = await db.event_attendees.count_documents(
            {"event_id": e["id"], "status": "going"}
        )
        if user:
            att = await db.event_attendees.find_one(
                {"event_id": e["id"], "user_id": user["id"]}, {"_id": 0}
            )
            e["my_status"] = att["status"] if att else None
    return {"events": events}


@api.get("/events/{event_id}")
async def get_event(event_id: str, user: Optional[dict] = Depends(optional_user)):
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Not found")
    e["interested_count"] = await db.event_attendees.count_documents(
        {"event_id": event_id, "status": {"$in": ["interested", "going"]}}
    )
    e["going_count"] = await db.event_attendees.count_documents(
        {"event_id": event_id, "status": "going"}
    )
    if user:
        att = await db.event_attendees.find_one(
            {"event_id": event_id, "user_id": user["id"]}, {"_id": 0}
        )
        e["my_status"] = att["status"] if att else None
    return {"event": e}


@api.post("/events/{event_id}/rsvp")
async def rsvp_event(event_id: str, status: str = Query(...), user: dict = Depends(current_user)):
    if status not in ("interested", "going", "none"):
        raise HTTPException(400, "Invalid status")
    e = await db.events.find_one({"id": event_id})
    if not e:
        raise HTTPException(404, "Event not found")
    if status == "none":
        await db.event_attendees.delete_one({"event_id": event_id, "user_id": user["id"]})
    else:
        await db.event_attendees.update_one(
            {"event_id": event_id, "user_id": user["id"]},
            {
                "$set": {
                    "event_id": event_id,
                    "user_id": user["id"],
                    "status": status,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
    return {"ok": True, "status": status}


@api.get("/events/{event_id}/attendees")
async def event_attendees(event_id: str, user: dict = Depends(current_user)):
    atts = await db.event_attendees.find({"event_id": event_id}, {"_id": 0}).to_list(500)
    user_ids = [a["user_id"] for a in atts]
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    umap = {u["id"]: u for u in users}
    result = []
    for a in atts:
        u = umap.get(a["user_id"])
        if not u:
            continue
        score, reasons = compatibility(user, u)
        shared = list(set(user.get("interests") or []) & set(u.get("interests") or []))
        result.append(
            {
                "user": public_user(u),
                "status": a["status"],
                "compatibility": score,
                "reasons": reasons,
                "shared_interests": shared[:5],
            }
        )
    result.sort(key=lambda x: x["compatibility"], reverse=True)
    return {"attendees": result}


# ---------------------------------------------------------------------------
# Routes: Circles
# ---------------------------------------------------------------------------
def _dm_system_msg(circle_id: str, content: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "circle_id": circle_id,
        "sender_id": "system",
        "content": content,
        "system": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def decorate_circle(c: dict, user: dict) -> dict:
    members = await db.users.find(
        {"id": {"$in": c["member_ids"]}}, {"_id": 0, "password_hash": 0}
    ).to_list(50)
    c["members"] = [public_user(m) for m in members]
    c["is_member"] = user["id"] in c["member_ids"]
    c["verified_only"] = bool(c.get("verified_only"))
    c["is_lounge"] = bool(c.get("is_lounge"))
    c["type"] = c.get("type") or "group"
    user_int = set(user.get("interests") or [])
    c["shared_with_you"] = list(user_int & set(c.get("interests") or []))
    if c["type"] == "dm":
        other = next((m for m in c["members"] if m["id"] != user["id"]), None)
        c["other_user"] = other
        c["name"] = f"{other['first_name']} {other['last_name']}" if other else "Direct message"
    return c


def _circle_visibility(user: dict) -> dict:
    return {} if user.get("verified") else {"verified_only": {"$ne": True}}


@api.post("/circles")
async def create_circle(body: CircleCreateBody, user: dict = Depends(current_user)):
    if body.verified_only and not user.get("verified"):
        raise HTTPException(403, "Only CSUF Verified students can create verified-only Circles")
    members = list({user["id"], *body.member_ids})
    c = {
        "id": str(uuid.uuid4()),
        "type": "group",
        "name": body.name,
        "creator_id": user["id"],
        "member_ids": members,
        "interests": body.interests,
        "event_id": body.event_id,
        "verified_only": body.verified_only,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.circles.insert_one(c)
    await db.messages.insert_one(_dm_system_msg(c["id"], f"{user['first_name']} created this Circle"))
    c.pop("_id", None)
    return {"circle": c}


@api.get("/circles")
async def list_circles(user: dict = Depends(current_user), mine: bool = False, dm: bool = False):
    query: dict = {**_circle_visibility(user)}
    if dm:
        query["type"] = "dm"
        query["member_ids"] = user["id"]
    else:
        query["type"] = {"$ne": "dm"}
        if mine:
            query["member_ids"] = user["id"]
    circles = await db.circles.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    for c in circles:
        await decorate_circle(c, user)
        if dm:
            last = await db.messages.find_one(
                {"circle_id": c["id"], "system": False}, {"_id": 0}, sort=[("created_at", -1)]
            )
            c["last_message"] = last
    return {"circles": circles}


@api.get("/lounge")
async def verified_lounge(user: dict = Depends(current_user)):
    """The private lounge only appears once a student is CSUF Verified. Verified users are auto-joined."""
    lounge = await db.circles.find_one({"is_lounge": True}, {"_id": 0})
    if not lounge:
        return {"locked": True, "circle": None}
    if not user.get("verified"):
        return {"locked": True, "circle": None, "member_count": len(lounge["member_ids"])}
    if user["id"] not in lounge["member_ids"]:
        await db.circles.update_one({"id": lounge["id"]}, {"$addToSet": {"member_ids": user["id"]}})
        await db.messages.insert_one(_dm_system_msg(lounge["id"], f"{user['first_name']} unlocked the lounge ✓"))
        lounge = await db.circles.find_one({"is_lounge": True}, {"_id": 0})
    await decorate_circle(lounge, user)
    return {"locked": False, "circle": lounge, "member_count": len(lounge["member_ids"])}


@api.get("/circles/{circle_id}")
async def get_circle(circle_id: str, user: dict = Depends(current_user)):
    c = await db.circles.find_one({"id": circle_id, **_circle_visibility(user)}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    await decorate_circle(c, user)
    if c.get("event_id"):
        ev = await db.events.find_one({"id": c["event_id"]}, {"_id": 0})
        c["event"] = ev
    return {"circle": c}


@api.post("/circles/{circle_id}/join")
async def join_circle(circle_id: str, user: dict = Depends(current_user)):
    c = await db.circles.find_one({"id": circle_id})
    if not c:
        raise HTTPException(404, "Not found")
    if c.get("verified_only") and not user.get("verified"):
        raise HTTPException(403, "CSUF Verified students only")
    if c.get("type") == "dm":
        raise HTTPException(403, "Direct messages are private")
    if user["id"] not in c["member_ids"]:
        await db.circles.update_one({"id": circle_id}, {"$addToSet": {"member_ids": user["id"]}})
        await db.messages.insert_one(_dm_system_msg(circle_id, f"{user['first_name']} joined the group"))
    return {"ok": True}


@api.post("/circles/{circle_id}/leave")
async def leave_circle(circle_id: str, user: dict = Depends(current_user)):
    await db.circles.update_one({"id": circle_id}, {"$pull": {"member_ids": user["id"]}})
    return {"ok": True}


@api.get("/circles/{circle_id}/messages")
async def circle_messages(circle_id: str, user: dict = Depends(current_user), since: Optional[str] = None):
    query: dict = {"circle_id": circle_id}
    if since:
        query["created_at"] = {"$gt": since}
    msgs = await db.messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    # attach sender names
    ids = list({m["sender_id"] for m in msgs if m["sender_id"] != "system"})
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
    umap = {u["id"]: u for u in users}
    for m in msgs:
        if m["sender_id"] == "system":
            m["sender"] = None
        else:
            u = umap.get(m["sender_id"])
            m["sender"] = public_user(u) if u else None
    return {"messages": msgs}


@api.post("/circles/{circle_id}/messages")
async def send_message(circle_id: str, body: MessageBody, user: dict = Depends(current_user)):
    c = await db.circles.find_one({"id": circle_id})
    if not c or user["id"] not in c["member_ids"]:
        raise HTTPException(403, "Not a member")
    if c.get("verified_only") and not user.get("verified"):
        raise HTTPException(403, "CSUF Verified students only")
    msg = {
        "id": str(uuid.uuid4()),
        "circle_id": circle_id,
        "sender_id": user["id"],
        "content": body.content,
        "system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    msg["sender"] = public_user(user)
    return {"message": msg}


# ---------------------------------------------------------------------------
# Routes: Connections (1:1)
# ---------------------------------------------------------------------------
async def connection_state(me: str, other: str) -> dict:
    c = await db.connections.find_one(
        {
            "status": {"$in": ["pending", "accepted"]},
            "$or": [{"from_id": me, "to_id": other}, {"from_id": other, "to_id": me}],
        },
        {"_id": 0},
    )
    if not c:
        return {"status": "none", "id": None, "circle_id": None}
    if c["status"] == "accepted":
        status = "connected"
    else:
        status = "pending_out" if c["from_id"] == me else "pending_in"
    return {"status": status, "id": c["id"], "circle_id": c.get("circle_id")}


async def _accept_connection(c: dict) -> dict:
    a = await db.users.find_one({"id": c["from_id"]}, {"_id": 0, "password_hash": 0})
    b = await db.users.find_one({"id": c["to_id"]}, {"_id": 0, "password_hash": 0})
    shared = list(set((a or {}).get("interests") or []) & set((b or {}).get("interests") or []))
    dm = {
        "id": str(uuid.uuid4()),
        "type": "dm",
        "name": "Direct message",
        "creator_id": c["from_id"],
        "member_ids": [c["from_id"], c["to_id"]],
        "interests": shared[:5],
        "event_id": None,
        "connection_id": c["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.circles.insert_one(dm)
    intro = "You're connected! Say hi 👋"
    if shared:
        intro += f" — you both like {shared[0]}"
    await db.messages.insert_one(_dm_system_msg(dm["id"], intro))
    await db.connections.update_one(
        {"id": c["id"]},
        {"$set": {"status": "accepted", "circle_id": dm["id"], "accepted_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"status": "connected", "id": c["id"], "circle_id": dm["id"]}


@api.post("/connections/{user_id}")
async def request_connection(user_id: str, user: dict = Depends(current_user)):
    if user_id == user["id"]:
        raise HTTPException(400, "You can't connect with yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    existing = await db.connections.find_one(
        {
            "status": {"$in": ["pending", "accepted"]},
            "$or": [{"from_id": user["id"], "to_id": user_id}, {"from_id": user_id, "to_id": user["id"]}],
        },
        {"_id": 0},
    )
    if existing:
        if existing["status"] == "pending" and existing["to_id"] == user["id"]:
            # They already asked — tapping Connect is mutual, open the chat.
            return {"connection": await _accept_connection(existing)}
        return {"connection": await connection_state(user["id"], user_id)}
    c = {
        "id": str(uuid.uuid4()),
        "from_id": user["id"],
        "to_id": user_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.connections.insert_one(c)
    return {"connection": {"status": "pending_out", "id": c["id"], "circle_id": None}}


@api.get("/connections")
async def list_connections(user: dict = Depends(current_user)):
    conns = await db.connections.find(
        {"status": {"$in": ["pending", "accepted"]}, "$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(300)
    other_ids = list({c["to_id"] if c["from_id"] == user["id"] else c["from_id"] for c in conns})
    users = await db.users.find({"id": {"$in": other_ids}}, {"_id": 0, "password_hash": 0}).to_list(300)
    umap = {u["id"]: u for u in users}
    incoming, outgoing, connected = [], [], []
    for c in conns:
        other_id = c["to_id"] if c["from_id"] == user["id"] else c["from_id"]
        o = umap.get(other_id)
        if not o:
            continue
        score, reasons = compatibility(user, o)
        item = {"id": c["id"], "user": public_user(o), "compatibility": score, "reasons": reasons[:2],
                "circle_id": c.get("circle_id"), "created_at": c["created_at"]}
        if c["status"] == "accepted":
            connected.append(item)
        elif c["to_id"] == user["id"]:
            incoming.append(item)
        else:
            outgoing.append(item)
    return {"incoming": incoming, "outgoing": outgoing, "connected": connected}


@api.post("/connections/{connection_id}/accept")
async def accept_connection(connection_id: str, user: dict = Depends(current_user)):
    c = await db.connections.find_one({"id": connection_id, "to_id": user["id"], "status": "pending"}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Request not found")
    return {"connection": await _accept_connection(c)}


@api.post("/connections/{connection_id}/decline")
async def decline_connection(connection_id: str, user: dict = Depends(current_user)):
    r = await db.connections.update_one(
        {"id": connection_id, "status": "pending", "$or": [{"to_id": user["id"]}, {"from_id": user["id"]}]},
        {"$set": {"status": "declined"}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Request not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: Weekend digest + event reminders
# ---------------------------------------------------------------------------
def event_start(e: dict) -> Optional[datetime]:
    raw = f"{e.get('date', '')} {(e.get('time') or '').strip().upper().replace('.', '')}"
    for fmt in ("%Y-%m-%d %I:%M %p", "%Y-%m-%d %I%p", "%Y-%m-%d %I %p", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=CAMPUS_TZ)
        except ValueError:
            continue
    return None


async def _attach_event_meta(e: dict, user: dict):
    e["interested_count"] = await db.event_attendees.count_documents(
        {"event_id": e["id"], "status": {"$in": ["interested", "going"]}}
    )
    e["going_count"] = await db.event_attendees.count_documents({"event_id": e["id"], "status": "going"})
    att = await db.event_attendees.find_one({"event_id": e["id"], "user_id": user["id"]}, {"_id": 0})
    e["my_status"] = att["status"] if att else None


@api.get("/digest/weekend")
async def weekend_digest(user: dict = Depends(current_user)):
    now = datetime.now(CAMPUS_TZ)
    today = now.date()
    wd = today.weekday()  # Mon=0 .. Sun=6
    friday = today + timedelta(days=(4 - wd)) if wd <= 4 else today - timedelta(days=wd - 4)
    days = [friday + timedelta(days=i) for i in range(3)]
    day_strs = [d.strftime("%Y-%m-%d") for d in days if d >= today]
    events = await db.events.find({"date": {"$in": day_strs}}, {"_id": 0}).sort("date", 1).to_list(200)
    rolled = False
    if wd >= 5 and not events:
        # Weekend is wrapping up with nothing left — look ahead to next weekend.
        rolled = True
        friday = friday + timedelta(days=7)
        days = [friday + timedelta(days=i) for i in range(3)]
        day_strs = [d.strftime("%Y-%m-%d") for d in days]
        events = await db.events.find({"date": {"$in": day_strs}}, {"_id": 0}).sort("date", 1).to_list(200)

    # Who I vibe with (>=60) so the digest can say "3 people you match with are going"
    others = await db.users.find({"id": {"$ne": user["id"]}, "onboarded": True}, {"_id": 0, "password_hash": 0}).to_list(500)
    vibe_ids = {o["id"] for o in others if compatibility(user, o)[0] >= 60}

    by_day: dict = {d: [] for d in day_strs}
    for e in events:
        await _attach_event_meta(e, user)
        atts = await db.event_attendees.find({"event_id": e["id"]}, {"_id": 0, "user_id": 1}).to_list(500)
        e["vibe_count"] = sum(1 for a in atts if a["user_id"] in vibe_ids)
        by_day[e["date"]].append(e)

    labels = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}
    out_days = []
    for d in days:
        ds = d.strftime("%Y-%m-%d")
        if ds not in by_day:
            continue
        evs = sorted(by_day[ds], key=lambda x: (event_start(x) or now).timestamp())
        out_days.append({"date": ds, "label": labels[d.weekday()], "short": d.strftime("%b %d"), "events": evs})

    total = sum(len(d["events"]) for d in out_days)
    label = f"{days[0].strftime('%b %d')} – {days[2].strftime('%b %d')}"
    return {
        "is_friday": wd == 4,
        "is_weekend": wd >= 4,
        "weekend_label": label,
        "total_events": total,
        "headline": "Happy Friday! Here's your weekend" if wd == 4 else ("Next weekend on campus" if rolled else "This weekend on campus" if wd >= 5 else "Plan ahead: this weekend on campus"),
        "days": out_days,
    }


REMINDER_WINDOW_MIN = 120


@api.get("/reminders")
async def upcoming_reminders(user: dict = Depends(current_user)):
    """Events the user RSVPed to that start within the next 2 hours."""
    now = datetime.now(CAMPUS_TZ)
    atts = await db.event_attendees.find(
        {"user_id": user["id"], "status": {"$in": ["going", "interested"]}}, {"_id": 0}
    ).to_list(500)
    if not atts:
        return {"reminders": []}
    ids = [a["event_id"] for a in atts]
    status_map = {a["event_id"]: a["status"] for a in atts}
    dismissed = {
        d["event_id"]
        for d in await db.reminder_dismissals.find({"user_id": user["id"]}, {"_id": 0, "event_id": 1}).to_list(500)
    }
    events = await db.events.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    out = []
    for e in events:
        if e["id"] in dismissed:
            continue
        start = event_start(e)
        if not start:
            continue
        mins = int((start - now).total_seconds() // 60)
        if 0 <= mins <= REMINDER_WINDOW_MIN:
            e["starts_in_minutes"] = mins
            e["my_status"] = status_map.get(e["id"])
            out.append(e)
    out.sort(key=lambda x: x["starts_in_minutes"])
    return {"reminders": out}


@api.post("/reminders/{event_id}/dismiss")
async def dismiss_reminder(event_id: str, user: dict = Depends(current_user)):
    await db.reminder_dismissals.update_one(
        {"user_id": user["id"], "event_id": event_id},
        {"$set": {"user_id": user["id"], "event_id": event_id, "dismissed_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: Recommendations
# ---------------------------------------------------------------------------
@api.post("/recommendations")
async def create_recommendation(body: RecommendationCreateBody, user: dict = Depends(current_user)):
    r = {
        "id": str(uuid.uuid4()),
        "creator_id": user["id"],
        "creator_name": f"{user['first_name']} {user['last_name']}",
        "creator_photo": user.get("profile_photo_url"),
        **body.model_dump(),
        "saves": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recommendations.insert_one(r)
    r.pop("_id", None)
    return {"recommendation": r}


@api.get("/recommendations")
async def list_recommendations(q: Optional[str] = None):
    query: dict = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    recs = await db.recommendations.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"recommendations": recs}


# ---------------------------------------------------------------------------
# Routes: Clubs
# ---------------------------------------------------------------------------
@api.get("/clubs")
async def list_clubs():
    clubs = await db.clubs.find({}, {"_id": 0}).to_list(200)
    return {"clubs": clubs}


@api.get("/clubs/{club_id}")
async def get_club(club_id: str):
    c = await db.clubs.find_one({"id": club_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    return {"club": c}


# ---------------------------------------------------------------------------
# Routes: Reports / Block
# ---------------------------------------------------------------------------
@api.post("/reports")
async def create_report(body: ReportBody, user: dict = Depends(current_user)):
    await db.reports.insert_one(
        {
            "id": str(uuid.uuid4()),
            "reporter_id": user["id"],
            "target_type": body.target_type,
            "target_id": body.target_id,
            "reason": body.reason,
            "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"ok": True}


@api.post("/block/{user_id}")
async def block_user(user_id: str, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"blocked": user_id}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Uploads (Emergent Object Storage)
# ---------------------------------------------------------------------------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    key = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    try:
        await run_in_threadpool(_put_object_sync, key, data, file.content_type or "application/octet-stream")
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        if code == 402:
            raise HTTPException(402, "Storage credit exhausted")
        raise HTTPException(500, f"Upload failed: {code}")
    await db.uploads.insert_one(
        {
            "path": key,
            "owner_id": user["id"],
            "content_type": file.content_type,
            "size": len(data),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    # Return download URL
    return {"path": key, "url": f"/api/files/{key}"}


@api.get("/files/{path:path}")
async def download_file(path: str, token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    # Accept token in query or bearer
    ok = False
    if authorization and authorization.startswith("Bearer "):
        try:
            jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
            ok = True
        except Exception:
            pass
    if not ok and token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            ok = True
        except Exception:
            pass
    if not ok:
        raise HTTPException(401, "Auth required")
    meta = await db.uploads.find_one({"path": path})
    if not meta:
        raise HTTPException(404, "Not found")
    try:
        content, ct = await run_in_threadpool(_get_object_sync, path)
    except Exception:
        raise HTTPException(500, "Read failed")
    return Response(content=content, media_type=ct)


# ---------------------------------------------------------------------------
# Health + include
# ---------------------------------------------------------------------------
@api.get("/health")
async def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed demo data on startup
# ---------------------------------------------------------------------------
from seed_data import seed_all, seed_lounge  # noqa: E402


@app.on_event("startup")
async def on_start():
    try:
        await seed_all(db, hash_password)
        await seed_lounge(db)
        logger.info("Seed check complete")
    except Exception as e:
        logger.error(f"Seed failed: {e}")


@app.on_event("shutdown")
async def on_stop():
    client.close()
