const request = require('supertest');
const { Pool } = require('pg');
require('dotenv').config();

const appUrl = 'http://localhost:8080';
const secret = process.env.GHL_WEBHOOK_SECRET || 'testsecret';

async function runTest() {
    try {
        console.log('--- Testing Webhook with "roles" table ---');

        // We'll try to insert a new role. Roles have a unique name constraint, so we use a timestamp.
        const newRole = {
            name: `test_role_${Date.now()}`,
            permissions: { test: true }
        };

        await request(appUrl)
            .post('/webhooks/data/roles')
            .query({ secret })
            .send(newRole)
            .expect(200)
            .then(res => {
                console.log('Response:', res.body);
                if (!res.body.success) throw new Error('Webhook failed');
                console.log('Successfully inserted into roles table via webhook.');
            });

    } catch (error) {
        console.error('--- Test Failed ---');
        console.error(error);
        process.exit(1);
    }
}

runTest();
