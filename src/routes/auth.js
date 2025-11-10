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

module.exports = router;
