const express = require('express');
const router = express.Router();

const { pool } = require('../db/pool');

function isStaff(user) {
  return Boolean(user && (user.role === 'admin' || user.role === 'nav_staff'));
}

async function fetchClientIdForUser(userId) {
  const { rows } = await pool.query('SELECT id FROM clients WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0] ? rows[0].id : null;
}

function mapTicketRow(row) {
  return {
    id: row.id,
    public_id: row.public_id,
    title: row.title,
    description: row.description || '',
    created_at: row.created_at,
    due_at: row.due_at,
    client_id: row.client_id,
    client_name: row.client_name || '',
    status_id: row.status_id,
    status_name: row.status_name || '',
    status_label: row.status_label || row.status_name || '',
    status_badge_class: row.status_badge_class || '',
    priority_id: row.priority_id,
    priority_name: row.priority_name || '',
    priority_badge_class: row.priority_badge_class || '',
    category_id: row.category_id,
    category_name: row.category_name || '',
    assigned_to_user_id: row.assigned_to_user_id,
    assigned_to_email: row.assigned_to_email || '',
    project_id: row.project_id,
    project_name: row.project_name || ''
  };
}

async function generatePublicId() {
  const prefix = 'AR';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix} ${Math.floor(1000 + Math.random() * 9000)}`;
    const { rowCount } = await pool.query('SELECT 1 FROM tickets WHERE public_id = $1', [candidate]);
    if (rowCount === 0) {
      return candidate;
    }
  }
  return `${prefix}-${Date.now()}`;
}

router.get('/metadata', async (req, res, next) => {
  try {
    const staff = isStaff(req.user);

    let clients = [];
    if (staff) {
      ({ rows: clients } = await pool.query(
        'SELECT id, company_name FROM clients ORDER BY company_name ASC'
      ));
    } else {
      const clientId = await fetchClientIdForUser(req.user.id);
      if (clientId) {
        ({ rows: clients } = await pool.query(
          'SELECT id, company_name FROM clients WHERE id = $1',
          [clientId]
        ));
      }
    }

    const { rows: statuses } = await pool.query(
      'SELECT id, name, label, badge_class, is_closed_state FROM ticket_statuses ORDER BY id'
    );
    const { rows: priorities } = await pool.query(
      'SELECT id, name, weight, badge_class FROM ticket_priorities ORDER BY weight DESC, id'
    );
    const { rows: categories } = await pool.query(
      'SELECT id, name, COALESCE(description, \'\') AS description FROM ticket_categories ORDER BY name'
    );

    let assignees = [];
    if (staff) {
      ({ rows: assignees } = await pool.query(
        'SELECT id, email, role FROM users ORDER BY email'
      ));
    } else {
      ({ rows: assignees } = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [req.user.id]
      ));
    }

    let projects = [];
    try {
      if (staff) {
        ({ rows: projects } = await pool.query(
          'SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 200'
        ));
      } else {
        ({ rows: projects } = await pool.query(
          `SELECT p.id, p.name
             FROM projects p
             JOIN shoot_bookings sb ON p.shoot_booking_id = sb.id
             JOIN clients c ON sb.client_id = c.id
            WHERE c.user_id = $1
            ORDER BY p.created_at DESC
            LIMIT 200`,
          [req.user.id]
        ));
      }
    } catch (projectError) {
      if (projectError.code !== '42P01') {
        throw projectError;
      }
      projects = [];
    }

    res.json({ clients, statuses, priorities, categories, assignees, projects });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const staff = isStaff(req.user);
    const params = [];
    let whereClause = '';

    if (!staff) {
      params.push(req.user.id);
      whereClause = 'WHERE c.user_id = $1 OR t.created_by_user_id = $1';
    }

    const query = `
      SELECT
        t.id,
        t.public_id,
        t.title,
        t.description,
        t.created_at,
        t.due_at,
        t.client_id,
        c.company_name AS client_name,
        t.status_id,
        ts.name AS status_name,
        ts.label AS status_label,
        ts.badge_class AS status_badge_class,
        t.priority_id,
        tp.name AS priority_name,
        tp.badge_class AS priority_badge_class,
        t.category_id,
        tc.name AS category_name,
        t.assigned_to_user_id,
        assign.email AS assigned_to_email,
        t.project_id,
        proj.name AS project_name
      FROM tickets t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      LEFT JOIN users assign ON t.assigned_to_user_id = assign.id
      LEFT JOIN projects proj ON t.project_id = proj.id
      ${whereClause}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 500
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows.map(mapTicketRow));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const clientId = Number.parseInt(req.body.client_id, 10);
    if (!Number.isFinite(clientId)) {
      return res.status(400).json({ error: 'client_id is required' });
    }

    const statusId = Number.parseInt(req.body.status_id, 10);
    if (!Number.isFinite(statusId)) {
      return res.status(400).json({ error: 'status_id is required' });
    }

    const priorityId = Number.parseInt(req.body.priority_id, 10);
    if (!Number.isFinite(priorityId)) {
      return res.status(400).json({ error: 'priority_id is required' });
    }

    const categoryId = req.body.category_id !== undefined && req.body.category_id !== null && req.body.category_id !== ''
      ? Number.parseInt(req.body.category_id, 10)
      : null;
    if (categoryId !== null && !Number.isFinite(categoryId)) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }

    const assignedTo = req.body.assigned_to_user_id !== undefined && req.body.assigned_to_user_id !== null && req.body.assigned_to_user_id !== ''
      ? Number.parseInt(req.body.assigned_to_user_id, 10)
      : null;
    if (assignedTo !== null && !Number.isFinite(assignedTo)) {
      return res.status(400).json({ error: 'Invalid assigned_to_user_id' });
    }

    const projectId = req.body.project_id !== undefined && req.body.project_id !== null && req.body.project_id !== ''
      ? Number.parseInt(req.body.project_id, 10)
      : null;
    if (projectId !== null && !Number.isFinite(projectId)) {
      return res.status(400).json({ error: 'Invalid project_id' });
    }

    const description = (req.body.description || '').trim();
    const dueDate = req.body.due_date ? new Date(req.body.due_date) : null;
    if (dueDate && !Number.isFinite(dueDate.getTime())) {
      return res.status(400).json({ error: 'Invalid due_date' });
    }

    if (!isStaff(req.user)) {
      const allowedClientId = await fetchClientIdForUser(req.user.id);
      if (!allowedClientId || allowedClientId !== clientId) {
        return res.status(403).json({ error: 'You cannot create tickets for other clients' });
      }
    }

    const publicId = await generatePublicId();

    const insertSql = `
      INSERT INTO tickets (
        public_id,
        client_id,
        project_id,
        title,
        description,
        status_id,
        priority_id,
        category_id,
        created_by_user_id,
        assigned_to_user_id,
        due_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const { rows } = await pool.query(insertSql, [
      publicId,
      clientId,
      projectId,
      title,
      description || null,
      statusId,
      priorityId,
      categoryId,
      req.user.id,
      assignedTo,
      dueDate
    ]);

    const ticketId = rows[0]?.id;
    if (!ticketId) {
      return res.status(500).json({ error: 'Failed to create ticket' });
    }

    const detailedResult = await pool.query(
      `SELECT
         t.id,
         t.public_id,
         t.title,
         t.description,
         t.created_at,
         t.due_at,
         t.client_id,
         c.company_name AS client_name,
         t.status_id,
         ts.name AS status_name,
         ts.label AS status_label,
         ts.badge_class AS status_badge_class,
         t.priority_id,
         tp.name AS priority_name,
         tp.badge_class AS priority_badge_class,
         t.category_id,
         tc.name AS category_name,
         t.assigned_to_user_id,
         assign.email AS assigned_to_email,
         t.project_id,
         proj.name AS project_name
       FROM tickets t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN ticket_statuses ts ON t.status_id = ts.id
       LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
       LEFT JOIN ticket_categories tc ON t.category_id = tc.id
       LEFT JOIN users assign ON t.assigned_to_user_id = assign.id
       LEFT JOIN projects proj ON t.project_id = proj.id
       WHERE t.id = $1`,
      [ticketId]
    );

    const detailedRow = detailedResult.rows[0];

    const fallbackRow = detailedRow || {
      id: ticketId,
      public_id: publicId,
      title,
      description,
      created_at: new Date(),
      due_at: dueDate,
      client_id: clientId,
      client_name: '',
      status_id: statusId,
      status_name: '',
      status_label: '',
      status_badge_class: '',
      priority_id: priorityId,
      priority_name: '',
      priority_badge_class: '',
      category_id: categoryId,
      category_name: '',
      assigned_to_user_id: assignedTo,
      assigned_to_email: '',
      project_id: projectId,
      project_name: ''
    };

    res.status(201).json(mapTicketRow(fallbackRow));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ticketId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ error: 'Invalid ticket id' });
    }

    const { rows } = await pool.query(
      'SELECT id, client_id, created_by_user_id FROM tickets WHERE id = $1',
      [ticketId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = rows[0];

    if (!isStaff(req.user)) {
      const allowedClientId = await fetchClientIdForUser(req.user.id);
      if (!allowedClientId || (ticket.client_id !== allowedClientId && ticket.created_by_user_id !== req.user.id)) {
        return res.status(403).json({ error: 'You cannot delete this ticket' });
      }
    }

    await pool.query('DELETE FROM tickets WHERE id = $1', [ticketId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
