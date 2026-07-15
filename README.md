# Supplier Cheque Management System

A full-stack system for managing supplier profiles, purchases, cheque payments (with partial-payment allocation), SMS due-date alerts, daily sales revenue with an auto-deposited savings account, and monthly reporting with PDF/Excel exports.

```
supplier-cheque-system/
├── backend/     Node.js + Express + SQLite REST API (layered architecture)
└── frontend/    React (Vite) single-page app
```

## Quick start

**1. Backend**
```bash
cd backend
cp .env.example .env        # edit JWT_SECRET, admin credentials, phone
npm install
npm start                   # http://localhost:4000  (runs migration + creates admin on first start)
```

**2. Frontend** (second terminal)
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173  (proxies /api to the backend)
```

Sign in with the admin credentials from `.env` (default `admin` / `admin123` — change these).

## Layered architecture (backend)

| Layer | Folder | Responsibility |
|---|---|---|
| HTTP routes | `src/routes` | Endpoint definitions only; everything except login requires a JWT |
| Controllers | `src/controllers` | Request/response mapping, no business rules |
| Services | `src/services` | Business rules: cheque lifecycle, allocation validation, SMS side effects, savings ledger, reports, scheduler, backups |
| Repositories | `src/repositories` | SQL data access only |
| Middleware | `src/middleware` | JWT auth, error translation |
| Config / utils | `src/config`, `src/utils` | Env, DB connection, validators, SMS gateway adapter |
| Database | `src/database` | `schema.sql`, migration, optional seed |

## Feature map

- **Suppliers** — full CRUD; suppliers with transaction history are archived (soft delete) instead of removed so records never break.
- **Purchases** — linked to suppliers; each row shows total / paid / outstanding, where "paid" is derived from cheque allocations (bounced or cancelled cheques don't count).
- **Cheques** — unique cheque numbers enforced, issue/due date validation, lifecycle `issued → pending → partially_paid → cleared | bounced | cancelled` with legal transitions enforced server-side. A cheque can be split across multiple purchases and a purchase can be settled by multiple cheques (partial payments), with over-allocation blocked.
- **Clearing a cheque** draws the amount from the savings account (blocked if the balance is insufficient) and sends a confirmation SMS. Bouncing sends an alert SMS; a bounced cheque can be re-presented (`bounced → pending`).
- **SMS alerts** — a daily cron sweep sends reminders 7, 3 and 1 days before due dates (intervals configurable in Settings), plus daily overdue warnings. Message format: `Supplier | Cheque No | Amount | Due date`. Every message is recorded in the SMS log with delivery status. A guard table prevents duplicate reminders.
- **SMS gateway** — `SMS_PROVIDER=console` prints messages to the server log for development; `SMS_PROVIDER=http` POSTs to any REST gateway (`SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`). Adjust the payload in `src/utils/smsGateway.js` for your provider (Twilio, Notify.lk, Dialog Ideamart, etc.).
- **Sales & savings** — daily revenue entries automatically post a deposit to the savings ledger; the account view shows balance, total deposits, funds committed to pending cheques, and what's available for clearance.
- **Reports** — monthly summary (spend total, per-supplier breakdown, revenue deposited, cheque statistics), 6-month spending-vs-revenue chart, savings growth chart, due-date calendar, and Excel/PDF exports.
- **Admin** — single admin user, JWT auth, password change, and a full activity log of every modification.
- **Backups** — the SQLite database is copied nightly to `backend/data/backups` with rotation (`BACKUP_KEEP`); manual "Back up now" available in Settings.

## Deployment notes

- The frontend builds to static files (`npm run build`); serve `frontend/dist` from any static host or behind the API with a reverse proxy that routes `/api` to the backend.
- SQLite keeps the whole database in `backend/data/cheque_system.db` — trivially portable; move to a cloud VM and the nightly backup folder can be synced to cloud storage (e.g. a cron `rclone`/S3 sync) for off-site backups.
- Set a strong `JWT_SECRET` and change the default admin password before going live.
