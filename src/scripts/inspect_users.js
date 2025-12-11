const { pool } = require('../db/pool');

async function inspectTable() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error inspecting table:', err);
        process.exit(1);
    }
}

inspectTable();
