const { pool } = require('../db/pool');

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value) || 0;
}

async function resolveClientIdForUser(userId) {
  const { rows } = await pool.query('SELECT id FROM clients WHERE user_id = $1 LIMIT 1', [userId]);
  return rows[0]?.id || null;
}

async function fetchDashboardSummary(user) {
  const isStaff = user?.role && user.role !== 'client';
  const clientId = isStaff ? null : await resolveClientIdForUser(user.id);

  if (!isStaff && !clientId) {
    return {
      scope: 'client',
      metrics: {
        bookings: { total: 0, active: 0, upcoming: 0, cancelled: 0 },
        projects: { total: 0, active: 0, completed: 0, pending: 0, completionRate: 0 },
        tickets: { total: 0, open: 0 },
        revenue: { total: 0, last30Days: 0, paymentsLast30: 0 },
        clients: { newLast30Days: 0 }
      },
      upcomingBookings: [],
      recentBookings: [],
      notifications: [],
      activity: [],
      topClients: [],
      recentPayments: []
    };
  }

  const bookingFilter = clientId ? 'sb.client_id = $1' : '1=1';
  const bookingParams = clientId ? [clientId] : [];

  const projectFilter = clientId ? 'sb.client_id = $1' : '1=1';
  const projectParams = clientId ? [clientId] : [];

  const ticketFilter = clientId ? 't.client_id = $1' : '1=1';
  const ticketParams = clientId ? [clientId] : [];

  const paymentFilter = clientId ? 'sb.client_id = $1' : '1=1';
  const paymentParams = clientId ? [clientId] : [];

  const notificationFilter = isStaff ? '1=1' : 'n.user_id = $1';
  const notificationParams = isStaff ? [] : [user.id];

  const activityFilter = isStaff ? '1=1' : '(a.user_id = $1 OR a.user_id IS NULL)';
  const activityParams = isStaff ? [] : [user.id];

  const upcomingBookingsPromise = pool.query(
    `SELECT
        sb.id,
        sb.scheduled_start,
        sb.scheduled_end,
        sb.status,
        sb.total_amount,
        c.company_name,
        p.label AS property_label
     FROM shoot_bookings sb
     JOIN clients c ON sb.client_id = c.id
     JOIN properties p ON sb.property_id = p.id
     WHERE ${bookingFilter} AND sb.scheduled_start >= NOW()
     ORDER BY sb.scheduled_start ASC
     LIMIT 5`,
    bookingParams
  );

  const recentBookingsPromise = pool.query(
    `SELECT
        sb.id,
        sb.created_at,
        sb.status,
        sb.total_amount,
        c.company_name,
        p.label AS property_label
     FROM shoot_bookings sb
     JOIN clients c ON sb.client_id = c.id
     JOIN properties p ON sb.property_id = p.id
     WHERE ${bookingFilter}
     ORDER BY sb.created_at DESC
     LIMIT 6`,
    bookingParams
  );

  const bookingMetricsPromise = pool.query(
    `SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE sb.status ILIKE 'cancel%')::INT AS cancelled,
        COUNT(*) FILTER (WHERE sb.status IN ('pending','confirmed','scheduled','in_progress'))::INT AS active,
        COUNT(*) FILTER (WHERE sb.scheduled_start >= NOW())::INT AS upcoming
     FROM shoot_bookings sb
     WHERE ${bookingFilter}`,
    bookingParams
  );

  const projectMetricsPromise = pool.query(
    `SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE p.status IN ('in_preproduction','in_progress'))::INT AS active,
        COUNT(*) FILTER (WHERE p.status = 'completed')::INT AS completed,
        COUNT(*) FILTER (WHERE p.status ILIKE 'pending%' OR p.status = 'on_hold')::INT AS pending
     FROM projects p
     JOIN shoot_bookings sb ON p.shoot_booking_id = sb.id
     WHERE ${projectFilter}`,
    projectParams
  );

  const ticketMetricsPromise = pool.query(
    `SELECT
        COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE ts.is_closed_state IS FALSE)::INT AS open_count
     FROM tickets t
     JOIN ticket_statuses ts ON t.status_id = ts.id
     WHERE ${ticketFilter}`,
    ticketParams
  );

  const revenueMetricsPromise = pool.query(
    `SELECT
        COALESCE(SUM(pay.amount), 0) AS total_amount,
        COALESCE(SUM(pay.amount) FILTER (WHERE pay.created_at >= NOW() - INTERVAL '30 days'), 0) AS recent_amount,
        COUNT(*) FILTER (WHERE pay.created_at >= NOW() - INTERVAL '30 days')::INT AS recent_payments
     FROM payments pay
     JOIN shoot_bookings sb ON pay.shoot_booking_id = sb.id
     WHERE ${paymentFilter}`,
    paymentParams
  );

  const newClientsPromise = pool.query(
    `SELECT COUNT(*)::INT AS recent_clients
     FROM clients c
     WHERE ${isStaff ? '1=1' : 'c.id = $1'}
       AND c.created_at >= NOW() - INTERVAL '30 days'`,
    isStaff ? [] : clientId ? [clientId] : [0]
  );

  const topClientsPromise = isStaff
    ? pool.query(
        `SELECT
           c.id,
           c.company_name,
           COALESCE(COUNT(DISTINCT sb.id), 0)::INT AS bookings_count,
           COALESCE(SUM(pay.amount), 0) AS revenue
         FROM clients c
         LEFT JOIN shoot_bookings sb ON sb.client_id = c.id
         LEFT JOIN payments pay ON pay.shoot_booking_id = sb.id
         GROUP BY c.id
         ORDER BY revenue DESC, bookings_count DESC, c.company_name ASC
         LIMIT 5`
      )
    : pool.query(
        `SELECT
           c.id,
           c.company_name,
           COALESCE(COUNT(DISTINCT sb.id), 0)::INT AS bookings_count,
           COALESCE(SUM(pay.amount), 0) AS revenue
         FROM clients c
         LEFT JOIN shoot_bookings sb ON sb.client_id = c.id
         LEFT JOIN payments pay ON pay.shoot_booking_id = sb.id
         WHERE c.id = $1
         GROUP BY c.id`,
        clientId ? [clientId] : [0]
      );

  const recentPaymentsPromise = pool.query(
    `SELECT
        pay.id,
        pay.provider,
        pay.amount,
        pay.status,
        pay.created_at,
        sb.id AS booking_id,
        c.company_name
     FROM payments pay
     JOIN shoot_bookings sb ON pay.shoot_booking_id = sb.id
     JOIN clients c ON sb.client_id = c.id
     WHERE ${paymentFilter}
     ORDER BY pay.created_at DESC
     LIMIT 5`,
    paymentParams
  );

  const notificationsPromise = pool.query(
    `SELECT
        n.id,
        n.title,
        n.message,
        n.type,
        n.created_at,
        u.email AS user_email
     FROM notifications n
     JOIN users u ON n.user_id = u.id
     WHERE ${notificationFilter}
     ORDER BY n.created_at DESC
     LIMIT 6`,
    notificationParams
  );

  const activityPromise = pool.query(
    `SELECT
        a.id,
        a.action_type,
        a.description,
        a.occurred_at,
        u.email AS user_email
     FROM activity_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE ${activityFilter}
     ORDER BY a.occurred_at DESC
     LIMIT 6`,
    activityParams
  );

  const [
    upcomingBookings,
    recentBookings,
    bookingMetrics,
    projectMetrics,
    ticketMetrics,
    revenueMetrics,
    newClients,
    topClients,
    recentPayments,
    notifications,
    activity
  ] = await Promise.all([
    upcomingBookingsPromise,
    recentBookingsPromise,
    bookingMetricsPromise,
    projectMetricsPromise,
    ticketMetricsPromise,
    revenueMetricsPromise,
    newClientsPromise,
    topClientsPromise,
    recentPaymentsPromise,
    notificationsPromise,
    activityPromise
  ]);

  const bookingStats = bookingMetrics.rows[0] || { total: 0, cancelled: 0, active: 0, upcoming: 0 };
  const projectStats = projectMetrics.rows[0] || { total: 0, active: 0, completed: 0, pending: 0 };
  const ticketStats = ticketMetrics.rows[0] || { total: 0, open_count: 0 };
  const revenueStats = revenueMetrics.rows[0] || { total_amount: 0, recent_amount: 0, recent_payments: 0 };
  const clientStats = newClients.rows[0] || { recent_clients: 0 };

  const projectCompletion = projectStats.total
    ? Math.round((projectStats.completed / projectStats.total) * 100)
    : 0;

  return {
    scope: isStaff ? 'staff' : 'client',
    metrics: {
      bookings: {
        total: bookingStats.total,
        active: bookingStats.active,
        upcoming: bookingStats.upcoming,
        cancelled: bookingStats.cancelled
      },
      projects: {
        total: projectStats.total,
        active: projectStats.active,
        completed: projectStats.completed,
        pending: projectStats.pending,
        completionRate: projectCompletion
      },
      tickets: {
        total: ticketStats.total,
        open: ticketStats.open_count
      },
      revenue: {
        total: toNumber(revenueStats.total_amount),
        last30Days: toNumber(revenueStats.recent_amount),
        paymentsLast30: revenueStats.recent_payments || 0
      },
      clients: {
        newLast30Days: clientStats.recent_clients || 0
      }
    },
    upcomingBookings: upcomingBookings.rows,
    recentBookings: recentBookings.rows,
    notifications: notifications.rows,
    activity: activity.rows,
    topClients: topClients.rows,
    recentPayments: recentPayments.rows
  };
}

module.exports = { fetchDashboardSummary };
