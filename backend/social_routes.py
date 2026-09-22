"""Activity, invitations, and Daily Circle routes for Circle."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid

def build_social_router(supabase, current_user, public_user, compatibility, campus_tz):
    router = APIRouter()

    class DailyIntentBody(BaseModel):
        vibe: str = Field(min_length=1, max_length=40)
        time_preference: str = Field(min_length=1, max_length=40)
        people_preference: str = Field(min_length=1, max_length=40)

    class InviteBody(BaseModel):
        recipient_ids: list[str] = []

    def notify(user_id, kind, title, body="", actor_id=None, entity_type=None, entity_id=None):
        n={"id":str(uuid.uuid4()),"user_id":user_id,"actor_id":actor_id,"type":kind,"title":title,"body":body,"entity_type":entity_type,"entity_id":entity_id,"read":False,"created_at":datetime.now(timezone.utc).isoformat()}
        supabase.table("notifications").insert(n).execute()
        return n

    @router.get("/notifications")
    async def notifications(user: dict = Depends(current_user)):
        result=supabase.table("notifications").select("*").eq("user_id",user["id"]).order("created_at",desc=True).limit(100).execute()
        rows=result.data or []
        actor_ids=list({x["actor_id"] for x in rows if x.get("actor_id")})
        actors={}
        if actor_ids:
            ur=supabase.table("users").select("*").in_("id",actor_ids).execute()
            actors={u["id"]:public_user(u) for u in (ur.data or [])}
        for row in rows: row["actor"]=actors.get(row.get("actor_id"))
        return {"notifications":rows,"unread_count":sum(1 for x in rows if not x.get("read"))}

    @router.post("/notifications/read-all")
    async def read_all(user: dict = Depends(current_user)):
        supabase.table("notifications").update({"read":True}).eq("user_id",user["id"]).eq("read",False).execute()
        return {"ok":True}

    @router.post("/notifications/{notification_id}/read")
    async def read_one(notification_id: str,user: dict = Depends(current_user)):
        supabase.table("notifications").update({"read":True}).eq("id",notification_id).eq("user_id",user["id"]).execute()
        return {"ok":True}

    @router.post("/events/{event_id}/invite")
    async def invite_event(event_id: str,body: InviteBody,user: dict = Depends(current_user)):
        er=supabase.table("events").select("*").eq("id",event_id).limit(1).execute()
        event=er.data[0] if er.data else None
        if not event: raise HTTPException(404,"Event not found")
        sent=0
        for rid in list(dict.fromkeys(body.recipient_ids))[:50]:
            if rid==user["id"]: continue
            ur=supabase.table("users").select("id").eq("id",rid).limit(1).execute()
            if not ur.data: continue
            existing=supabase.table("event_invitations").select("id").eq("event_id",event_id).eq("sender_id",user["id"]).eq("recipient_id",rid).eq("status","pending").limit(1).execute()
            if existing.data: continue
            inv={"id":str(uuid.uuid4()),"event_id":event_id,"sender_id":user["id"],"recipient_id":rid,"status":"pending","created_at":datetime.now(timezone.utc).isoformat()}
            supabase.table("event_invitations").insert(inv).execute()
            notify(rid,"event_invite",f"{user['first_name']} invited you",event.get("title") or "Event",user["id"],"event",event_id)
            sent+=1
        return {"ok":True,"sent":sent}

    @router.get("/daily-circle")
    async def daily_status(user: dict = Depends(current_user)):
        today=datetime.now(campus_tz).date().isoformat()
        rr=supabase.table("daily_circle_intents").select("*").eq("user_id",user["id"]).eq("intent_date",today).order("created_at",desc=True).limit(1).execute()
        intent=rr.data[0] if rr.data else None
        circle=None
        if intent and intent.get("circle_id"):
            cr=supabase.table("circles").select("*").eq("id",intent["circle_id"]).limit(1).execute()
            circle=cr.data[0] if cr.data else None
        return {"intent":intent,"circle":circle}

    @router.post("/daily-circle")
    async def daily_match(body: DailyIntentBody,user: dict = Depends(current_user)):
        today=datetime.now(campus_tz).date().isoformat()
        old=supabase.table("daily_circle_intents").select("*").eq("user_id",user["id"]).eq("intent_date",today).order("created_at",desc=True).limit(1).execute()
        now=datetime.now(timezone.utc).isoformat()
        if old.data and old.data[0].get("status")=="matched" and old.data[0].get("circle_id"):
            intent=old.data[0]
            cr=supabase.table("circles").select("*").eq("id",intent["circle_id"]).limit(1).execute()
            if cr.data:
                return {"status":"matched","intent":intent,"circle":cr.data[0],"matches":[]}
        if old.data:
            intent=old.data[0]
            supabase.table("daily_circle_intents").update({"vibe":body.vibe,"time_preference":body.time_preference,"people_preference":body.people_preference,"status":"waiting","circle_id":None,"updated_at":now}).eq("id",intent["id"]).execute()
            intent.update({"vibe":body.vibe,"time_preference":body.time_preference,"people_preference":body.people_preference,"status":"waiting","circle_id":None,"updated_at":now})
        else:
            intent={"id":str(uuid.uuid4()),"user_id":user["id"],"vibe":body.vibe,"time_preference":body.time_preference,"people_preference":body.people_preference,"status":"waiting","circle_id":None,"intent_date":today,"created_at":now,"updated_at":now}
            supabase.table("daily_circle_intents").insert(intent).execute()

        qr=supabase.table("daily_circle_intents").select("*").eq("intent_date",today).eq("status","waiting").eq("vibe",body.vibe).eq("time_preference",body.time_preference).neq("user_id",user["id"]).limit(30).execute()
        candidates=qr.data or []
        if len(candidates)<2:
            return {"status":"waiting","intent":intent,"matches":[],"needed":2-len(candidates)}

        ids=[x["user_id"] for x in candidates]
        ur=supabase.table("users").select("*").in_("id",ids).execute()
        scored=[]
        for other in (ur.data or []):
            if other.get("university")!=user.get("university"): continue
            score,reasons=compatibility(user,other)
            scored.append((score,other,reasons))
        scored.sort(key=lambda x:x[0],reverse=True)
        chosen=scored[:4]
        if len(chosen)<2:
            return {"status":"waiting","intent":intent,"matches":[],"needed":2-len(chosen)}

        members=[user["id"]]+[x[1]["id"] for x in chosen]
        circle={"id":str(uuid.uuid4()),"type":"group","name":f"{body.vibe} · {body.time_preference}","creator_id":user["id"],"member_ids":members,"interests":[body.vibe],"event_id":None,"description":f"Daily Circle for {body.vibe.lower()} — {body.time_preference.lower()}.","verified_only":False,"is_lounge":False,"created_at":now}
        supabase.table("circles").insert(circle).execute()
        supabase.table("messages").insert({"id":str(uuid.uuid4()),"circle_id":circle["id"],"sender_id":"system","content":f"Your Daily Circle is ready. You all picked {body.vibe} for {body.time_preference.lower()}.","system":True,"created_at":now}).execute()
        supabase.table("daily_circle_intents").update({"status":"matched","circle_id":circle["id"],"updated_at":now}).in_("user_id",members).eq("intent_date",today).execute()
        for uid in members:
            if uid!=user["id"]: notify(uid,"daily_circle","Your Circle is ready",f"{body.vibe} · {body.time_preference}",user["id"],"circle",circle["id"])
        return {"status":"matched","intent":intent,"circle":circle,"matches":[{"user":public_user(o),"compatibility":s,"reasons":r} for s,o,r in chosen]}

    return router
