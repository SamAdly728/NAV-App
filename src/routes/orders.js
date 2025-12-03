const express = require('express');

const router = express.Router();

const { pool } = require('../db/pool');

const STAFF_ROLES = new Set(['admin', 'nav_staff']);
const KNOWN_STATUSES = new Set([
  'pending',
  'confirmed',
  'scheduled',
  'in_progress',
  'delivered',
  'returned',
  'cancelled',
  'archived'
]);

function isStaff(user) {
  return Boolean(user && STAFF_ROLES.has(user.role));
}

async function resolveClientIdForUser(userId) {
  const { rows } = await pool.query('SELECT id FROM clients WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0]?.id || null;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function orderStatusLabel(status) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'scheduled':
      return 'Scheduled';
    case 'in_progress':
      return 'In Progress';
    case 'delivered':
      return 'Delivered';
    case 'returned':
      return 'Returned';
    case 'cancelled':
      return 'Cancelled';
    case 'archived':
      return 'Archived';
    default:
      return (status || 'Unknown').replace(/_/g, ' ');
  }
}

function paymentStatusLabel(status) {
  switch (status) {
    case 'paid':
    case 'succeeded':
      return 'Paid';
    case 'partial':
      return 'Partially Paid';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    default:
      return (status || 'Unknown').replace(/_/g, ' ');
  }
}

function mapOrderRow(row) {
  return {
    id: row.id,
    reference: row.reference_code,
    status: row.status,
    status_label: orderStatusLabel(row.status),
    payment_status: row.payment_status,
    payment_status_label: paymentStatusLabel(row.payment_status),
    subtotal_amount: toNumber(row.subtotal_amount),
    total_amount: toNumber(row.total_amount),
    scheduled_start: row.scheduled_start,
    scheduled_end: row.scheduled_end,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: {
      id: row.client_id,
      name: row.client_contact_name || row.client_company_name || row.client_email || '',
      company: row.client_company_name || '',
      email: row.client_email || '',
      avatar_url: row.client_avatar_url || null
    },
    product: {
      id: row.shoot_type_id,
      name: row.shoot_type_name || ''
    },
    property: {
      id: row.property_id,
      label: row.property_label || '',
      city: row.property_city || '',
      state: row.property_state || ''
    },
    latest_payment: row.payment_id
      ? {
          id: row.payment_id,
          amount: toNumber(row.payment_amount),
          status: row.payment_status_value,
          provider: row.payment_provider || '',
          created_at: row.payment_created_at
        }
      : null
  };
}

