const axios = require('axios');
const { pool } = require('../db/pool');

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function getSetting(key) {
  try {
    const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (res.rows.length > 0) return res.rows[0].value;
  } catch (err) {
    console.error(`Failed to fetch setting ${key}:`, err.message);
  }
  return null;
}

// Fetch credentials from DB, fallback to ENV
async function getGhlCredentials() {
  const dbApiKey = await getSetting('ghl_api_key');
  const dbLocationId = await getSetting('ghl_location_id');

  const apiKey = dbApiKey || process.env.GHL_API_KEY;

  // Prefer DB location ID if set, otherwise extract from token or env
  let locationId = dbLocationId || process.env.GHL_LOCATION_ID;

  if (!locationId && apiKey) {
    const payload = decodeJwtPayload(apiKey);
    locationId = payload?.location_id || payload?.locationId;
  }

  return { apiKey, locationId };
}

function resolveLocationId(apiKey = process.env.GHL_API_KEY, explicit = process.env.GHL_LOCATION_ID) {
  if (explicit) return explicit;
  if (!apiKey) return undefined;
  const payload = decodeJwtPayload(apiKey);
  return payload?.location_id || payload?.locationId || undefined;
}

function ghlClient(apiKey = process.env.GHL_API_KEY) {
  // If no API key provided here (and not in env), it will throw or fail later.
  // We should prefer passing the key explicitly now.
  if (!apiKey) {
    // Allow it to be instantiated without key if we plan to add interceptors, 
    // but for now let's just warn or throw if totally missing
    // console.warn('GHL_API_KEY missing in sync ghlClient call');
  }

  const client = axios.create({
    baseURL: 'https://services.leadconnectorhq.com',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28'
    },
    timeout: 20_000
  });
  return client;
}

async function fetchBookingsLegacy(client, locationId) {
  const params = { limit: 50 };
  if (locationId) params.locationId = locationId;
  try {
    const { data } = await client.get('/v1/appointments/', { params });
    return data;
  } catch (e) {
    return { items: [], error: e.response?.data || e.message };
  }
}

async function fetchOpportunities(client, locationId) {
  const params = {};
  if (locationId) params.locationId = locationId;
  try {
    const { data } = await client.get('/v1/opportunities/', { params });
    return data;
  } catch (e) {
    return { items: [], error: e.response?.data || e.message };
  }
}

async function fetchActivities(client, locationId) {
  const params = { page: 1, limit: 10 };
  if (locationId) params.locationId = locationId;
  try {
    // conversations search tends to be supported; adjust if needed
    const { data } = await client.get('/v1/conversations/search', { params });
    return data;
  } catch (e) {
    // fallback to empty list but include error for debugging
    return { items: [], error: e.response?.data || e.message };
  }
}

async function fetchPayments(client, locationId) {
  // If Payments API not enabled, this will fail; return empty for now.
  const params = {};
  if (locationId) params.locationId = locationId;
  try {
    const { data } = await client.get('/v1/payments/transactions', { params });
    return data;
  } catch {
    return { items: [] };
  }
}

async function fetchAppointments(client, params = {}) {
  try {
    const { data } = await client.get('/v1/appointments/', { params });
    return data;
  } catch (e) {
    return { items: [], error: e.response?.data || e.message };
  }
}

async function fetchAppointmentById(client, id) {
  try {
    const { data } = await client.get(`/v1/appointments/${encodeURIComponent(id)}`);
    return data;
  } catch (e) {
    return { error: e.response?.data || e.message };
  }
}

// Back-compat: bookings wrapper
async function fetchBookings(client, locationId) {
  const params = { limit: 50 };
  if (locationId) params.locationId = locationId;
  return fetchAppointments(client, params);
}

module.exports = { ghlClient, getGhlCredentials, resolveLocationId, fetchAppointments, fetchAppointmentById, fetchBookings, fetchBookingsLegacy, fetchOpportunities, fetchActivities, fetchPayments };