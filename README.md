# Circle

Circle is a mobile-first campus social discovery app for meeting people through shared interests, events, and small group chats.

## Stack

- Expo / React Native with Expo Router
- FastAPI backend
- Supabase Postgres and Storage
- Custom JWT authentication

## Local development

Backend environment variables required:

```bash
JWT_SECRET=replace-with-a-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Frontend environment variable required:

```bash
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

Start the backend from `backend/`:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Start the frontend from `frontend/`:

```bash
yarn start
```

For Codespaces, set `EXPO_PUBLIC_BACKEND_URL` to the public forwarded URL for port 8000 before starting Expo.

## Branch safety

Active migration work lives on `supabase-migration`. Keep production secrets out of Git and do not commit local `.env` files.
