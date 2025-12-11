const express = require('express');
const { pool } = require('../db/pool');
const { ensureRole } = require('../middleware/auth');
const router = express.Router();

// Get GHL Settings
router.get('/ghl', ensureRole('admin'), async (req, res) => {
    try {
        const keys = ['ghl_api_key', 'ghl_location_id'];
        const { rows } = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);

        const simple = {};
        rows.forEach(r => simple[r.key] = r.value);

        // Mask the API key for security
        const rawKey = simple['ghl_api_key'] || '';
        const maskedKey = rawKey.length > 8 ? rawKey.substring(0, 4) + '...' + rawKey.substring(rawKey.length - 4) : '...';

        res.json({
            apiKey: rawKey ? maskedKey : '',
            isConfigured: !!rawKey,
            locationId: simple['ghl_location_id'] || ''
        });
    } catch (err) {
        console.error('Failed to fetch settings', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update GHL Settings
router.post('/ghl', ensureRole('admin'), async (req, res) => {
    const { apiKey, locationId } = req.body;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Only update API key if provided (allow partial update or keeping existing)
            if (typeof apiKey === 'string') {
                // If apiKey is masked (contains '...'), do NOT update it.
                // This prevents overwriting the real key with the masked version if the user saves without changing it.
                if (!apiKey.includes('...')) {
                    await client.query(`
                INSERT INTO settings (key, value, description)
                VALUES ('ghl_api_key', $1, 'GoHighLevel API Key')
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [apiKey]);
                }
            }

            if (typeof locationId === 'string') {
                await client.query(`
            INSERT INTO settings (key, value, description)
            VALUES ('ghl_location_id', $1, 'GoHighLevel Location ID')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [locationId]);
            }

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Failed to save settings', err);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;
