const { pool } = require('../db/pool');

async function migrate() {
    try {
        console.log('Starting migration v5...');

        // Add username column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
                    ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE;
                END IF;
            END $$;
        `);

        console.log('Migration v5 completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v5 failed:', err);
        process.exit(1);
    }
}

migrate();
