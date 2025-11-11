const axios = require('axios');

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

function resolveLocationId(apiKey = process.env.GHL_API_KEY, explicit = process.env.GHL_LOCATION_ID) {
  if (explicit) return explicit;
  if (!apiKey) return undefined;
  const payload = decodeJwtPayload(apiKey);
  return payload?.location_id || payload?.locationId || undefined;
}

function ghlClient(apiKey = process.env.GHL_API_KEY) {
  if (!apiKey) throw new Error('GHL_API_KEY missing');
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

async function fetchBookings(client, locationId) {
  const params = {};
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

module.exports = { ghlClient, resolveLocationId, fetchBookings, fetchOpportunities, fetchActivities, fetchPayments };