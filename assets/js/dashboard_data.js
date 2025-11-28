(function () {
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });

  const bookingStatusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value || 0));
  }

  function formatDateTime(value) {
    if (!value) return '--';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : '--';
  }

  function formatRelative(value) {
    if (!value) return '--';
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '--';
    const diffMs = Date.now() - date.getTime();
    const tense = diffMs >= 0 ? 'ago' : 'from now';
    const absMs = Math.abs(diffMs);
    const sec = Math.round(absMs / 1000);
    if (sec < 60) return `${sec}s ${tense}`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} min ${tense}`;
    const hrs = Math.round(min / 60);
    if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ${tense}`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ${tense}`;
    return date.toLocaleDateString();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function initials(text) {
    if (!text) return 'NA';
    const parts = text.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || parts[0]?.[1] || '';
    return (first + second).toUpperCase();
  }

  function clearPlaceholders(container) {
    if (!container) return;
    container.querySelectorAll('[data-placeholder]').forEach((node) => node.remove());
  }

  function replaceListItems(container, items, renderItem, emptyText) {
    if (!container) return;
    const children = Array.from(container.children);
    const header = children.find((child) => child.dataset && child.dataset.header);
    children.forEach((child) => {
      if (header && child === header) return;
      container.removeChild(child);
    });
    if (!items || !items.length) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'text-center py-3 text-secondary';
      emptyLi.textContent = emptyText;
      container.appendChild(emptyLi);
      return;
    }
    items.forEach((item) => container.appendChild(renderItem(item)));
  }

  function renderBookingItem(booking) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'd-flex align-items-center text-decoration-none text-reset';
    link.href = `/template/orders_details.html?booking=${booking.id}`;

    const icon = document.createElement('div');
    icon.className = 'h-45 w-45 d-flex-center b-r-12 overflow-hidden flex-shrink-0 bg-primary text-white f-w-600';
    icon.textContent = initials(booking.company_name || booking.property_label || 'Booking');

    const textWrap = document.createElement('div');
    textWrap.className = 'ms-3';

    const title = document.createElement('p');
    title.className = 'mb-0 f-w-500 f-s-16 txt-ellipsis-1';
    const company = booking.company_name || 'Client';
    const property = booking.property_label ? ` • ${booking.property_label}` : '';
    title.textContent = `${company}${property}`;

    const meta = document.createElement('p');
    meta.className = 'mb-0 text-secondary';
    const rawStatus = (booking.status || 'scheduled').toLowerCase();
    const statusLabel = bookingStatusLabels[rawStatus] || rawStatus.replace(/_/g, ' ');
    meta.textContent = `${formatRelative(booking.created_at)} • ${statusLabel}`;

    textWrap.appendChild(title);
    textWrap.appendChild(meta);

    link.appendChild(icon);
    link.appendChild(textWrap);
    li.appendChild(link);
    return li;
  }

  function renderClientItem(client) {
    const li = document.createElement('li');
    li.className = 'd-flex align-items-center';

    const icon = document.createElement('div');
    icon.className = 'b-1-light bg-primary-200 p-1 h-40 w-40 d-flex-center b-r-12 flex-shrink-0 overflow-hidden box-list-img text-dark';
    icon.textContent = initials(client.company_name || 'Client');

    const body = document.createElement('div');
    body.className = 'flex-grow-1 mg-s-45';

    const name = document.createElement('h6');
    name.className = 'mb-0 f-w-500 text-dark-800 txt-ellipsis-1';
    name.textContent = client.company_name || 'Client';

    const detail = document.createElement('p');
    detail.className = 'text-secondary-800 mb-0';
    detail.textContent = `${client.bookings_count || 0} bookings`;

    const aside = document.createElement('div');
    aside.className = 'text-end';

    const badge = document.createElement('span');
    badge.className = 'badge bg-light-primary';
    badge.textContent = formatCurrency(client.revenue || 0);

    body.appendChild(name);
    body.appendChild(detail);
    aside.appendChild(badge);

    li.appendChild(icon);
    li.appendChild(body);
    li.appendChild(aside);
    return li;
  }

  function renderNotificationItem(notification) {
    const li = document.createElement('li');
    li.className = 'side-timeline-section w-100 right-side';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'side-timeline-icon';

    const iconSpan = document.createElement('span');
    const type = (notification.type || '').toLowerCase();
    let iconClass = 'ph ph-bell';
    let bgClass = 'bg-light-secondary text-dark-400';
    if (type.includes('success')) {
      iconClass = 'ph ph-check-circle';
      bgClass = 'bg-success text-white';
    } else if (type.includes('error') || type.includes('danger')) {
      iconClass = 'ph ph-warning';
      bgClass = 'bg-danger text-white';
    } else if (type.includes('warning')) {
      iconClass = 'ph ph-warning-circle';
      bgClass = 'bg-warning text-dark';
    } else {
      iconClass = 'ph ph-bell-ringing';
      bgClass = 'bg-primary text-white';
    }
    iconSpan.className = `${bgClass} h-35 w-35 d-flex-center b-r-50`;
    const icon = document.createElement('i');
    icon.className = `${iconClass} f-s-18`;
    iconSpan.appendChild(icon);
    iconWrap.appendChild(iconSpan);

    const content = document.createElement('div');
    content.className = 'timeline-content p-0';

    const wrapper = document.createElement('div');
    const title = document.createElement('h6');
    title.className = 'f-s-15 mb-1 txt-ellipsis-1';
    title.textContent = notification.title || 'Notification';

    const body = document.createElement('p');
    body.className = 'mb-0 text-dark-800 f-w-400 txt-ellipsis-2';
    body.textContent = notification.message || '';

    const meta = document.createElement('div');
    meta.className = 'text-secondary f-s-12';
    const userLabel = notification.user_email ? ` • ${notification.user_email}` : '';
    meta.textContent = `${formatRelative(notification.created_at)}${userLabel}`;

    wrapper.appendChild(title);
    wrapper.appendChild(body);
    wrapper.appendChild(meta);
    content.appendChild(wrapper);

    li.appendChild(iconWrap);
    li.appendChild(content);
    return li;
  }

  function renderActivityItem(entry) {
    const li = document.createElement('li');
    li.className = 'd-flex align-items-start mb-2';

    const bullet = document.createElement('span');
    bullet.className = 'me-2 text-primary';
    bullet.innerHTML = '<i class="ti ti-record-filled"></i>';

    const body = document.createElement('div');
    body.className = 'flex-grow-1';

    const title = document.createElement('p');
    title.className = 'mb-0 f-w-500 text-dark-800 txt-ellipsis-1';
    const actor = entry.user_email ? `${entry.user_email} • ` : '';
    title.textContent = `${actor}${entry.action_type || 'activity'}`;

    const meta = document.createElement('p');
    meta.className = 'mb-0 text-secondary f-s-12';
    meta.textContent = `${formatRelative(entry.occurred_at)} – ${entry.description || ''}`;

    body.appendChild(title);
    body.appendChild(meta);

    li.appendChild(bullet);
    li.appendChild(body);
    return li;
  }

  function applyDashboardData(data) {
    const metrics = data.metrics || {};
    const bookings = metrics.bookings || {};
    const projects = metrics.projects || {};
    const tickets = metrics.tickets || {};
    const revenue = metrics.revenue || {};
    const clients = metrics.clients || {};

    setText('stat-total-revenue', formatCurrency(revenue.total));
    setText(
      'stat-revenue-interval',
      `Last 30 days: ${formatCurrency(revenue.last30Days || 0)} (${revenue.paymentsLast30 || 0} payments)`
    );
    setText('stat-open-tickets', tickets.open || 0);
    setText('stat-total-tickets', `Total tickets: ${tickets.total || 0}`);
    setText('stat-project-completion', `${projects.completionRate || 0}%`);
    setText('stat-active-projects', `Active projects: ${projects.active || 0}`);
    setText('stat-upcoming-bookings', bookings.upcoming || 0);
    setText('stat-cancelled-bookings', `Cancelled bookings: ${bookings.cancelled || 0}`);

    setText('project-running-count', projects.active || 0);
    setText('project-completed-count', projects.completed || 0);
    setText('project-pending-count', projects.pending || 0);

    setText('recent-bookings-updated', `Updated ${formatDateTime(new Date())}`);
    setText('recent-bookings-count', (data.recentBookings || []).length || 0);
    setText('notifications-count', (data.notifications || []).length || 0);

    setText('recent-payments-count', revenue.paymentsLast30 || 0);

    const lastPayment = data.recentPayments && data.recentPayments[0];
    setText('last-payment-amount', lastPayment ? formatCurrency(lastPayment.amount) : '$0.00');
    setText('last-payment-status', lastPayment ? (lastPayment.status || '--') : '--');
    setText('last-payment-date', lastPayment ? formatDateTime(lastPayment.created_at) : '--');

    const bookingsList = document.getElementById('recent-bookings-list');
    replaceListItems(
      bookingsList,
      data.recentBookings || [],
      renderBookingItem,
      'No bookings recorded yet.'
    );

    const clientsList = document.getElementById('top-clients-list');
    replaceListItems(
      clientsList,
      data.topClients || [],
      renderClientItem,
      'No clients available.'
    );

    const notificationsList = document.getElementById('notifications-list');
    clearPlaceholders(notificationsList);
    replaceListItems(notificationsList, data.notifications || [], renderNotificationItem, 'No notifications yet.');

    const activityList = document.getElementById('activity-log');
    clearPlaceholders(activityList);
    replaceListItems(
      activityList,
      data.activity || [],
      renderActivityItem,
      'Nothing has been logged yet.'
    );
  }

  function showError() {
    setText('stat-total-revenue', '--');
    setText('stat-revenue-interval', 'Unable to load');
    setText('stat-open-tickets', '--');
    setText('stat-total-tickets', 'Total tickets: --');
    setText('stat-project-completion', '--');
    setText('stat-active-projects', 'Active projects: --');
    setText('stat-upcoming-bookings', '--');
    setText('stat-cancelled-bookings', 'Cancelled bookings: --');

    const bookingsList = document.getElementById('recent-bookings-list');
    replaceListItems(bookingsList, [], () => document.createElement('li'), 'Unable to load bookings');

    const clientsList = document.getElementById('top-clients-list');
    replaceListItems(clientsList, [], () => document.createElement('li'), 'Unable to load clients');

    const notificationsList = document.getElementById('notifications-list');
    replaceListItems(notificationsList, [], () => document.createElement('li'), 'Unable to load notifications');

    const activityList = document.getElementById('activity-log');
    replaceListItems(activityList, [], () => document.createElement('li'), 'Unable to load activity');
  }

  function fetchDashboard() {
    fetch('/api/dashboard/summary', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load dashboard data');
        return response.json();
      })
      .then(applyDashboardData)
      .catch(showError);
  }

  function init() {
    if (!document.getElementById('recent-bookings-list')) return;
    fetchDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
