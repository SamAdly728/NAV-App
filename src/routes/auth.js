const express = require('express');
const passport = require('passport');

const router = express.Router();

// Email/password endpoints could be added later

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

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
