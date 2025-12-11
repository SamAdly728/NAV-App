const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { ensureAuth } = require('../middleware/auth');

// GET /api/me - Fetch current user profile and related data
router.get('/me', ensureAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user details
        const userResult = await pool.query(`
      SELECT id, email, full_name, username, phone, bio, work_passion, birth_date, location, website, github,
             address, address2, city, state, zip, country, language, avatar_url,
             notification_preferences, privacy_settings, security_settings
      FROM users
      WHERE id = $1
    `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Fetch subscription
        const subResult = await pool.query(`
      SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [userId]);
        const subscription = subResult.rows[0] || null;

        // Fetch connected accounts
        const connectionsResult = await pool.query(`
      SELECT provider, provider_id, connected_at, metadata FROM connected_accounts WHERE user_id = $1
    `, [userId]);
        const connections = connectionsResult.rows;

        res.json({
            user,
            subscription,
            connections
        });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/me - Update user profile
router.post('/me', ensureAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            full_name, username, phone, bio, work_passion, birth_date, location, website, github,
            address, address2, city, state, zip, country, language,
            notification_preferences, privacy_settings, security_settings
        } = req.body;

        // Dynamic update query
        const fields = [];
        const values = [];
        let idx = 1;

        const addField = (col, val) => {
            if (val !== undefined) {
                fields.push(`${col} = $${idx++}`);
                values.push(val);
            }
        };

        addField('full_name', full_name);
        addField('username', username);
        addField('phone', phone);
        addField('bio', bio);
        addField('work_passion', work_passion);
        addField('birth_date', birth_date);
        addField('location', location);
        addField('website', website);
        addField('github', github);
        addField('address', address);
        addField('address2', address2);
        addField('city', city);
        addField('state', state);
        addField('zip', zip);
        addField('country', country);
        addField('language', language);
        addField('notification_preferences', notification_preferences);
        addField('privacy_settings', privacy_settings);
        addField('security_settings', security_settings);

        if (fields.length === 0) {
            return res.json({ message: 'No changes provided' });
        }

        values.push(userId);
        const query = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = now()
      WHERE id = $${idx}
      RETURNING *
    `;

        const result = await pool.query(query, values);

        // Log activity
        await pool.query(`
      INSERT INTO activity_logs (user_id, action_type, description)
      VALUES ($1, 'profile_update', 'User updated their profile settings')
    `, [userId]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating user profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/activity - Fetch activity logs
router.get('/activity', ensureAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
      SELECT * FROM activity_logs
      WHERE user_id = $1
      ORDER BY occurred_at DESC
      LIMIT 50
    `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching activity logs:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/connections/:provider/toggle - Toggle connection (Mock/Placeholder)
router.post('/connections/:provider/toggle', ensureAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;
        const { connected } = req.body; // true to connect, false to disconnect

        if (connected) {
            // In a real app, this would involve OAuth flow. 
            // For now, we'll just simulate a connection record.
            await pool.query(`
        INSERT INTO connected_accounts (user_id, provider, provider_id, metadata)
        VALUES ($1, $2, 'mock_id', '{"username": "mock_user"}')
        ON CONFLICT (user_id, provider) DO NOTHING
      `, [userId, provider]);
        } else {
            await pool.query(`
        DELETE FROM connected_accounts
        WHERE user_id = $1 AND provider = $2
      `, [userId, provider]);
        }

        res.json({ success: true, connected });
    } catch (err) {
        console.error('Error toggling connection:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/users - Fetch all users (for settings page data table)
router.get('/users', ensureAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, full_name, username, email, role, avatar_url, created_at 
            FROM users 
            ORDER BY id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
