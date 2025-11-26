const request = require('supertest');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const appUrl = 'http://localhost:8080';
const connectionString = process.env.DATABASE_URL;
const sslConfig = (process.env.PGSSLMODE === 'disable' || (!process.env.PGSSLMODE && !/render\.com/.test(connectionString)))
    ? false
    : { rejectUnauthorized: false };

const pool = new Pool({
    connectionString,
    ssl: sslConfig
});

const testEmail = `forgot-pw-test-${Date.now()}@example.com`;
const newPassword = 'new-password-123';

async function runTest() {
    try {
        console.log('--- Starting Forgot Password Test ---');

        // 1. Create a test user
        console.log('1. Creating test user...');
        const passwordHash = await bcrypt.hash('old-password', 10);
        const { rows } = await pool.query(
            'INSERT INTO users (email, password_hash, role_id) VALUES ($1, $2, 3) RETURNING id',
            [testEmail, passwordHash]
        );
        const userId = rows[0].id;
        console.log(`   User created with ID: ${userId}`);

        // 2. Request forgot password
        console.log('2. Requesting forgot password...');
        await request(appUrl)
            .post('/auth/forgot-password')
            .type('form')
            .send({ email: testEmail })
            .expect(302)
            .expect('Location', '/forgot-password?success=true');
        console.log('   Request successful (redirected).');

        // 3. Verify token in DB
        console.log('3. Verifying token in database...');
        const { rows: userRows } = await pool.query('SELECT reset_token FROM users WHERE id = $1', [userId]);
        const token = userRows[0].reset_token;
        if (!token) throw new Error('Reset token not found in database!');
        console.log(`   Token found: ${token}`);

        // 4. Reset password
        console.log('4. Resetting password...');
        await request(appUrl)
            .post(`/auth/reset-password/${token}`)
            .type('form')
            .send({ password: newPassword })
            .expect(302)
            .expect('Location', '/?success=password_reset');
        console.log('   Reset successful (redirected).');

        // 5. Verify new password (by checking hash)
        console.log('5. Verifying new password hash...');
        const { rows: updatedUserRows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const isMatch = await bcrypt.compare(newPassword, updatedUserRows[0].password_hash);
        if (!isMatch) throw new Error('Password hash does not match new password!');
        console.log('   Password updated successfully.');

        // Cleanup
        console.log('Cleaning up...');
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        console.log('--- Test Passed Successfully ---');
    } catch (error) {
        console.error('--- Test Failed ---');
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runTest();
