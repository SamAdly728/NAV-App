const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const { getUserByEmail } = require('../services/users');

const router = express.Router();

// Email/password endpoints could be added later

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=no-account' }),
  (req, res) => {
    // Role-based redirection (both serve same page for now)
    return res.redirect('/dashboard');
  }
);

// Email/password login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.redirect('/?error=missing');
    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.redirect('/?error=credentials');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.redirect('/?error=credentials');

    req.login({ id: user.id }, (err) => {
      if (err) return next(err);
      return res.redirect('/dashboard');
    });
  } catch (e) {
    return next(e);
  }
});

router.post('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

// Convenience GET logout for template links
router.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

const crypto = require('crypto');
const { pool } = require('../db/pool');

// Forgot Password - Request Token
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.redirect('/forgot-password?error=missing');

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal user existence
      return res.redirect('/forgot-password?success=true');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    // TODO: Send email via SMTP
    console.log(`[RESET PASSWORD] Token for ${email}: ${token}`);
    console.log(`[RESET PASSWORD] Link: ${process.env.PUBLIC_URL || 'http://localhost:8080'}/reset-password/${token}`);

    res.redirect('/forgot-password?success=true');
  } catch (err) {
    console.error(err);
    res.redirect('/forgot-password?error=server');
  }
});

// Reset Password - Page
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.send('Password reset token is invalid or has expired.');
    }

    res.sendFile(require('path').join(process.cwd(), 'template', 'reset_password.html'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Reset Password - Action
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) return res.redirect(`/reset-password/${token}?error=missing`);

  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.send('Password reset token is invalid or has expired.');
    }

    const userId = rows[0].id;
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, userId]
    );

    res.redirect('/?success=password_reset');
  } catch (err) {
    console.error(err);
    res.redirect(`/reset-password/${token}?error=server`);
  }
});

module.exports = router;
