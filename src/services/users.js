const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');

async function getUserById(id) {
  const { rows } = await pool.query('SELECT id, email, role, google_id AS "googleId", created_at FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT id, email, role, password_hash, google_id AS "googleId", created_at FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function getUserByGoogleId(googleId) {
  const { rows } = await pool.query('SELECT id, email, role, password_hash, google_id AS "googleId", created_at FROM users WHERE google_id = $1', [googleId]);
  return rows[0] || null;
}

async function findOrCreateUser({ googleId, email }) {
  // Try by googleId first
  if (googleId) {
    const byG = await pool.query('SELECT id, email, role, google_id AS "googleId", created_at FROM users WHERE google_id = $1', [googleId]);
    if (byG.rows[0]) return byG.rows[0];
  }
  // Else try by email
  if (email) {
    const byE = await pool.query('SELECT id, email, role, google_id AS "googleId", created_at FROM users WHERE email = $1', [email]);
    if (byE.rows[0]) {
      // attach googleId if newly provided
      if (googleId && !byE.rows[0].googleId) {
        await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, byE.rows[0].id]);
        byE.rows[0].googleId = googleId;
      }
      return byE.rows[0];
    }
  }
  // Create
  const role = 'client';
  const { rows } = await pool.query(
    'INSERT INTO users (email, role, google_id) VALUES ($1,$2,$3) RETURNING id, email, role, google_id AS "googleId", created_at',
    [email || null, role, googleId || null]
  );
  return rows[0];
}

async function createAdminIfMissing({ email, password }) {
  const existing = await getUserByEmail(email);
  if (existing) {
    // ensure role admin
    if (existing.role !== 'admin') await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', existing.id]);
    return existing.id;
  }
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    'INSERT INTO users (email, role, password_hash) VALUES ($1,$2,$3) RETURNING id',
    [email, 'admin', hash]
  );
  return rows[0].id;
}

async function createUserWithRoleIfMissing({ email, password, role = 'client' }) {
  const existing = await getUserByEmail(email);
  if (existing) {
    // update role if changed
    if (existing.role !== role) {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, existing.id]);
    }
    // update password if provided
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, existing.id]);
    }
    return existing.id;
  }
  const hash = password ? await bcrypt.hash(password, 12) : null;
  const { rows } = await pool.query(
    'INSERT INTO users (email, role, password_hash) VALUES ($1,$2,$3) RETURNING id',
    [email, role, hash]
  );
  return rows[0].id;
}

module.exports = { getUserById, getUserByEmail, getUserByGoogleId, findOrCreateUser, createAdminIfMissing, createUserWithRoleIfMissing };
