const express = require('express');
const router = express.Router();
const { appendToList, delCache } = require('../services/cache');
const validateSecret = require('../middleware/webhookAuth');

// Normalizer for booking/appointment style payloads
function normalizeBooking(body) {
  const raw = body || {};
  // Attempt to map common fields GHL sends in appointment webhooks
  return {
    id: raw.id || raw.appointmentId || raw.appointment_id || null,
    contactId: raw.contactId || raw.contact_id || raw.contact?.id || null,
    calendarId: raw.calendarId || raw.calendar_id || null,
    status: raw.status || raw.appointmentStatus || raw.appointment_status || 'unknown',
    startTime: raw.startTime || raw.start_time || raw.start || raw.dateTimeStart || null,
    endTime: raw.endTime || raw.end_time || raw.end || raw.dateTimeEnd || null,
    title: raw.title || raw.appointmentTitle || raw.type || 'Booking',
    // Custom fields and common aliases
    name: raw.name1 || raw.name || raw.contactName || raw.contact_name || raw.contact?.name || null,
    email: raw.email1 || raw.email || raw.contact_email || raw.contact?.email || null,
    phone: raw.phone1 || raw.phone || raw.contact_phone || raw.contact?.phone || raw.contact?.phoneNumber || null,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    raw
  };
}

// Webhook endpoint for booking form submissions or appointment create/update
// Accept both JSON and x-www-form-urlencoded payloads
router.post('/booking', validateSecret, express.urlencoded({ extended: true }), express.json({ limit: '200kb' }), (req, res) => {
  // If payload was nested/encoded as a JSON string, attempt to parse it
  let payload = req.body || {};
  try {
    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    } else if (typeof payload.payload === 'string' && payload.payload.trim().startsWith('{')) {
      payload = JSON.parse(payload.payload);
    } else if (typeof payload.data === 'string' && payload.data.trim().startsWith('{')) {
      payload = JSON.parse(payload.data);
    }
  } catch {
    // leave payload as-is if parsing fails
  }
  const booking = normalizeBooking(payload);
  appendToList('webhook:bookings', booking, 100);
  // Invalidate cached dashboard & bookings so next fetch is fresh
  delCache('ghl:dashboard');
  delCache('ghl:bookings');
  res.json({ received: true, id: booking.id });
});

// Endpoint to view recent received booking webhook events (secured via secret)
router.get('/booking/recent', validateSecret, (req, res) => {
  const list = require('../services/cache').getCache('webhook:bookings') || [];
  res.json({ items: list });
});

module.exports = router;