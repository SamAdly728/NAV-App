const express = require('express');

const router = express.Router();

const { pool } = require('../db/pool');

const STAFF_ROLES = new Set(['admin', 'nav_staff']);
const DEFAULT_STATUS = 'in_preproduction';
const ALLOWED_STATUSES = new Set([
  'in_preproduction',
  'in_production',
  'in_postproduction',
  'pending_review',
  'completed',
  'archived'
]);

const DESIGNING_STATUSES = new Set(['in_preproduction', 'in_postproduction', 'pending_review']);
const DEVELOPMENT_STATUSES = new Set(['in_production', 'completed']);

function isStaff(user) {
  return Boolean(user && STAFF_ROLES.has(user.role));
}

function coerceNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusLabel(status) {
  switch (status) {
    case 'in_preproduction':
      return 'In Pre-Production';
    case 'in_production':
      return 'In Production';
    case 'in_postproduction':
      return 'In Post-Production';
    case 'pending_review':
      return 'Pending Review';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return (status || 'Unknown').replace(/_/g, ' ');
  }
}

function statusCategory(status) {
  if (DESIGNING_STATUSES.has(status)) return 'designing';
  if (DEVELOPMENT_STATUSES.has(status)) return 'development';
  return 'other';
}

function mapProjectRow(row) {
  const members = Array.isArray(row.members) ? row.members : [];
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    status_label: statusLabel(row.status),
    status_category: statusCategory(row.status),
    thumbnail_url: row.thumbnail_url || null,
    progress: coerceNumber(row.progress) ?? 0,
    notes: row.notes || '',
    started_at: row.started_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    shoot_booking: {
      id: row.shoot_booking_id,
      status: row.booking_status || null,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      total_amount: coerceNumber(row.total_amount)
    },
    assigned_lead: row.assigned_lead_id
      ? {
          id: row.assigned_lead_id,
          email: row.assigned_lead_email,
          avatar_url: row.assigned_lead_avatar_url || null
        }
      : null,
    members: members.map((member) => ({
      id: member.id,
      email: member.email,
      avatar_url: member.avatar_url || null
    }))
  };
}

async function getProjects({ user, projectId = null }) {
  const staff = isStaff(user);
  const params = [];
  const conditions = [];

  if (projectId !== null) {
    params.push(projectId);
    conditions.push(`p.id = $${params.length}`);
  }

  if (!staff) {
    params.push(user.id);
    conditions.push(`c.user_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      p.id,
      p.shoot_booking_id,
      p.name,
      p.status,
      p.thumbnail_url,
      p.progress,
      p.notes,
      p.started_at,
      p.delivered_at,
      p.created_at,
      p.updated_at,
      sb.total_amount,
      sb.scheduled_start,
      sb.scheduled_end,
      sb.status AS booking_status,
      lead_user.id AS assigned_lead_id,
      lead_user.email AS assigned_lead_email,
      lead_user.avatar_url AS assigned_lead_avatar_url,
      COALESCE(members.members, '[]'::json) AS members
    FROM projects p
    JOIN shoot_bookings sb ON sb.id = p.shoot_booking_id
    JOIN clients c ON c.id = sb.client_id
    LEFT JOIN users lead_user ON lead_user.id = p.assigned_lead_id
    LEFT JOIN LATERAL (
      SELECT json_agg(
               json_build_object(
                 'id', pm.user_id,
                 'email', member_user.email,
                 'avatar_url', member_user.avatar_url
               ) ORDER BY pm.joined_at
             ) AS members
      FROM project_members pm
      JOIN users member_user ON member_user.id = pm.user_id
      WHERE pm.project_id = p.id
    ) members ON true
    ${whereClause}
    ORDER BY p.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows.map(mapProjectRow);
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await getProjects({ user: req.user });
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ error: 'Only staff members can create projects' });
    }

    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const bookingId = Number.parseInt(req.body.shoot_booking_id, 10);
    if (!Number.isFinite(bookingId)) {
      return res.status(400).json({ error: 'shoot_booking_id is required and must be a number' });
    }

    const status = (req.body.status || DEFAULT_STATUS).trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${[...ALLOWED_STATUSES].join(', ')}` });
    }

    let progress = req.body.progress !== undefined ? Number.parseInt(req.body.progress, 10) : 0;
    if (!Number.isFinite(progress)) {
      progress = 0;
    }
    progress = Math.min(100, Math.max(0, progress));

    const thumbnailUrl = (req.body.thumbnail_url || '').trim() || null;

    let assignedLeadId = null;
    if (req.body.assigned_lead_id !== undefined && req.body.assigned_lead_id !== null && `${req.body.assigned_lead_id}`.trim() !== '') {
      assignedLeadId = Number.parseInt(req.body.assigned_lead_id, 10);
      if (!Number.isFinite(assignedLeadId)) {
        return res.status(400).json({ error: 'assigned_lead_id must be a number' });
      }
    }

    const notes = (req.body.notes || '').trim() || null;

    let startedAt = null;
    if (req.body.started_at) {
      const startedDate = new Date(req.body.started_at);
      if (Number.isFinite(startedDate.getTime())) {
        startedAt = startedDate;
      } else {
        return res.status(400).json({ error: 'Invalid started_at value' });
      }
    }

    let deliveredAt = null;
    if (req.body.delivered_at) {
      const deliveredDate = new Date(req.body.delivered_at);
      if (Number.isFinite(deliveredDate.getTime())) {
        deliveredAt = deliveredDate;
      } else {
        return res.status(400).json({ error: 'Invalid delivered_at value' });
      }
    }

    const bookingCheck = await pool.query('SELECT id FROM shoot_bookings WHERE id = $1 LIMIT 1', [bookingId]);
    if (bookingCheck.rowCount === 0) {
      return res.status(400).json({ error: 'shoot_booking_id does not reference an existing booking' });
    }

    const insertSql = `
      INSERT INTO projects (shoot_booking_id, name, status, assigned_lead_id, thumbnail_url, progress, notes, started_at, delivered_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const insertParams = [
      bookingId,
      name,
      status,
      assignedLeadId,
      thumbnailUrl,
      progress,
      notes,
      startedAt,
      deliveredAt
    ];

    const { rows } = await pool.query(insertSql, insertParams);
    const projectId = rows[0]?.id;

    if (!projectId) {
      return res.status(500).json({ error: 'Failed to create project' });
    }

    const [project] = await getProjects({ user: req.user, projectId });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ error: 'Only staff members can delete projects' });
    }

    const projectId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    const projectResult = await pool.query('SELECT id FROM projects WHERE id = $1 LIMIT 1', [projectId]);
    if (projectResult.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
