const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_INTERNAL_URL || '';

const sslConfig = (process.env.PGSSLMODE === 'disable' || (!process.env.PGSSLMODE && !/render\.com/.test(connectionString)))
  ? false
  : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString,
  ssl: sslConfig
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = { pool };
