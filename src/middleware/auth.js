function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.redirect('/');
}

function ensureRole(role) {
  return (req, res, next) => {
    if (req.user && req.user.role === role) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { ensureAuth, ensureRole };
