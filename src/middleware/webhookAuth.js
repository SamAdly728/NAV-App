const validateSecret = (req, res, next) => {
    const secret = process.env.GHL_WEBHOOK_SECRET;
    if (!secret) return next(); // allow in dev if not set

    const headerSecret = req.headers['x-ghl-webhook-secret'] || req.headers['x-webhook-secret'];
    const auth = req.headers['authorization'];
    const bearer = auth && auth.toLowerCase().startsWith('bearer ')
        ? auth.slice(7).trim()
        : null;

    const isValid = (
        req.query.secret === secret ||
        headerSecret === secret ||
        bearer === secret
    );

    if (!isValid) {
        return res.status(401).json({ error: 'invalid_secret' });
    }

    next();
};

module.exports = validateSecret;
