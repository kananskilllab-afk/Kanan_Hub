# My Kanan Hub — React + Node + MongoDB

Full-stack rebuild of the original static prototype (`my_kanan_hub_v2.html`, kept for reference).

## Structure

- `server/` — Express API + MongoDB (Mongoose)
- `client/` — React app (Vite) + React Router

## What's live vs. ported

**Backed by real MongoDB data:** Login/auth, Dashboard stats, My Tasks (add/toggle/delete), Leave Management (balance + apply leave with validation).

**Ported UI (original mock content, not yet wired to the DB):** every other module — ESS, Payroll, Profile, Employees, Policies, Schedule, News, CRM, Coaching, K Apply, VAS, Events, Knowledgebase, MOM, Reports, Training, Culture, Leaderboard, K Points, Badges, Helpdesk, Assets, Rooms, Requests. These render the same design as the prototype and are ready to be wired to their own models/routes next, module by module.

## Setup

### 1. Backend

```
cd server
npm install
npm run seed   # creates the demo user + sample tasks/announcements in MongoDB
npm run dev    # starts the API on http://localhost:5000
```

Demo login: `chirag@kanan.co` / `password123`

The MongoDB connection string lives in `server/.env` (gitignored — never commit it). Rotate the database password in MongoDB Atlas since it was shared in plain text during setup.

### 2. Frontend

```
cd client
npm install
npm run dev    # starts the app on http://localhost:5173
```

Open http://localhost:5173 and sign in with the demo credentials above.

## Notes

- JWT auth, 7-day token, stored in `localStorage`.
- `server/.env.example` shows the required environment variables without secrets.
- To wire up another module: add a Mongoose model + route in `server/`, then replace its entry in `client/src/legacy/pageFragments.json` usage (swap `<LegacyPage id="..." />` in `App.jsx` for a real page component, same pattern as `Tasks.jsx` / `Leave.jsx`).
