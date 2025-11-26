const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const sslConfig = (process.env.PGSSLMODE === 'disable' || (!process.env.PGSSLMODE && !/render\.com/.test(connectionString)))
    ? false
    : { rejectUnauthorized: false };

const pool = new Pool({
    connectionString,
    ssl: sslConfig
});

async function run() {
    try {
        // Use an existing user or create one. Let's assume ID 1 exists (admin) or create a temp one.
        // Better to create a temp one to avoid messing with real data.
        const email = `ui-test-${Date.now()}@example.com`;
        const { rows } = await pool.query(
            'INSERT INTO users (email, role_id) VALUES ($1, 3) RETURNING id',
            [email]
        );
        const userId = rows[0].id;

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [token, expires, userId]
        );

        console.log(`RESET_LINK: http://localhost:8080/auth/reset-password/${token}`);

        // Don't exit immediately, let the process run so I can copy the link? No, I need to output it.
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
