const { pool } = require('../db/pool');
const { getGhlCredentials } = require('../services/ghl');

async function verify() {
    try {
        console.log('Verifying GHL Integration...');

        // 1. Check if table 'settings' exists
        const res = await pool.query("SELECT to_regclass('public.settings')");
        if (!res.rows[0].to_regclass) {
            throw new Error("Table 'settings' does not exist!");
        }
        console.log("PASS: Table 'settings' exists.");

        // 2. Insert test settings
        const testKey = 'test-api-key-' + Date.now();
        const testLoc = 'test-location-' + Date.now();

        await pool.query(`
      INSERT INTO settings (key, value) VALUES 
      ('ghl_api_key', $1), 
      ('ghl_location_id', $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [testKey, testLoc]);
        console.log("PASS: Inserted test settings into DB.");

        // 3. Verify service fetches them
        const creds = await getGhlCredentials();
        if (creds.apiKey !== testKey) {
            throw new Error(`Service returned wrong API key. Expected ${testKey}, got ${creds.apiKey}`);
        }
        if (creds.locationId !== testLoc) {
            throw new Error(`Service returned wrong Location ID. Expected ${testLoc}, got ${creds.locationId}`);
        }
        console.log("PASS: Service correctly fetched credentials from DB.");

        console.log('Verification Successful!');
        process.exit(0);
    } catch (err) {
        console.error('Verification Failed:', err);
        process.exit(1);
    }
}

verify();
