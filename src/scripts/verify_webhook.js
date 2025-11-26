const http = require('http');

const data = JSON.stringify({
    email: `test-${Date.now()}@example.com`,
    role_id: 3,
    google_id: `test-gid-${Date.now()}`
});

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/webhooks/data/users?secret=' + (process.env.GHL_WEBHOOK_SECRET || 'testsecret'),
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
