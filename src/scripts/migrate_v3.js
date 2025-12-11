const { pool } = require('../db/pool');

async function migrate() {
    try {
        console.log('Starting migration v3...');

        // Add bio column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
                    ALTER TABLE users ADD COLUMN bio TEXT;
                END IF;
            END $$;
        `);

        // Add work_passion column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'work_passion') THEN
                    ALTER TABLE users ADD COLUMN work_passion VARCHAR(255);
                END IF;
            END $$;
        `);

        // Add birth_date column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'birth_date') THEN
                    ALTER TABLE users ADD COLUMN birth_date VARCHAR(50);
                END IF;
            END $$;
        `);

        // Add location column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'location') THEN
                    ALTER TABLE users ADD COLUMN location VARCHAR(255);
                END IF;
            END $$;
        `);

        // Add website column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'website') THEN
                    ALTER TABLE users ADD COLUMN website VARCHAR(255);
                END IF;
            END $$;
        `);

        // Add github column if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'github') THEN
                    ALTER TABLE users ADD COLUMN github VARCHAR(255);
                END IF;
            END $$;
        `);

        console.log('Migration v3 completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v3 failed:', err);
        process.exit(1);
    }
}

migrate();
