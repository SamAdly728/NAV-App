const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const validateSecret = require('../middleware/webhookAuth');

const ALLOWED_TABLES = [
    'roles', 'users', 'clients', 'notifications', 'activity_logs',
    'properties', 'shoot_types', 'shoot_addons', 'shoot_bookings', 'shoot_booking_addons',
    'projects', 'project_members', 'project_assets', 'revisions',
    'tasks', 'tags', 'task_tags',
    'ticket_statuses', 'ticket_priorities', 'ticket_categories', 'tickets', 'ticket_comments',
    'payments'
];

router.post('/:table', validateSecret, async (req, res) => {
    const { table } = req.params;
    const data = req.body;

    if (!ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: 'Invalid table' });
    }

    if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No data provided' });
    }

    const keys = Object.keys(data);
    const values = Object.values(data);

    // Construct query safely
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    RETURNING *;
  `;

    try {
        const { rows } = await pool.query(query, values);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error(`Error writing to ${table}:`, err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
