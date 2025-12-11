const { pool } = require('../db/pool');

async function migrate() {
    try {
        console.log('Starting migration v4...');

        // Add address2 column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address2') THEN
                    ALTER TABLE users ADD COLUMN address2 TEXT;
                END IF;
            END $$;
        `);

        console.log('Migration v4 completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v4 failed:', err);
        process.exit(1);
    }
}

migrate();
