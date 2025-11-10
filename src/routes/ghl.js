const express = require('express');
const axios = require('axios');
const router = express.Router();

// Proxy to GoHighLevel API (GHL). Requires an API key/token in env.
router.get('/bookings', async (req, res) => {
  try {
    if (!process.env.GHL_API_KEY) return res.status(501).json({ error: 'GHL integration not configured' });
    const r = await axios.get('https://rest.gohighlevel.com/v1/appointments/', {
      headers: { Authorization: `Bearer ${process.env.GHL_API_KEY}` }
    });
    res.json(r.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;
