const { pool } = require('../db/pool');

async function migrate() {
    try {
        console.log('Starting migration v6...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT,
                description TEXT,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // Insert default keys if not exist (optional, but helpful)
        await pool.query(`
            INSERT INTO settings (key, value, description)
            VALUES 
                ('ghl_api_key', '', 'GoHighLevel API Key'),
                ('ghl_location_id', '', 'GoHighLevel Location ID')
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log('Migration v6 completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v6 failed:', err);
        process.exit(1);
    }
}

migrate();
