const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

const SELECT_COLUMNS = `id, user_id, title, start_time, end_time, all_day, class_name, description`;

function isStaff(user) {
  return Boolean(user && (user.role === 'admin' || user.role === 'nav_staff'));
}

function mapRowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    start: row.start_time ? new Date(row.start_time).toISOString() : null,
    end: row.end_time ? new Date(row.end_time).toISOString() : null,
    allDay: Boolean(row.all_day),
    className: row.class_name || null,
    extendedProps: {
      description: row.description || ''
    }
  };
}

router.get('/', async (req, res, next) => {
  try {
    const staff = isStaff(req.user);
    const params = [];
    let query = `SELECT ${SELECT_COLUMNS} FROM events`;

    if (!staff) {
      params.push(req.user.id);
      query += ' WHERE user_id = $1';
    }

    query += ' ORDER BY start_time ASC, id ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows.map(mapRowToEvent));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, start, end, allDay, className, description } = req.body || {};

    if (!title || !start) {
      return res.status(400).json({ error: 'title and start are required' });
    }

    const startDate = new Date(start);
    if (!Number.isFinite(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid start date' });
    }

    let endDate = null;
    if (end !== undefined && end !== null && end !== '') {
      const parsedEnd = new Date(end);
      if (!Number.isFinite(parsedEnd.getTime())) {
        return res.status(400).json({ error: 'Invalid end date' });
      }
      endDate = parsedEnd;
    }

    const insertSql = `
      INSERT INTO events (user_id, title, start_time, end_time, all_day, class_name, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${SELECT_COLUMNS}
    `;

    const values = [
      req.user.id,
      String(title).trim(),
      startDate,
      endDate,
      Boolean(allDay),
      className || null,
      description || null
    ];

    const { rows } = await pool.query(insertSql, values);
    res.status(201).json(mapRowToEvent(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const { title, start, end, allDay, className, description } = req.body || {};
    const setClauses = [];
    const values = [];

    if (title !== undefined) {
      values.push(String(title).trim());
      setClauses.push(`title = $${values.length}`);
    }

    if (start !== undefined) {
      const startDate = new Date(start);
      if (!Number.isFinite(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid start date' });
      }
      values.push(startDate);
      setClauses.push(`start_time = $${values.length}`);
    }

    if (end !== undefined) {
      let endDate = null;
      if (end !== null && end !== '') {
        const parsedEnd = new Date(end);
        if (!Number.isFinite(parsedEnd.getTime())) {
          return res.status(400).json({ error: 'Invalid end date' });
        }
        endDate = parsedEnd;
      }
      values.push(endDate);
      setClauses.push(`end_time = $${values.length}`);
    }

    if (allDay !== undefined) {
      values.push(Boolean(allDay));
      setClauses.push(`all_day = $${values.length}`);
    }

    if (className !== undefined) {
      values.push(className || null);
      setClauses.push(`class_name = $${values.length}`);
    }

    if (description !== undefined) {
      values.push(description || null);
      setClauses.push(`description = $${values.length}`);
    }

    if (!setClauses.length) {
      return res.status(400).json({ error: 'No fields supplied for update' });
    }

    const setSql = `${setClauses.join(', ')}, updated_at = NOW()`;

    values.push(eventId);
    let whereSql = `id = $${values.length}`;

    if (!isStaff(req.user)) {
      values.push(req.user.id);
      whereSql += ` AND user_id = $${values.length}`;
    }

    const updateSql = `
      UPDATE events
      SET ${setSql}
      WHERE ${whereSql}
      RETURNING ${SELECT_COLUMNS}
    `;

    const { rows } = await pool.query(updateSql, values);
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(mapRowToEvent(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const values = [eventId];
    let whereSql = 'id = $1';

    if (!isStaff(req.user)) {
      values.push(req.user.id);
      whereSql += ' AND user_id = $2';
    }

    const deleteSql = `DELETE FROM events WHERE ${whereSql}`;
    const result = await pool.query(deleteSql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
