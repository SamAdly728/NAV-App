// Simple in-memory TTL cache. Suitable for small ephemeral data.
// Not multi-instance safe; for Render scale you would use Redis or database.

const store = new Map();

function setCache(key, value, ttlMs = 60_000) {
  const expire = Date.now() + ttlMs;
  store.set(key, { value, expire });
}

function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expire) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function delCache(key) {
  store.delete(key);
}

function wrap(key, ttlMs, fn) {
  const cached = getCache(key);
  if (cached) return Promise.resolve(cached);
  return Promise.resolve(fn()).then((val) => {
    setCache(key, val, ttlMs);
    return val;
  });
}

module.exports = { setCache, getCache, delCache, wrap };