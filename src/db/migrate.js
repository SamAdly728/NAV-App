const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

/**
 * Auto-migration runner for NAV Productions database schema
 * Runs on server startup to ensure all tables exist
 */
async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (process.env.PGSSLMODE === 'disable' || (!process.env.PGSSLMODE && !/render\.com/.test(process.env.DATABASE_URL)))
      ? false
      : { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Running database migrations...');

    const schemaPath = path.join(__dirname, '..', 'scripts', 'create_nav_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);

    const resetTokenSchemaPath = path.join(__dirname, '..', 'scripts', 'add_reset_token_to_users.sql');
    const resetTokenSchemaSql = fs.readFileSync(resetTokenSchemaPath, 'utf8');
    await pool.query(resetTokenSchemaSql);

    console.log('✅ Database migrations completed successfully');

    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log(`📊 Database contains ${result.rows.length} tables:`,
      result.rows.map(r => r.table_name).join(', ')
    );

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

module.exports = { runMigrations };
