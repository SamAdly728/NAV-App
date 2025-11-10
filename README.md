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
