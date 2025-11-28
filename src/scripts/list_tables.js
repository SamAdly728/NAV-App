require('dotenv').config();
const { Pool } = require('pg');

async function listTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const res = await pool.query(sql);
    console.log(`Tables (${res.rows.length}):`);
    res.rows.forEach((row) => console.log(` - ${row.table_name}`));
  } catch (err) {
    console.error('Error listing tables:', err);
  } finally {
    await pool.end();
  }
}

listTables();
