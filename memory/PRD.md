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
- Seeded demo data (30 users, 15 events, 8 clubs, 5 recs, 3 Circles), idempotent.

## Mocked
- CSUF verify is one-tap simulated (no SSO).
- Match reasons are deterministic (no AI).
- Chat is polling, not websocket.

## Tech
Backend FastAPI + Motor. Frontend Expo Router 57, React 19, expo-image, expo-image-picker.
