// Seed admin and client users from request
require('dotenv').config();
const { pool } = require('../db/pool');
const { createAdminIfMissing, createUserWithRoleIfMissing } = require('../services/users');

async function run() {
  try {
    // Admin from env
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@nav-productions.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdmin!234';
    await createAdminIfMissing({ email: adminEmail, password: adminPassword });

    // Clients from fixed spec
    await createUserWithRoleIfMissing({ email: 'alice@example.com', password: 'alicepass', role: 'client' });
    await createUserWithRoleIfMissing({ email: 'bob@example.com', password: 'bobpass', role: 'client' });

    console.log('Users seeded (admin + clients).');
  } catch (e) {
    console.error('Seeding users failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
