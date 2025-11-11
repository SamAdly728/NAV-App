const express = require('express');
const axios = require('axios');
const { ghlClient, resolveLocationId, fetchBookings, fetchOpportunities, fetchActivities, fetchPayments } = require('../services/ghl');
const { wrap } = require('../services/cache');
const router = express.Router();

// Proxy to GoHighLevel API (GHL). Requires an API key/token in env.
router.get('/bookings', async (req, res) => {
  try {
    if (!process.env.GHL_API_KEY) return res.status(501).json({ error: 'GHL integration not configured' });
  const client = ghlClient();
  const locationId = resolveLocationId();
  const data = await wrap('ghl:bookings', 60_000, () => fetchBookings(client, locationId));
    res.json(data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Aggregated dashboard endpoint
router.get('/dashboard', async (req, res) => {
  try {
    if (!process.env.GHL_API_KEY) return res.status(501).json({ error: 'GHL integration not configured' });
    const force = (req.query.force === '1');
    const debug = (req.query.debug === '1');
    const ttl = 60_000; // 1 minute cache
  const client = ghlClient();
  const locationId = resolveLocationId();

    const key = 'ghl:dashboard';
    if (!force) {
      const cached = require('../services/cache').getCache(key);
      if (cached) return res.json(cached);
    }

    const [bookings, opportunities, activities, payments] = await Promise.all([
      fetchBookings(client, locationId),
      fetchOpportunities(client, locationId),
      fetchActivities(client, locationId),
      fetchPayments(client, locationId)
    ]);

    const payload = {
      fetchedAt: new Date().toISOString(),
      bookings,
      opportunities,
      activities,
      payments
    };
    if (debug) {
      payload._debug = {
        locationId,
        bookingsKeys: Object.keys(bookings || {}),
        opportunitiesKeys: Object.keys(opportunities || {}),
        activitiesKeys: Object.keys(activities || {}),
        paymentsKeys: Object.keys(payments || {})
      };
    }
    require('../services/cache').setCache(key, payload, ttl);
    return res.json(payload);
  } catch (e) {
    console.error(e.response?.data || e.message);
    return res.status(500).json({ error: 'Failed to fetch dashboard data', detail: e.response?.data || e.message });
  }
});

module.exports = router;
