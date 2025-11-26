// Basic Express server to serve template pages and handle auth/integrations
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
require('dotenv').config();

const { ensureAuth, ensureRole } = require('./middleware/auth');
const { pool } = require('./db/pool');

// Register passport strategies
require('./auth/google');

// Routers
const authRouter = require('./routes/auth');
const stripeRouter = require('./routes/stripe');
const dropboxRouter = require('./routes/dropbox');
const ghlRouter = require('./routes/ghl');
const ghlWebhookRouter = require('./routes/ghl_webhook');

const app = express();

// Basic config
app.set('trust proxy', 1); // for Render/Proxies
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions in Postgres
const sessionMiddleware = session({
  store: new pgSession({
    pool, // Connect session store to our DB pool
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
});
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

// Static assets
app.use('/assets', express.static(path.join(process.cwd(), 'assets')));
app.use('/template', express.static(path.join(process.cwd(), 'template')));

// Root -> login if not authed
app.get('/', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  return res.sendFile(path.join(process.cwd(), 'template', 'sign_in.html'));
});

// Health check for Render
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Dashboard (shared template). We'll inject role label via client-side fetch.
app.get('/dashboard', ensureAuth, (req, res) => {
  return res.sendFile(path.join(process.cwd(), 'template', 'index.html'));
});

// Serve any template page (authenticated) to allow in-template links to work.
app.get('/template/:page', ensureAuth, (req, res, next) => {
  const file = req.params.page;
  // basic whitelist: only .html
  if (!/^[A-Za-z0-9_-]+\.html$/.test(file)) return res.status(404).send('Not found');
  const full = path.join(process.cwd(), 'template', file);
  return res.sendFile(full, (err) => {
    if (err) return next(err);
  });
});

// Convenience: allow root relative access without /template prefix for existing hrefs
app.get('/:page.html', ensureAuth, (req, res, next) => {
  const file = req.params.page + '.html';
  const full = path.join(process.cwd(), 'template', file);
  return res.sendFile(full, (err) => {
    if (err) return next();
  });
});

// User info endpoint for front-end role-based labeling
app.get('/api/me', ensureAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

// Example admin-only API
app.get('/admin/users', ensureAuth, ensureRole('admin'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 50');
  res.json(rows);
});

// Mount routers
app.use('/auth', authRouter);
app.use('/api/stripe', ensureAuth, stripeRouter);
app.use('/api/dropbox', ensureAuth, dropboxRouter);
app.use('/api/ghl', ensureAuth, ghlRouter);
// Webhooks from GHL (unauthenticated, protected by secret token)
app.use('/webhooks/ghl', ghlWebhookRouter);

// 404 fallback
app.use((req, res) => res.status(404).send('Not found'));

const port = process.env.PORT || 8080;

// Auto-run migrations on startup, then start server
(async () => {
  try {
    const { runMigrations } = require('./db/migrate');
    await runMigrations();

    app.listen(port, () => {
      console.log(`✅ NAV Productions app listening on port ${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
