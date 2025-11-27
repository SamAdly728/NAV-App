# NAV Productions Admin App

Node.js + Express server layered onto the purchased HTML template to provide:
- Auth with Google OAuth
- Role-based dashboards (admin/client) initially using the same `template/index.html`
- Session auth via cookies (Postgres-backed)
- Integrations stubs: Stripe, Dropbox, GoHighLevel (GHL)
- Render-friendly deployment

## Prerequisites
- Node 18+
- A Postgres database (Render free tier works)

## Setup

1) Install dependencies

```powershell
npm install
```

2) Configure environment
- Copy `.env.example` to `.env` and fill values, or use the provided `.env`.
- Required keys:
  - `DATABASE_URL` (Render External URL for local dev)
  - `SESSION_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  - Optional: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `DROPBOX_ACCESS_TOKEN`, `GHL_API_KEY`

3) Initialize database

```powershell
npm run db:migrate
npm run db:seed:admin
```

4) Run locally

```powershell
npm run dev
```
- Open http://localhost:8080
- Root redirects to the sign-in page. Use the "Continue with Google" button.

## Project Structure
- `src/server.js` — Express server
- `src/auth/google.js` — Google OAuth (Passport)
- `src/middleware/auth.js` — Auth + role guards
- `src/db/pool.js` — Postgres pool
- `src/routes/*` — API routers (auth, stripe, dropbox, ghl)
- `src/services/users.js` — User service
- `src/scripts/*` — DB migration + admin seed
- `template/` — HTML template files served as views
- `assets/` — static assets (css, js, images, vendor)

## GoHighLevel (GHL) Integration

GHL endpoints are proxied server-side and require a valid API key. The system auto-resolves `locationId` from the JWT payload in `GHL_API_KEY`, or you can set it explicitly.

Environment variables:
- `GHL_API_KEY` (required) — Location-scoped API key from GHL/LeadConnector
- `GHL_LOCATION_ID` (optional) — Overrides auto-detected location if needed
- `GHL_WEBHOOK_SECRET` (recommended) — Shared secret to validate incoming webhooks

### Endpoints

All endpoints below require an authenticated session (except the secret-protected webhook receiver/viewer):

- `GET /api/ghl/dashboard?force=0|1&debug=0|1`
   - Aggregates bookings (appointments), opportunities, activities, and payments.
   - Response includes raw objects plus normalized arrays for front-end use:
      - `bookingsList` (appointments array)
      - `opportunitiesList`
      - `activitiesList`
   - `force=1` bypasses cache (default TTL ~60s). `debug=1` adds `_debug` keys and raw payload keys.

- `GET /api/ghl/appointments`
   - Query params supported: `calendarId`, `contactId`, `dateFrom`, `dateTo`, `status`, `limit`, `page`
   - Returns `{ items: [...] }` and supports `debug=1` to expose raw payload keys.

- `GET /api/ghl/appointments/upcoming?limit=5`
   - Returns soonest upcoming appointments sorted ascending: `{ items: [...] }`

- `GET /api/ghl/appointments/:id`
   - Returns a single appointment payload from GHL.

- `GET /api/ghl/bookings`
   - Alias for appointments list with a default limit; returns GHL appointment data.

- `GET /api/ghl/booking-webhooks/recent` (admin only)
   - Returns `{ items: [...] }` from an in-memory recent-events list populated by the webhook receiver.

### Dashboard Widget

`template/index.html` contains a NAV-branded “Live information” card that fetches `/api/ghl/dashboard` and renders:
- Upcoming bookings
- Pipeline stage counts (based on opportunities)
- Recent activities (from conversations search)
- Payments summary (best effort; may be empty if Payments API is unavailable)

Use the Refresh button on the widget to bypass cache. For troubleshooting empty lists, hit `/api/ghl/dashboard?debug=1` and check `_debug`.

### Webhooks

Receiver (public, secret-protected):
- `POST /webhooks/ghl/booking?secret=YOUR_SECRET`
   - Alternatively send header: `x-ghl-webhook-secret: YOUR_SECRET`
   - Accepts appointment/booking-style JSON bodies and stores a normalized entry in an in-memory list.
   - On receipt, invalidates cached dashboard/bookings.

Viewer (public, secret-protected):
- `GET /webhooks/ghl/booking/recent?secret=YOUR_SECRET`
   - Returns the most recent received events: `{ items: [...] }`

Admin API (session-auth, admin role):
- `GET /api/ghl/booking-webhooks/recent`

Setup in GHL:
1) Generate a strong random `GHL_WEBHOOK_SECRET` and set it in your environment.
2) In GHL workflow, add a Webhook action:
    - Method: POST
    - URL: `https://YOUR-RENDER-APP.onrender.com/webhooks/ghl/booking?secret=YOUR_SECRET`
    - Body: JSON (send appointment/booking fields)
3) Test by sending a sample payload. You can verify receipt at:
    - `https://YOUR-RENDER-APP.onrender.com/webhooks/ghl/booking/recent?secret=YOUR_SECRET`
    - Or (when logged in as admin): `/api/ghl/booking-webhooks/recent`

Notes:
- The webhook viewer URL is read-only; do not use it as the workflow’s POST target.
- If `GHL_WEBHOOK_SECRET` is unset in development, the receiver accepts all requests (dev convenience).

## NAV Generic Data Webhook

Need to seed or sync data from an external workflow? Use the generic `/webhooks/data/:table` endpoint documented in `docs/nav_generic_webhook.md`. It covers:
- Authentication with `GHL_WEBHOOK_SECRET`
- Endpoint usage and required headers
- Order-of-operations guidance for foreign keys
- JSON payload templates for every supported table (roles, users, clients, bookings, projects, tickets, payments, etc.)

The migration runner already provisioned all referenced tables. Review the doc before posting to ensure parent records exist (for example create `users` → `clients` → `properties`).

## Render Deployment
1) Create a new Web Service on Render:
   - Runtime: Node
   - Start command: `node src/server.js`
2) Create a Render PostgreSQL instance and copy `External Database URL` into `DATABASE_URL`.
3) Add Environment Variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET=...`
   - `DATABASE_URL=...`
   - `PGSSLMODE=require`
   - `PUBLIC_URL=https://YOUR-RENDER-APP.onrender.com`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI=https://YOUR-RENDER-APP.onrender.com/auth/google/callback`
   - Optionally: Stripe, Dropbox, GHL keys
   - Recommended for GHL webhooks: `GHL_WEBHOOK_SECRET=...`
4) Redeploy. Visit root `/` to see sign-in. If authenticated, you’ll be redirected to `/dashboard`.

## Notes
- For now, both admin and client dashboards point to `template/index.html`.
- Update role-based content by branching templates or adding dynamic sections.
- Strengthen cookies in production automatically (`secure: true` on HTTPS).
- Consider CSRF protection for future email/password forms.

## Branding
- Initial branding applied to `template/sign_in.html` and `template/index.html`.
- To extend branding, replace meta/title/footer and imagery across other pages. A simple find/replace of "ki-admin" to "NAV Productions" will catch most text.

## Roadmap
- Add email/password auth with password reset
- Implement Stripe flows and webhooks
- Implement Dropbox uploads
- Implement GHL bookings proxy endpoints
- Create separate admin/client dashboards
- Persist webhook events to Postgres and add admin UI for filtering/search
- Finalize payments summary using Stripe or GHL Transactions API
