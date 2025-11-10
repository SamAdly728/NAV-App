const axios = require('axios');

function ghlClient(apiKey = process.env.GHL_API_KEY) {
  if (!apiKey) throw new Error('GHL_API_KEY missing');
  const client = axios.create({
    baseURL: 'https://rest.gohighlevel.com',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 15_000
  });
  return client;
}

async function fetchBookings(client) {
  const { data } = await client.get('/v1/appointments/');
  return data;
}

async function fetchOpportunities(client) {
  // Pipelines opportunities API (v1 or v2 depending on account). Using v1 placeholder.
  try {
    const { data } = await client.get('/v1/opportunities/');
    return data;
  } catch (e) {
    return { items: [], error: 'opportunities_unavailable' };
  }
}

async function fetchActivities(client) {
  // Recent activities/messages placeholder; adjust to actual endpoints (conversations etc.)
  try {
    const { data } = await client.get('/v1/conversations/');
    return data;
  } catch (e) {
    return { items: [], error: 'activities_unavailable' };
  }
}

async function fetchPayments(client) {
  // Payments endpoint varies by setup; return stub until Stripe is wired
  return { items: [] };
}

module.exports = { ghlClient, fetchBookings, fetchOpportunities, fetchActivities, fetchPayments };