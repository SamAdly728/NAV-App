const { pool } = require('../db/pool');
const { getGhlCredentials, ghlClient, fetchBookings } = require('../services/ghl');

async function checkStatus() {
    try {
        console.log('Checking GHL Integration Status...');

        // 1. Check DB for credentials
        const creds = await getGhlCredentials();
        const hasKey = !!creds.apiKey && !creds.apiKey.startsWith('test-api-key'); // Ignore my test key
        const hasLoc = !!creds.locationId && !creds.locationId.startsWith('test-location');

        console.log(`- API Key present: ${hasKey}`);
        console.log(`- Location ID present: ${hasLoc}`);

        if (!hasKey) {
            console.log('\n[STATUS] READY TO INTEGRATE');
            console.log('The system is compliant and ready. Please enter your GHL API Key in the Settings page -> Integrations tab.');
            process.exit(0);
        }

        // 2. If key exists, test connection
        console.log('\nCredentials found. Testing GHL Connection...');
        const client = ghlClient(creds.apiKey);

        // Try to fetch something simple, like a location check or empty bookings list
        const result = await fetchBookings(client, creds.locationId);

        if (result.error) {
            console.error('\n[STATUS] INTEGRATION FAILED');
            console.error('Error connecting to GHL:', result.error);
            // Check if it's a 401
            if (JSON.stringify(result.error).includes('401')) {
                console.error('Reason: Unauthorized. Your API Key might be invalid or expired.');
            }
        } else {
            console.log('\n[STATUS] INTEGRATED & CONNECTED');
            console.log('Successfully connected to GHL API.');
            console.log(`Fetched ${Array.isArray(result) ? result.length : (result.appointments?.length || 0)} bookings/items.`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

checkStatus();
