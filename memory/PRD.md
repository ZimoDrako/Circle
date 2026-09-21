# CIRCLE — Campus Social Discovery MVP

## Overview
CIRCLE is a mobile-first Expo/React Native app for CSUF students to discover people, events, recommendations and small "Circles" of 4-10 students. Core loop: **QUESTIONNAIRE → MATCH → EVENT → FIND PEOPLE → CIRCLE → CHAT**.

## Implemented
- Auth (email/password + JWT + bcrypt), simulated CSUF student verification.
- 7-step onboarding: looking-for, interests, social-style questions, personality sliders, campus life, availability, profile photo upload.
- Deterministic matching: shared interests 30%, social style 20%, personality 15%, looking-for 15%, availability 10%, campus 10%. Returns 0–100 with human "why you match" reasons.
- Home: greeting, today's events, People you might vibe with, Your Circles, Try something new.
- Discover: Events / People / Recommendations / Clubs with search.
- Events: create, list, RSVP, attendees ranked by compatibility, "Find People to Go With" → creates Event Circle + auto group chat.
- Circles: mine/discover, avatar stack, shared-interest tags, "Why you're seeing this" explanation.
- Group chat: polling every 4s, system messages, event pill at top.
- Recommendations + Clubs (seeded), reports/block endpoints.
- Uploads via Emergent Object Storage.
- Seeded demo data (30 users, 15 events, 8 clubs, 5 recs, 3 Circles + Verified Lounge), idempotent.
- **Connection Requests (1:1):** Connect on a profile → request; when the other person connects back (or taps Accept in Circles → Messages) a private DM circle (`type: "dm"`) opens. Endpoints: `POST/GET /api/connections`, `/accept`, `/decline`, `GET /api/circles?dm=true`.
- **Weekend Digest:** `GET /api/digest/weekend` (America/Los_Angeles) bundles Fri–Sun events by day with "N you vibe with going"; Home card (Friday gets emphasized "Friday digest") → `/digest` screen.
- **Event Reminders (in-app):** `GET /api/reminders` returns RSVPed events starting within 2h; Home shows a dismissible nudge banner; event detail shows "We'll nudge you 2 hours before".
- **Verified Only Circles:** `verified_only` circles are hidden/403 for unverified users. Seeded private "Verified Lounge" (`GET /api/lounge`) is locked until the student taps CSUF Verified, then auto-joins them; Circles tab shows a locked teaser vs. the open lounge card.

## Mocked
- CSUF verify is one-tap simulated (no SSO).
- Match reasons are deterministic (no AI).
- Chat is polling, not websocket.
- Event reminders are in-app nudges on Home (no push notifications).

## Tech
Backend FastAPI + Motor. Frontend Expo Router 57, React 19, expo-image, expo-image-picker.

## Security (audited)
- JWT secret is a strong random value in backend/.env (set a fresh one per deployment); 30-day tokens.
- Circle messages require membership; DMs are invisible to non-members. Verified-only circles hidden/403 for unverified users.
- Uploads: image types only, 10 MB cap, served with stored content type + nosniff.
- Search terms regex-escaped and length-capped; password ≥ 8 chars; messages ≤ 2000 chars; auth endpoints rate-limited 30/min/IP; security headers on all responses.
- Accepted for MVP: file URLs carry `?token=` (needed for `expo-image`), CORS `*` without credentials.
