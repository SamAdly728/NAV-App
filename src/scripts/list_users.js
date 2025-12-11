const { pool } = require('../db/pool');

async function listUsers() {
    try {
        const res = await pool.query('SELECT id, full_name, email FROM users ORDER BY id');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error listing users:', err);
        process.exit(1);
    }
}

listUsers();
