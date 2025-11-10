const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_INTERNAL_URL || '';

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' || /render\.com/.test(connectionString) ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = { pool };
