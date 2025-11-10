// Seed an initial admin user if missing
require('dotenv').config();
const { createAdminIfMissing } = require('../services/users');
const { pool } = require('../db/pool');

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD required in env');
    process.exit(1);
  }
  try {
    const id = await createAdminIfMissing({ email, password });
    console.log('Admin ready with id', id);
  } catch (e) {
    console.error('Admin seed failed', e);
  } finally {
    pool.end();
  }
}

run();
