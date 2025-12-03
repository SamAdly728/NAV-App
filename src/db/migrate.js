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

    const scriptsDir = path.join(__dirname, '..', 'scripts');

    const coreSchemaSql = fs.readFileSync(path.join(scriptsDir, 'create_nav_schema.sql'), 'utf8');
    await pool.query(coreSchemaSql);

    const resetTokenSql = fs.readFileSync(path.join(scriptsDir, 'add_reset_token_to_users.sql'), 'utf8');
    await pool.query(resetTokenSql);

    const projectSchemaUpdatePath = path.join(scriptsDir, 'update_project_schema.sql');
    if (fs.existsSync(projectSchemaUpdatePath)) {
      const projectSchemaUpdateSql = fs.readFileSync(projectSchemaUpdatePath, 'utf8');
      await pool.query(projectSchemaUpdateSql);
    }

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
