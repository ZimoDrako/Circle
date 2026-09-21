"""CIRCLE - Campus social discovery MVP backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Request
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import logging
import bcrypt
import jwt
import random
import re
from zoneinfo import ZoneInfo
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
CAMPUS_TZ = ZoneInfo("America/Los_Angeles")
load_dotenv(ROOT_DIR / ".env")

JWT_SECRET = os.environ["JWT_SECRET"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APP_NAME = "circle-campus"


supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI(title="CIRCLE API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("circle")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
_auth_attempts: dict = {}  # ip -> [timestamps]
AUTH_RATE_LIMIT = 30  # attempts per minute per IP


def rate_limit_auth(request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    now = datetime.now(timezone.utc).timestamp()
    hits = [t for t in _auth_attempts.get(ip, []) if now - t < 60]
    if len(hits) >= AUTH_RATE_LIMIT:
        raise HTTPException(429, "Too many attempts. Try again in a minute.")
    hits.append(now)
    _auth_attempts[ip] = hits


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
    result = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
    user = result.data[0] if result.data else None
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
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
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
    content: str = Field(min_length=1, max_length=2000)


class ReportBody(BaseModel):
    target_type: str  # user | event | circle
    target_id: str
    reason: str


# ---------------------------------------------------------------------------
# Compatibility algorithm
# ---------------------------------------------------------------------------
def compatibility(a: dict, b: dict) -> tuple[int, List[str]]:
    reasons: List[str] = []

    a_interest_map = {str(x).strip().casefold(): str(x).strip() for x in (a.get("interests") or []) if str(x).strip()}
    b_interest_map = {str(x).strip().casefold(): str(x).strip() for x in (b.get("interests") or []) if str(x).strip()}
    a_int = set(a_interest_map)
    b_int = set(b_interest_map)
    shared = a_int & b_int
    interest_score = 0
    if a_int and b_int:
        interest_score = len(shared) / max(len(a_int | b_int), 1)
    for i in list(shared)[:3]:
        reasons.append(f"You both like {a_interest_map.get(i, b_interest_map.get(i, i))}")

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
    a_lf = {str(x).strip().casefold() for x in (a.get("looking_for") or []) if str(x).strip()}
    b_lf = {str(x).strip().casefold() for x in (b.get("looking_for") or []) if str(x).strip()}
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
async def signup(body: SignUpBody, _: None = Depends(rate_limit_auth)):
    result = supabase.table("users").select("*").eq("email", body.email.lower()).limit(1).execute()
    existing = result.data[0] if result.data else None
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
    supabase.table("users").insert(doc).execute()
    return {"token": make_token(user_id), "user": public_user(doc)}


@api.post("/auth/login")
async def login(body: LoginBody, _: None = Depends(rate_limit_auth)):
    result = supabase.table("users").select("*").eq("email", body.email.lower()).limit(1).execute()
    u = result.data[0] if result.data else None
    if not u or not verify_password(body.password, u.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(u["id"]), "user": public_user(u)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": public_user(user)}


@api.post("/auth/verify-student")
async def verify_student(user: dict = Depends(current_user)):
    # Simulated verification
    supabase.table("users").update({"verified": True}).eq("id", user["id"]).execute()
    result = supabase.table("users").select("*").eq("id", user["id"]).limit(1).execute()
    u = result.data[0] if result.data else None
    return {"user": public_user(u)}


# ---------------------------------------------------------------------------
# Routes: Onboarding
# ---------------------------------------------------------------------------
@api.post("/onboarding")
async def save_onboarding(body: OnboardingBody, user: dict = Depends(current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["onboarded"] = True
    supabase.table("users").update(update).eq("id", user["id"]).execute()
    result = supabase.table("users").select("*").eq("id", user["id"]).limit(1).execute()
    u = result.data[0] if result.data else None
    return {"user": public_user(u)}


# ---------------------------------------------------------------------------
# Routes: Users / Matches
# ---------------------------------------------------------------------------
@api.get("/matches")
async def get_matches(user: dict = Depends(current_user), limit: int = 30):
    result = (
        supabase.table("users")
        .select("*")
        .neq("id", user["id"])
        .eq("onboarded", True)
        .limit(500)
        .execute()
    )
    others = [
        o for o in result.data
        if o.get("id") != user["id"]
    ]
    scored = []
    for o in others:
        score, reasons = compatibility(user, o)
        user_interests = {str(x).strip().casefold(): str(x).strip() for x in (user.get("interests") or []) if str(x).strip()}
        other_interests = {str(x).strip().casefold(): str(x).strip() for x in (o.get("interests") or []) if str(x).strip()}
        shared = [user_interests.get(k, other_interests[k]) for k in (set(user_interests) & set(other_interests))]
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
    result = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
    u = result.data[0] if result.data else None
    if not u:
        raise HTTPException(404, "Not found")
    score, reasons = compatibility(user, u)
    user_interests = {str(x).strip().casefold(): str(x).strip() for x in (user.get("interests") or []) if str(x).strip()}
    other_interests = {str(x).strip().casefold(): str(x).strip() for x in (u.get("interests") or []) if str(x).strip()}
    shared = [user_interests.get(k, other_interests[k]) for k in (set(user_interests) & set(other_interests))]
    return {
        "user": public_user(u),
        "compatibility": score,
        "reasons": reasons,
        "shared_interests": shared,
        "connection": await connection_state(user["id"], user_id),
    }


@api.get("/users")
async def list_users(user: dict = Depends(current_user), q: Optional[str] = Query(None, max_length=80)):
    query = supabase.table("users").select("*").neq("id", user["id"]).eq("onboarded", True)
    if q:
        search = re.escape(q)
        query = query.or_(
            f"first_name.ilike.*{search}*,last_name.ilike.*{search}*,major.ilike.*{search}*"
        )
    result = query.limit(200).execute()
    users = result.data
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
    supabase.table("events").insert(ev).execute()
    return {"event": ev}


@api.get("/events")
async def list_events(
    user: Optional[dict] = Depends(optional_user),
    category: Optional[str] = None,
    q: Optional[str] = Query(None, max_length=80),
):
    query = supabase.table("events").select("*")

    if category:
        query = query.eq("category", category)

    result = query.limit(200).execute()
    events = result.data or []

    if q:
        search = q.lower()
        events = [
            e for e in events
            if search in (e.get("title") or "").lower()
            or search in (e.get("description") or "").lower()
            or any(search in str(tag).lower() for tag in (e.get("tags") or []))
        ]

    events.sort(key=lambda x: x.get("date") or "")

    for e in events:
        interested_result = (
            supabase.table("event_attendees")
            .select("user_id", count="exact")
            .eq("event_id", e["id"])
            .in_("status", ["interested", "going"])
            .execute()
        )
        going_result = (
            supabase.table("event_attendees")
            .select("user_id", count="exact")
            .eq("event_id", e["id"])
            .eq("status", "going")
            .execute()
        )

        e["interested_count"] = interested_result.count or 0
        e["going_count"] = going_result.count or 0

        if user:
            att_result = (
                supabase.table("event_attendees")
                .select("*")
                .eq("event_id", e["id"])
                .eq("user_id", user["id"])
                .limit(1)
                .execute()
            )
            att = att_result.data[0] if att_result.data else None
            e["my_status"] = att["status"] if att else None

    return {"events": events}


@api.get("/events/{event_id}")
async def get_event(event_id: str, user: Optional[dict] = Depends(optional_user)):
    result = (
        supabase.table("events")
        .select("*")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )
    e = result.data[0] if result.data else None

    if not e:
        raise HTTPException(404, "Not found")

    interested_result = (
        supabase.table("event_attendees")
        .select("user_id", count="exact")
        .eq("event_id", event_id)
        .in_("status", ["interested", "going"])
        .execute()
    )
    going_result = (
        supabase.table("event_attendees")
        .select("user_id", count="exact")
        .eq("event_id", event_id)
        .eq("status", "going")
        .execute()
    )

    e["interested_count"] = interested_result.count or 0
    e["going_count"] = going_result.count or 0

    if user:
        att_result = (
            supabase.table("event_attendees")
            .select("*")
            .eq("event_id", event_id)
            .eq("user_id", user["id"])
            .limit(1)
            .execute()
        )
        att = att_result.data[0] if att_result.data else None
        e["my_status"] = att["status"] if att else None

    return {"event": e}


@api.post("/events/{event_id}/rsvp")
async def rsvp_event(
    event_id: str,
    status: str = Query(...),
    user: dict = Depends(current_user),
):
    if status not in ("interested", "going", "none"):
        raise HTTPException(400, "Invalid status")

    event_result = (
        supabase.table("events")
        .select("id")
        .eq("id", event_id)
        .limit(1)
        .execute()
    )

    if not event_result.data:
        raise HTTPException(404, "Event not found")

    if status == "none":
        supabase.table("event_attendees").delete().eq(
            "event_id", event_id
        ).eq(
            "user_id", user["id"]
        ).execute()
    else:
        supabase.table("event_attendees").upsert(
            {
                "event_id": event_id,
                "user_id": user["id"],
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="event_id,user_id",
        ).execute()

    return {"ok": True, "status": status}


@api.get("/events/{event_id}/attendees")
async def event_attendees(event_id: str, user: dict = Depends(current_user)):
    att_result = (
        supabase.table("event_attendees")
        .select("*")
        .eq("event_id", event_id)
        .limit(500)
        .execute()
    )
    atts = att_result.data or []

    user_ids = [a["user_id"] for a in atts]

    if not user_ids:
        return {"attendees": []}

    users_result = (
        supabase.table("users")
        .select("*")
        .in_("id", user_ids)
        .limit(500)
        .execute()
    )
    users = users_result.data or []

    umap = {u["id"]: u for u in users}
    result = []

    for a in atts:
        u = umap.get(a["user_id"])
        if not u:
            continue

        score, reasons = compatibility(user, u)
        shared = list(
            set(user.get("interests") or [])
            & set(u.get("interests") or [])
        )

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
    member_ids = c.get("member_ids") or []

    if member_ids:
        result = (
            supabase.table("users")
            .select("*")
            .in_("id", member_ids)
            .limit(50)
            .execute()
        )
        members = result.data or []
    else:
        members = []

    c["members"] = [public_user(m) for m in members]
    c["is_member"] = user["id"] in member_ids
    c["verified_only"] = bool(c.get("verified_only"))
    c["is_lounge"] = bool(c.get("is_lounge"))
    c["type"] = c.get("type") or "group"

    user_int = set(user.get("interests") or [])
    c["shared_with_you"] = list(
        user_int & set(c.get("interests") or [])
    )

    if c["type"] == "dm":
        other = next(
            (m for m in c["members"] if m["id"] != user["id"]),
            None,
        )
        c["other_user"] = other
        c["name"] = (
            f"{other['first_name']} {other['last_name']}"
            if other
            else "Direct message"
        )

    return c


def _circle_visibility(user: dict) -> bool:
    return bool(user.get("verified"))


@api.post("/circles")
async def create_circle(
    body: CircleCreateBody,
    user: dict = Depends(current_user),
):
    if body.verified_only and not user.get("verified"):
        raise HTTPException(
            403,
            "Only CSUF Verified students can create verified-only Circles",
        )

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

    supabase.table("circles").insert(c).execute()

    msg = _dm_system_msg(
        c["id"],
        f"{user['first_name']} created this Circle",
    )
    supabase.table("messages").insert(msg).execute()

    return {"circle": c}


@api.get("/circles")
async def list_circles(
    user: dict = Depends(current_user),
    mine: bool = False,
    dm: bool = False,
):
    query = supabase.table("circles").select("*")

    if not _circle_visibility(user):
        query = query.eq("verified_only", False)

    if dm:
        query = query.eq("type", "dm").contains(
            "member_ids", [user["id"]]
        )
    else:
        query = query.neq("type", "dm")
        if mine:
            query = query.contains(
                "member_ids", [user["id"]]
            )

    result = (
        query
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    circles = result.data or []

    for c in circles:
        await decorate_circle(c, user)

        if dm:
            last_result = (
                supabase.table("messages")
                .select("*")
                .eq("circle_id", c["id"])
                .eq("system", False)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            c["last_message"] = (
                last_result.data[0]
                if last_result.data
                else None
            )

    return {"circles": circles}


@api.get("/lounge")
async def verified_lounge(user: dict = Depends(current_user)):
    """The private lounge only appears once a student is CSUF Verified. Verified users are auto-joined."""
    lounge_result = (
        supabase.table("circles")
        .select("*")
        .eq("is_lounge", True)
        .limit(1)
        .execute()
    )

    lounge = lounge_result.data[0] if lounge_result.data else None

    if not lounge:
        return {"locked": True, "circle": None}

    if not user.get("verified"):
        return {
            "locked": True,
            "circle": None,
            "member_count": len(lounge.get("member_ids") or []),
        }

    member_ids = lounge.get("member_ids") or []

    if user["id"] not in member_ids:
        member_ids.append(user["id"])

        supabase.table("circles").update(
            {"member_ids": member_ids}
        ).eq("id", lounge["id"]).execute()

        msg = _dm_system_msg(
            lounge["id"],
            f"{user['first_name']} unlocked the lounge ✓",
        )
        supabase.table("messages").insert(msg).execute()

        lounge_result = (
            supabase.table("circles")
            .select("*")
            .eq("id", lounge["id"])
            .limit(1)
            .execute()
        )
        lounge = (
            lounge_result.data[0]
            if lounge_result.data
            else lounge
        )

    await decorate_circle(lounge, user)

    return {
        "locked": False,
        "circle": lounge,
        "member_count": len(lounge.get("member_ids") or []),
    }


@api.get("/circles/{circle_id}")
async def get_circle(
    circle_id: str,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("circles")
        .select("*")
        .eq("id", circle_id)
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c:
        raise HTTPException(404, "Not found")

    if c.get("verified_only") and not user.get("verified"):
        raise HTTPException(404, "Not found")

    if (
        c.get("type") == "dm"
        and user["id"] not in (c.get("member_ids") or [])
    ):
        raise HTTPException(404, "Not found")

    await decorate_circle(c, user)

    if c.get("event_id"):
        event_result = (
            supabase.table("events")
            .select("*")
            .eq("id", c["event_id"])
            .limit(1)
            .execute()
        )
        c["event"] = (
            event_result.data[0]
            if event_result.data
            else None
        )

    return {"circle": c}


@api.post("/circles/{circle_id}/join")
async def join_circle(
    circle_id: str,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("circles")
        .select("*")
        .eq("id", circle_id)
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c:
        raise HTTPException(404, "Not found")

    if c.get("verified_only") and not user.get("verified"):
        raise HTTPException(403, "CSUF Verified students only")

    if c.get("type") == "dm":
        raise HTTPException(403, "Direct messages are private")

    member_ids = c.get("member_ids") or []

    if user["id"] not in member_ids:
        member_ids.append(user["id"])

        supabase.table("circles").update(
            {"member_ids": member_ids}
        ).eq("id", circle_id).execute()

        msg = _dm_system_msg(
            circle_id,
            f"{user['first_name']} joined the group",
        )
        supabase.table("messages").insert(msg).execute()

    return {"ok": True}


@api.post("/circles/{circle_id}/leave")
async def leave_circle(
    circle_id: str,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("circles")
        .select("member_ids")
        .eq("id", circle_id)
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if c:
        member_ids = [
            member_id
            for member_id in (c.get("member_ids") or [])
            if member_id != user["id"]
        ]

        supabase.table("circles").update(
            {"member_ids": member_ids}
        ).eq("id", circle_id).execute()

    return {"ok": True}


@api.get("/circles/{circle_id}/messages")
async def circle_messages(
    circle_id: str,
    user: dict = Depends(current_user),
    since: Optional[str] = None,
):
    result = (
        supabase.table("circles")
        .select("member_ids")
        .eq("id", circle_id)
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c:
        raise HTTPException(404, "Not found")

    if user["id"] not in (c.get("member_ids") or []):
        raise HTTPException(403, "Join this Circle to see messages")

    query = (
        supabase.table("messages")
        .select("*")
        .eq("circle_id", circle_id)
    )

    if since:
        query = query.gt("created_at", since)

    result = (
        query
        .order("created_at")
        .limit(500)
        .execute()
    )

    msgs = result.data or []

    ids = list({
        m["sender_id"]
        for m in msgs
        if m.get("sender_id") != "system"
    })

    if ids:
        users_result = (
            supabase.table("users")
            .select("*")
            .in_("id", ids)
            .limit(200)
            .execute()
        )
        users = users_result.data or []
    else:
        users = []

    umap = {u["id"]: u for u in users}

    for m in msgs:
        if m.get("sender_id") == "system":
            m["sender"] = None
        else:
            sender = umap.get(m.get("sender_id"))
            m["sender"] = public_user(sender) if sender else None

    return {"messages": msgs}


@api.post("/circles/{circle_id}/messages")
async def send_message(
    circle_id: str,
    body: MessageBody,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("circles")
        .select("*")
        .eq("id", circle_id)
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c or user["id"] not in (c.get("member_ids") or []):
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

    supabase.table("messages").insert(msg).execute()

    msg["sender"] = public_user(user)

    return {"message": msg}


# ---------------------------------------------------------------------------
# Routes: Connections (1:1)
# ---------------------------------------------------------------------------
async def connection_state(me: str, other: str) -> dict:
    result = (
        supabase.table("connections")
        .select("*")
        .in_("status", ["pending", "accepted"])
        .or_(
            f"and(from_id.eq.{me},to_id.eq.{other}),"
            f"and(from_id.eq.{other},to_id.eq.{me})"
        )
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c:
        return {
            "status": "none",
            "id": None,
            "circle_id": None,
        }

    if c["status"] == "accepted":
        status = "connected"
    else:
        status = (
            "pending_out"
            if c["from_id"] == me
            else "pending_in"
        )

    return {
        "status": status,
        "id": c["id"],
        "circle_id": c.get("circle_id"),
    }


async def _accept_connection(c: dict) -> dict:
    a_result = (
        supabase.table("users")
        .select("*")
        .eq("id", c["from_id"])
        .limit(1)
        .execute()
    )
    b_result = (
        supabase.table("users")
        .select("*")
        .eq("id", c["to_id"])
        .limit(1)
        .execute()
    )

    a = a_result.data[0] if a_result.data else None
    b = b_result.data[0] if b_result.data else None

    shared = list(
        set((a or {}).get("interests") or [])
        & set((b or {}).get("interests") or [])
    )

    dm = {
        "id": str(uuid.uuid4()),
        "type": "dm",
        "name": "Direct message",
        "creator_id": c["from_id"],
        "member_ids": [c["from_id"], c["to_id"]],
        "interests": shared[:5],
        "event_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("circles").insert(dm).execute()

    intro = "You're connected! Say hi 👋"
    if shared:
        intro += f" — you both like {shared[0]}"

    supabase.table("messages").insert(
        _dm_system_msg(dm["id"], intro)
    ).execute()

    supabase.table("connections").update(
        {
            "status": "accepted",
            "circle_id": dm["id"],
            "accepted_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", c["id"]).execute()

    return {
        "status": "connected",
        "id": c["id"],
        "circle_id": dm["id"],
    }


@api.post("/connections/{user_id}")
async def request_connection(
    user_id: str,
    user: dict = Depends(current_user),
):
    if user_id == user["id"]:
        raise HTTPException(
            400,
            "You can't connect with yourself",
        )

    target_result = (
        supabase.table("users")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    target = (
        target_result.data[0]
        if target_result.data
        else None
    )

    if not target:
        raise HTTPException(404, "User not found")

    existing_result = (
        supabase.table("connections")
        .select("*")
        .in_("status", ["pending", "accepted"])
        .or_(
            f"and(from_id.eq.{user['id']},to_id.eq.{user_id}),"
            f"and(from_id.eq.{user_id},to_id.eq.{user['id']})"
        )
        .limit(1)
        .execute()
    )

    existing = (
        existing_result.data[0]
        if existing_result.data
        else None
    )

    if existing:
        if (
            existing["status"] == "pending"
            and existing["to_id"] == user["id"]
        ):
            return {
                "connection": await _accept_connection(existing)
            }

        return {
            "connection": await connection_state(
                user["id"],
                user_id,
            )
        }

    c = {
        "id": str(uuid.uuid4()),
        "from_id": user["id"],
        "to_id": user_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("connections").insert(c).execute()

    return {
        "connection": {
            "status": "pending_out",
            "id": c["id"],
            "circle_id": None,
        }
    }


@api.get("/connections")
async def list_connections(user: dict = Depends(current_user)):
    result = (
        supabase.table("connections")
        .select("*")
        .in_("status", ["pending", "accepted"])
        .or_(
            f"from_id.eq.{user['id']},to_id.eq.{user['id']}"
        )
        .order("created_at", desc=True)
        .limit(300)
        .execute()
    )

    conns = result.data or []

    other_ids = list({
        c["to_id"]
        if c["from_id"] == user["id"]
        else c["from_id"]
        for c in conns
    })

    if other_ids:
        users_result = (
            supabase.table("users")
            .select("*")
            .in_("id", other_ids)
            .limit(300)
            .execute()
        )
        users = users_result.data or []
    else:
        users = []

    umap = {u["id"]: u for u in users}

    incoming = []
    outgoing = []
    connected = []

    for c in conns:
        other_id = (
            c["to_id"]
            if c["from_id"] == user["id"]
            else c["from_id"]
        )

        o = umap.get(other_id)

        if not o:
            continue

        score, reasons = compatibility(user, o)

        item = {
            "id": c["id"],
            "user": public_user(o),
            "compatibility": score,
            "reasons": reasons[:2],
            "circle_id": c.get("circle_id"),
            "created_at": c["created_at"],
        }

        if c["status"] == "accepted":
            connected.append(item)
        elif c["to_id"] == user["id"]:
            incoming.append(item)
        else:
            outgoing.append(item)

    return {
        "incoming": incoming,
        "outgoing": outgoing,
        "connected": connected,
    }


@api.post("/connections/{connection_id}/accept")
async def accept_connection(
    connection_id: str,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("connections")
        .select("*")
        .eq("id", connection_id)
        .eq("to_id", user["id"])
        .eq("status", "pending")
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c:
        raise HTTPException(404, "Request not found")

    return {
        "connection": await _accept_connection(c)
    }


@api.post("/connections/{connection_id}/decline")
async def decline_connection(
    connection_id: str,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("connections")
        .select("id")
        .eq("id", connection_id)
        .eq("status", "pending")
        .or_(
            f"to_id.eq.{user['id']},from_id.eq.{user['id']}"
        )
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(404, "Request not found")

    supabase.table("connections").update(
        {"status": "declined"}
    ).eq("id", connection_id).execute()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: Weekend digest + event reminders
# ---------------------------------------------------------------------------
def event_start(e: dict) -> Optional[datetime]:
    raw = (
        f"{e.get('date', '')} "
        f"{(e.get('time') or '').strip().upper().replace('.', '')}"
    )

    for fmt in (
        "%Y-%m-%d %I:%M %p",
        "%Y-%m-%d %I%p",
        "%Y-%m-%d %I %p",
        "%Y-%m-%d %H:%M",
    ):
        try:
            return datetime.strptime(
                raw,
                fmt,
            ).replace(tzinfo=CAMPUS_TZ)
        except ValueError:
            continue

    return None


async def _attach_event_meta(e: dict, user: dict):
    interested_result = (
        supabase.table("event_attendees")
        .select("user_id", count="exact")
        .eq("event_id", e["id"])
        .in_("status", ["interested", "going"])
        .execute()
    )

    going_result = (
        supabase.table("event_attendees")
        .select("user_id", count="exact")
        .eq("event_id", e["id"])
        .eq("status", "going")
        .execute()
    )

    att_result = (
        supabase.table("event_attendees")
        .select("*")
        .eq("event_id", e["id"])
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )

    att = att_result.data[0] if att_result.data else None

    e["interested_count"] = interested_result.count or 0
    e["going_count"] = going_result.count or 0
    e["my_status"] = att["status"] if att else None


@api.get("/digest/weekend")
async def weekend_digest(user: dict = Depends(current_user)):
    now = datetime.now(CAMPUS_TZ)
    today = now.date()
    wd = today.weekday()

    friday = (
        today + timedelta(days=(4 - wd))
        if wd <= 4
        else today - timedelta(days=wd - 4)
    )

    days = [friday + timedelta(days=i) for i in range(3)]
    day_strs = [
        d.strftime("%Y-%m-%d")
        for d in days
        if d >= today
    ]

    result = (
        supabase.table("events")
        .select("*")
        .in_("date", day_strs)
        .order("date")
        .limit(200)
        .execute()
    )

    events = result.data or []
    rolled = False

    if wd >= 5 and not events:
        rolled = True
        friday = friday + timedelta(days=7)
        days = [
            friday + timedelta(days=i)
            for i in range(3)
        ]
        day_strs = [
            d.strftime("%Y-%m-%d")
            for d in days
        ]

        result = (
            supabase.table("events")
            .select("*")
            .in_("date", day_strs)
            .order("date")
            .limit(200)
            .execute()
        )

        events = result.data or []

    others_result = (
        supabase.table("users")
        .select("*")
        .neq("id", user["id"])
        .eq("onboarded", True)
        .limit(500)
        .execute()
    )

    others = others_result.data or []

    vibe_ids = {
        o["id"]
        for o in others
        if compatibility(user, o)[0] >= 60
    }

    by_day = {d: [] for d in day_strs}

    for e in events:
        await _attach_event_meta(e, user)

        att_result = (
            supabase.table("event_attendees")
            .select("user_id")
            .eq("event_id", e["id"])
            .limit(500)
            .execute()
        )

        atts = att_result.data or []

        e["vibe_count"] = sum(
            1
            for a in atts
            if a["user_id"] in vibe_ids
        )

        if e["date"] in by_day:
            by_day[e["date"]].append(e)

    labels = {
        0: "Monday",
        1: "Tuesday",
        2: "Wednesday",
        3: "Thursday",
        4: "Friday",
        5: "Saturday",
        6: "Sunday",
    }

    out_days = []

    for d in days:
        ds = d.strftime("%Y-%m-%d")

        if ds not in by_day:
            continue

        evs = sorted(
            by_day[ds],
            key=lambda x: (
                event_start(x) or now
            ).timestamp(),
        )

        out_days.append(
            {
                "date": ds,
                "label": labels[d.weekday()],
                "short": d.strftime("%b %d"),
                "events": evs,
            }
        )

    total = sum(
        len(d["events"])
        for d in out_days
    )

    label = (
        f"{days[0].strftime('%b %d')} – "
        f"{days[2].strftime('%b %d')}"
    )

    return {
        "is_friday": wd == 4,
        "is_weekend": wd >= 4,
        "weekend_label": label,
        "total_events": total,
        "headline": (
            "Happy Friday! Here's your weekend"
            if wd == 4
            else (
                "Next weekend on campus"
                if rolled
                else (
                    "This weekend on campus"
                    if wd >= 5
                    else "Plan ahead: this weekend on campus"
                )
            )
        ),
        "days": out_days,
    }


REMINDER_WINDOW_MIN = 120


@api.get("/reminders")
async def upcoming_reminders(user: dict = Depends(current_user)):
    """Events the user RSVPed to that start within the next 2 hours."""
    now = datetime.now(CAMPUS_TZ)

    att_result = (
        supabase.table("event_attendees")
        .select("*")
        .eq("user_id", user["id"])
        .in_("status", ["going", "interested"])
        .limit(500)
        .execute()
    )

    atts = att_result.data or []

    if not atts:
        return {"reminders": []}

    ids = [a["event_id"] for a in atts]
    status_map = {
        a["event_id"]: a["status"]
        for a in atts
    }

    dismissed_result = (
        supabase.table("reminder_dismissals")
        .select("event_id")
        .eq("user_id", user["id"])
        .limit(500)
        .execute()
    )

    dismissed = {
        d["event_id"]
        for d in (dismissed_result.data or [])
    }

    events_result = (
        supabase.table("events")
        .select("*")
        .in_("id", ids)
        .limit(500)
        .execute()
    )

    events = events_result.data or []

    out = []

    for e in events:
        if e["id"] in dismissed:
            continue

        start = event_start(e)

        if not start:
            continue

        mins = int(
            (start - now).total_seconds() // 60
        )

        if 0 <= mins <= REMINDER_WINDOW_MIN:
            e["starts_in_minutes"] = mins
            e["my_status"] = status_map.get(e["id"])
            out.append(e)

    out.sort(
        key=lambda x: x["starts_in_minutes"]
    )

    return {"reminders": out}


@api.post("/reminders/{event_id}/dismiss")
async def dismiss_reminder(
    event_id: str,
    user: dict = Depends(current_user),
):
    supabase.table("reminder_dismissals").upsert(
        {
            "user_id": user["id"],
            "event_id": event_id,
            "dismissed_at": datetime.now(
                timezone.utc
            ).isoformat(),
        },
        on_conflict="user_id,event_id",
    ).execute()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: Recommendations
# ---------------------------------------------------------------------------
@api.post("/recommendations")
async def create_recommendation(
    body: RecommendationCreateBody,
    user: dict = Depends(current_user),
):
    r = {
        "id": str(uuid.uuid4()),
        "creator_id": user["id"],
        "creator_name": f"{user['first_name']} {user['last_name']}",
        "creator_photo": user.get("profile_photo_url"),
        **body.model_dump(),
        "saves": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("recommendations").insert(r).execute()

    return {"recommendation": r}


@api.get("/recommendations")
async def list_recommendations(
    q: Optional[str] = Query(None, max_length=80),
):
    result = (
        supabase.table("recommendations")
        .select("*")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )

    recs = result.data or []

    if q:
        search = q.lower()
        recs = [
            r for r in recs
            if search in (r.get("title") or "").lower()
            or search in (r.get("description") or "").lower()
        ]

    return {"recommendations": recs}


# ---------------------------------------------------------------------------
# Routes: Clubs
# ---------------------------------------------------------------------------
@api.get("/clubs")
async def list_clubs():
    result = (
        supabase.table("clubs")
        .select("*")
        .limit(200)
        .execute()
    )

    return {"clubs": result.data or []}


@api.get("/clubs/{club_id}")
async def get_club(club_id: str):
    result = (
        supabase.table("clubs")
        .select("*")
        .eq("id", club_id)
        .limit(1)
        .execute()
    )

    c = result.data[0] if result.data else None

    if not c:
        raise HTTPException(404, "Not found")

    return {"club": c}


# ---------------------------------------------------------------------------
# Routes: Reports / Block
# ---------------------------------------------------------------------------
@api.post("/reports")
async def create_report(
    body: ReportBody,
    user: dict = Depends(current_user),
):
    report = {
        "id": str(uuid.uuid4()),
        "reporter_id": user["id"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("reports").insert(report).execute()

    return {"ok": True}


@api.post("/block/{user_id}")
async def block_user(
    user_id: str,
    user: dict = Depends(current_user),
):
    result = (
        supabase.table("users")
        .select("blocked")
        .eq("id", user["id"])
        .limit(1)
        .execute()
    )

    current = (
        result.data[0]
        if result.data
        else {}
    )

    blocked = list(current.get("blocked") or [])

    if user_id not in blocked:
        blocked.append(user_id)

    supabase.table("users").update(
        {"blocked": blocked}
    ).eq("id", user["id"]).execute()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Uploads (Supabase Storage)
# ---------------------------------------------------------------------------
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
SUPABASE_STORAGE_BUCKET = "circle-uploads"


@api.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    content_type = (
        (file.content_type or "")
        .split(";")[0]
        .strip()
        .lower()
    )

    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            415,
            "Only JPEG, PNG, WEBP, GIF or HEIC images are allowed",
        )

    data = await file.read(MAX_UPLOAD_BYTES + 1)

    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            413,
            "Image must be under 10 MB",
        )

    if not data:
        raise HTTPException(400, "Empty file")

    key = (
        f"{APP_NAME}/uploads/"
        f"{user['id']}/"
        f"{uuid.uuid4()}."
        f"{ALLOWED_IMAGE_TYPES[content_type]}"
    )

    try:
        supabase.storage.from_(
            SUPABASE_STORAGE_BUCKET
        ).upload(
            key,
            data,
            {
                "content-type": content_type,
                "upsert": False,
            },
        )
    except Exception as e:
        logger.error(f"Supabase storage upload failed: {e}")
        raise HTTPException(
            500,
            "Upload failed",
        )

    upload_meta = {
        "path": key,
        "owner_id": user["id"],
        "content_type": content_type,
        "size": len(data),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("uploads").insert(
        upload_meta
    ).execute()

    return {
        "path": key,
        "url": f"/api/files/{key}",
    }


@api.get("/files/{path:path}")
async def download_file(
    path: str,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    ok = False

    if authorization and authorization.startswith("Bearer "):
        try:
            jwt.decode(
                authorization[7:],
                JWT_SECRET,
                algorithms=["HS256"],
            )
            ok = True
        except Exception:
            pass

    if not ok and token:
        try:
            jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
            )
            ok = True
        except Exception:
            pass

    if not ok:
        raise HTTPException(401, "Auth required")

    meta_result = (
        supabase.table("uploads")
        .select("*")
        .eq("path", path)
        .limit(1)
        .execute()
    )

    meta = (
        meta_result.data[0]
        if meta_result.data
        else None
    )

    if not meta:
        raise HTTPException(404, "Not found")

    try:
        content = supabase.storage.from_(
            SUPABASE_STORAGE_BUCKET
        ).download(path)
    except Exception:
        raise HTTPException(
            500,
            "Read failed",
        )

    safe_ct = (
        meta.get("content_type")
        if meta.get("content_type")
        in ALLOWED_IMAGE_TYPES
        else "application/octet-stream"
    )

    return Response(
        content=content,
        media_type=safe_ct,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
            "Cache-Control": "private, max-age=3600",
        },
    )


# ---------------------------------------------------------------------------
# Health + include
# ---------------------------------------------------------------------------
@api.get("/health")
async def health():
    return {
        "ok": True,
        "time": datetime.now(timezone.utc).isoformat(),
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault(
        "X-Content-Type-Options",
        "nosniff",
    )
    resp.headers.setdefault(
        "X-Frame-Options",
        "DENY",
    )
    resp.headers.setdefault(
        "Referrer-Policy",
        "no-referrer",
    )
    resp.headers.setdefault(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
    )
    return resp


# ---------------------------------------------------------------------------
# Seed demo data on startup
# ---------------------------------------------------------------------------
from seed_data import seed_all, seed_lounge  # noqa: E402

@app.on_event("startup")
async def on_start():
    try:
        await seed_all(supabase, hash_password)
        await seed_lounge(supabase)
        logger.info("Seed check complete")
    except Exception as e:
        logger.error(f"Seed failed: {e}")
