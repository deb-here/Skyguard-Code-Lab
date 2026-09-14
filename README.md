# Collaborative Python code lab

Real-time collaborative Python editor: Monaco + Yjs for live co-editing,
Supabase for auth/persistence/history, a standalone Node.js Hocuspocus
server for CRDT sync, and Piston for sandboxed code execution.

## Structure
```
apps/web/            Next.js frontend (deploy to Vercel)
apps/collab-server/  Node.js Yjs/Hocuspocus WebSocket server (deploy to Fly.io/Railway)
supabase/schema.sql  Postgres schema + RLS policies
```

## Setup
1. Create a Supabase project. Run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env` in both `apps/web` and `apps/collab-server`,
   filling in your Supabase URL/keys. `SUPABASE_JWT_SECRET` is under
   Project Settings > API > JWT Settings in Supabase.
3. `npm install` at the repo root (npm workspaces).
4. `npm run dev:collab` — starts the Yjs server on :1234.
5. `npm run dev:web` — starts Next.js on :3000.
6. Create a room + file row via Supabase (or build an admin UI for this),
   add yourself to `room_members`, then visit `/room/<file-id>`.

## Deployment
- **Frontend**: push `apps/web` to Vercel (root directory = `apps/web`).
- **Collab server**: deploy `apps/collab-server` to Fly.io/Railway — it
  needs a long-lived process and WebSocket support, which Vercel's
  serverless functions don't provide.
- **Supabase**: managed, nothing to deploy.

## History / attribution
`code_history` stores periodic snapshots tagged with whichever users were
connected at the time (see `onConnect` in `collab-server/src/server.js`).
This is a "who touched this file recently" log, not per-character git-blame.
For per-character attribution, tag Yjs inserts with the author's user ID
using `Y.Text` formatting attributes and reconstruct authorship per line —
more accurate, more engineering effort.

## Security notes
- The collab server holds the Supabase **service-role** key — never expose
  it to the browser. Only `NEXT_PUBLIC_*` keys go to the client.
- `onAuthenticate` in the collab server verifies the Supabase JWT and checks
  `room_members` before allowing a socket to join a document.
- `/api/run` proxies code execution server-side so the sandbox is never
  called directly from the browser, and every run is logged to `run_results`.
