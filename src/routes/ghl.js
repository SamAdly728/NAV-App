const express = require('express');
const axios = require('axios');
const { ghlClient, getGhlCredentials, resolveLocationId, fetchAppointments, fetchAppointmentById, fetchBookings, fetchOpportunities, fetchActivities, fetchPayments } = require('../services/ghl');
const { ensureRole } = require('../middleware/auth');
const { getCache } = require('../services/cache');
const { wrap } = require('../services/cache');
const router = express.Router();

// Helpers to normalize various GHL response shapes
function firstArray(obj) {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) return obj;
  for (const key of Object.keys(obj)) {
    if (Array.isArray(obj[key])) return obj[key];
    if (obj[key] && typeof obj[key] === 'object') {
      const nested = firstArray(obj[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}
function normalizeAppointments(data) {
  const arr = data?.appointments || data?.items || data?.data || firstArray(data) || [];
  return Array.isArray(arr) ? arr : [];
}
function normalizeOpportunities(data) {
  const arr = data?.opportunities || data?.items || data?.data || firstArray(data) || [];
  return Array.isArray(arr) ? arr : [];
}
function normalizeActivities(data) {
  // conversations/search often returns { conversations: [...] } or items
  const arr = data?.conversations || data?.items || data?.data || firstArray(data) || [];
  return Array.isArray(arr) ? arr : [];
}

// Proxy to GoHighLevel API (GHL). Requires an API key/token.
router.get('/bookings', async (req, res) => {
  try {
    const { apiKey, locationId } = await getGhlCredentials();
    if (!apiKey) return res.status(501).json({ error: 'GHL integration not configured' });

    const client = ghlClient(apiKey);
    const resolvedLocationId = resolveLocationId(apiKey, locationId);

    const data = await wrap('ghl:bookings', 60_000, () => fetchBookings(client, resolvedLocationId));
    res.json(data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Recent booking webhook events (admin only), pulled from in-memory cache
router.get('/booking-webhooks/recent', ensureRole('admin'), async (req, res) => {
  try {
    const list = getCache('webhook:bookings') || [];
    res.json({ items: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load recent webhook events' });
  }
});

// Appointments proxy with filters
router.get('/appointments', async (req, res) => {
  try {
    const { apiKey, locationId } = await getGhlCredentials();
    if (!apiKey) return res.status(501).json({ error: 'GHL integration not configured' });

    const client = ghlClient(apiKey);
    const resolvedLocationId = resolveLocationId(apiKey, locationId);

    const allowed = ['calendarId', 'contactId', 'dateFrom', 'dateTo', 'status', 'limit', 'page'];
    const params = {};
    if (resolvedLocationId) params.locationId = resolvedLocationId;
    for (const k of allowed) if (req.query[k]) params[k] = req.query[k];

    // Cache key based on params
    const cacheKey = `ghl:appointments:${JSON.stringify(params)}`;
    const data = await wrap(cacheKey, 30_000, () => fetchAppointments(client, params));

    const items = firstArray(data) || firstArray(data?.data) || data?.appointments || data?.items || [];
    const debug = req.query.debug === '1';
    return res.json(debug ? { items, rawKeys: Object.keys(data || {}), data } : { items });
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Upcoming appointments (sorted ascending by start time)
router.get('/appointments/upcoming', async (req, res) => {
  try {
    const { apiKey, locationId } = await getGhlCredentials();
    if (!apiKey) return res.status(501).json({ error: 'GHL integration not configured' });

    const client = ghlClient(apiKey);
    const resolvedLocationId = resolveLocationId(apiKey, locationId);

    const limit = parseInt(req.query.limit || '5', 10);
    const dateFrom = new Date().toISOString();
    const params = { locationId: resolvedLocationId, dateFrom, limit: 50 }; // fetch a page, then slice after sort
    const data = await wrap(`ghl:appointments:upcoming:${dateFrom.slice(0, 13)}`, 30_000, () => fetchAppointments(client, params));

    const all = firstArray(data) || firstArray(data?.data) || data?.appointments || data?.items || [];
    const sorted = all.sort((a, b) => new Date(a.startTime || a.start_date || a.date || 0) - new Date(b.startTime || b.start_date || b.date || 0));
    return res.json({ items: sorted.slice(0, limit) });
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch upcoming appointments' });
  }
});

// Appointment by id
router.get('/appointments/:id', async (req, res) => {
  try {
    const { apiKey } = await getGhlCredentials();
    if (!apiKey) return res.status(501).json({ error: 'GHL integration not configured' });

    const client = ghlClient(apiKey);
    const data = await fetchAppointmentById(client, req.params.id);
    res.json(data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Aggregated dashboard endpoint
router.get('/dashboard', async (req, res) => {
  try {
    const { apiKey, locationId } = await getGhlCredentials();
    if (!apiKey) return res.status(501).json({ error: 'GHL integration not configured' });

    const force = (req.query.force === '1');
    const debug = (req.query.debug === '1');
    const ttl = 60_000; // 1 minute cache

    const client = ghlClient(apiKey);
    const resolvedLocationId = resolveLocationId(apiKey, locationId);

    const key = 'ghl:dashboard';
    if (!force) {
      const cached = require('../services/cache').getCache(key);
      if (cached) return res.json(cached);
    }

    const [bookings, opportunities, activities, payments] = await Promise.all([
      fetchBookings(client, resolvedLocationId),
      fetchOpportunities(client, resolvedLocationId),
      fetchActivities(client, resolvedLocationId),
      fetchPayments(client, resolvedLocationId)
    ]);

    // Include recent webhook events (last 5) from in-memory cache
    const recent = (require('../services/cache').getCache('webhook:bookings') || []).slice(-5);
    const payload = {
      fetchedAt: new Date().toISOString(),
      bookings,
      opportunities,
      activities,
      payments,
      recentWebhooks: recent.map(ev => ({
        id: ev.id || null,
        name: ev.name || null,
        email: ev.email || null,
        phone: ev.phone || null,
        status: ev.status || 'unknown',
        startTime: ev.startTime || null,
        createdAt: ev.createdAt || null
      })),
      // Normalized lists for front-end convenience
      bookingsList: normalizeAppointments(bookings),
      opportunitiesList: normalizeOpportunities(opportunities),
      activitiesList: normalizeActivities(activities)
    };
    if (debug) {
      payload._debug = {
        locationId: resolvedLocationId,
        bookingsKeys: Object.keys(bookings || {}),
        opportunitiesKeys: Object.keys(opportunities || {}),
        activitiesKeys: Object.keys(activities || {}),
        paymentsKeys: Object.keys(payments || {}),
        bookingsListLen: payload.bookingsList.length,
        opportunitiesListLen: payload.opportunitiesList.length,
        activitiesListLen: payload.activitiesList.length
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