async function listOrders(req, res, next) {
  try {
    const staff = isStaff(req.user);
    const params = [];
    const conditions = [];

    if (!staff) {
      const clientId = await resolveClientIdForUser(req.user.id);
      if (!clientId) {
        return res.json({ orders: [], total: 0, limit: 0, offset: 0 });
      }
      params.push(clientId);
      conditions.push(`sb.client_id = $${params.length}`);
    }

    const statusFilter = (req.query.status || '').toLowerCase();
    if (statusFilter && KNOWN_STATUSES.has(statusFilter)) {
      params.push(statusFilter);
      conditions.push(`sb.status = $${params.length}`);
    }

    const search = (req.query.search || '').trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        sb.id::text ILIKE $${params.length}
        OR c.company_name ILIKE $${params.length}
        OR COALESCE(u.email, '') ILIKE $${params.length}
        OR COALESCE(st.name, '') ILIKE $${params.length}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    params.push(limit);

    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    params.push(offset);

    const query = `
      SELECT
        sb.id,
        sb.status,
        sb.payment_status,
        sb.subtotal_amount,
        sb.total_amount,
        sb.scheduled_start,
        sb.scheduled_end,
        sb.created_at,
        sb.updated_at,
        sb.client_id,
        sb.property_id,
        sb.shoot_type_id,
        CONCAT('#LA', LPAD(sb.id::text, 5, '0')) AS reference_code,
        c.company_name AS client_company_name,
        u.email AS client_email,
        u.avatar_url AS client_avatar_url,
        NULL::text AS client_contact_name,
        st.name AS shoot_type_name,
        prop.label AS property_label,
        prop.city AS property_city,
        prop.state AS property_state,
        payment.id AS payment_id,
        payment.amount AS payment_amount,
        payment.status AS payment_status_value,
        payment.provider AS payment_provider,
        payment.created_at AS payment_created_at
      FROM shoot_bookings sb
      JOIN clients c ON c.id = sb.client_id
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN shoot_types st ON st.id = sb.shoot_type_id
      LEFT JOIN properties prop ON prop.id = sb.property_id
      LEFT JOIN LATERAL (
        SELECT p.id, p.amount, p.status, p.provider, p.created_at
        FROM payments p
        WHERE p.shoot_booking_id = sb.id
        ORDER BY p.created_at DESC
        LIMIT 1
      ) payment ON true
      ${whereClause}
      ORDER BY sb.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await pool.query(query, params);

    let total = rows.length;
    if (offset === 0 && rows.length >= limit) {
      const countQuery = `
        SELECT COUNT(*)::INT AS count
        FROM shoot_bookings sb
        JOIN clients c ON c.id = sb.client_id
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN shoot_types st ON st.id = sb.shoot_type_id
        LEFT JOIN properties prop ON prop.id = sb.property_id
        ${whereClause}
      `;
      const { rows: countRows } = await pool.query(countQuery, params.slice(0, params.length - 2));
      total = countRows[0]?.count || rows.length;
    }

    res.json({
      orders: rows.map(mapOrderRow),
      total,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const staff = isStaff(req.user);
    const params = [orderId];
    let whereClause = 'WHERE sb.id = $1';

    if (!staff) {
      params.push(req.user.id);
      whereClause += ' AND c.user_id = $2';
    }

    const query = `
      SELECT
        sb.id,
        sb.status,
        sb.payment_status,
        sb.subtotal_amount,
        sb.total_amount,
        sb.scheduled_start,
        sb.scheduled_end,
        sb.created_at,
        sb.updated_at,
        sb.client_id,
        sb.property_id,
        sb.shoot_type_id,
        CONCAT('#LA', LPAD(sb.id::text, 5, '0')) AS reference_code,
        c.company_name AS client_company_name,
        u.email AS client_email,
        u.avatar_url AS client_avatar_url,
        NULL::text AS client_contact_name,
        st.name AS shoot_type_name,
        prop.label AS property_label,
        prop.city AS property_city,
        prop.state AS property_state,
        payment.id AS payment_id,
        payment.amount AS payment_amount,
        payment.status AS payment_status_value,
        payment.provider AS payment_provider,
        payment.created_at AS payment_created_at
      FROM shoot_bookings sb
      JOIN clients c ON c.id = sb.client_id
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN shoot_types st ON st.id = sb.shoot_type_id
      LEFT JOIN properties prop ON prop.id = sb.property_id
      LEFT JOIN LATERAL (
        SELECT p.id, p.amount, p.status, p.provider, p.created_at
        FROM payments p
        WHERE p.shoot_booking_id = sb.id
        ORDER BY p.created_at DESC
        LIMIT 1
      ) payment ON true
      ${whereClause}
      LIMIT 1
    `;

    const { rows } = await pool.query(query, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(mapOrderRow(rows[0]));
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ error: 'Only staff can update orders' });
    }

    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const status = (req.body.status || '').toLowerCase();
    if (!KNOWN_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${[...KNOWN_STATUSES].join(', ')}` });
    }

    await pool.query('UPDATE shoot_bookings SET status = $1, updated_at = NOW() WHERE id = $2', [status, orderId]);

    const { rows } = await pool.query('SELECT status FROM shoot_bookings WHERE id = $1 LIMIT 1', [orderId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ id: orderId, status: rows[0].status, status_label: orderStatusLabel(rows[0].status) });
  } catch (error) {
    next(error);
  }
}

async function archiveOrder(req, res, next) {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ error: 'Only staff can archive orders' });
    }

    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const { rowCount } = await pool.query('UPDATE shoot_bookings SET status = $1, updated_at = NOW() WHERE id = $2', ['archived', orderId]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

router.get('/', listOrders);
router.get('/:id', getOrder);
router.put('/:id/status', updateOrderStatus);
router.delete('/:id', archiveOrder);

module.exports = router;
