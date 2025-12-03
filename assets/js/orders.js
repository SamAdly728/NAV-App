/* eslint-disable no-console */
(function () {
  const tableBody = document.getElementById('orders-table-body');
  if (!tableBody) return;

  const tableWrapper = document.getElementById('orders-table-wrapper');
  const loadingEl = document.getElementById('orders-loading');
  const emptyEl = document.getElementById('orders-empty');
  const feedbackEl = document.getElementById('orders-feedback');
  const feedbackMessageEl = document.getElementById('orders-feedback-message');
  const filterButtons = Array.from(document.querySelectorAll('[data-orders-filter]'));
  const searchInput = document.getElementById('orders-search');
  const refreshButton = document.getElementById('orders-refresh-btn');
  const selectAllCheckbox = document.getElementById('orders-select-all');

  const API_ENDPOINT = '/api/orders';
  const FILTER_STATUS_PARAMS = {
    delivered: 'delivered',
    cancelled: 'cancelled',
    returns: 'returned'
  };

  const state = {
    orders: [],
    filter: 'all',
    search: '',
    pagination: { total: 0, limit: 0, offset: 0 }
  };

  let searchTimeout = null;

  init();

  function init() {
    bindFilters();
    bindSearch();
    bindRefresh();
    bindSelectAll();
    fetchOrders();
  }

  function bindFilters() {
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.ordersFilter || 'all';
        if (state.filter === filter) return;
        state.filter = filter;
        updateFilterButtons();
        fetchOrders();
      });
    });
  }

  function bindSearch() {
    if (!searchInput) return;
    searchInput.addEventListener('input', () => {
      const value = (searchInput.value || '').trim();
      state.search = value;
      if (searchTimeout) window.clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        fetchOrders();
      }, 300);
    });
  }

  function bindRefresh() {
    if (!refreshButton) return;
    refreshButton.addEventListener('click', () => {
      fetchOrders();
    });
  }

  function bindSelectAll() {
    if (!selectAllCheckbox) return;
    selectAllCheckbox.addEventListener('change', () => {
      const checked = selectAllCheckbox.checked;
      tableBody.querySelectorAll('.order-row-select').forEach((input) => {
        input.checked = checked;
      });
    });
  }

  function updateFilterButtons() {
    filterButtons.forEach((button) => {
      const filter = button.dataset.ordersFilter || 'all';
      const isActive = filter === state.filter;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  async function fetchOrders() {
    showLoading(true);
    setTableVisible(false);
    showEmpty(false);
    hideFeedback();
    selectAllUnchecked();

    const params = new URLSearchParams();
    const serverStatus = FILTER_STATUS_PARAMS[state.filter];
    if (serverStatus) params.set('status', serverStatus);
    if (state.search) params.set('search', state.search);

    const url = params.toString() ? `${API_ENDPOINT}?${params.toString()}` : API_ENDPOINT;

    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Unable to load orders (${response.status})`);
      }

      const payload = await safeJson(response);
      const orders = Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload) ? payload : [];
      state.orders = orders;
      state.pagination = {
        total: payload?.total || orders.length,
        limit: payload?.limit || orders.length,
        offset: payload?.offset || 0
      };
      renderOrders();
    } catch (error) {
      console.error('Failed to load orders', error);
      showFeedback('error', error.message || 'Unable to load orders.');
      state.orders = [];
      renderOrders();
    } finally {
      showLoading(false);
    }
  }

  function renderOrders() {
    const predicate = buildFilterPredicate(state.filter);
    const searchTerm = (state.search || '').trim().toLowerCase();

    const filtered = state.orders.filter((order) => {
      return predicate(order) && matchesSearch(order, searchTerm);
    });

    if (!filtered.length) {
      tableBody.innerHTML = '';
      setTableVisible(false);
      showEmpty(true);
      return;
    }

    const rows = filtered.map((order) => buildOrderRow(order));
    tableBody.innerHTML = rows.join('');
    attachRowEvents();
    setTableVisible(true);
    showEmpty(false);
    selectAllUnchecked();
  }

  function buildFilterPredicate(filter) {
    switch (filter) {
      case 'delivered':
        return (order) => order.status === 'delivered';
      case 'cancelled':
        return (order) => order.status === 'cancelled';
      case 'returns':
        return (order) => order.status === 'returned';
      case 'pickups':
        return (order) => ['pending', 'scheduled', 'in_progress', 'confirmed'].includes(order.status);
      case 'all':
      default:
        return (order) => order.status !== 'archived';
    }
  }

  function matchesSearch(order, term) {
    if (!term) return true;
    const haystack = [
      order.reference || '',
      order.customer?.name || '',
      order.customer?.company || '',
      order.customer?.email || '',
      order.product?.name || ''
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  }

  function attachRowEvents() {
    tableBody.querySelectorAll('.order-delete-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const orderId = Number(button.dataset.orderId);
        if (!Number.isFinite(orderId)) return;
        const confirmed = window.confirm('Are you sure you want to archive this order?');
        if (!confirmed) return;
        await deleteOrder(orderId);
      });
    });

    tableBody.querySelectorAll('.order-row-select').forEach((checkbox) => {
      checkbox.addEventListener('change', updateSelectAllState);
    });
  }

  async function deleteOrder(orderId) {
    hideFeedback();
    try {
      const response = await fetch(`${API_ENDPOINT}/${orderId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok && response.status !== 204) {
        const body = await safeJson(response);
        throw new Error(body?.error || `Unable to delete order (${response.status})`);
      }
      state.orders = state.orders.filter((order) => order.id !== orderId);
      renderOrders();
      showFeedback('success', 'Order archived successfully.');
    } catch (error) {
      console.error('Failed to delete order', error);
      showFeedback('error', error.message || 'Unable to archive order.');
    }
  }

  function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const rowCheckboxes = Array.from(tableBody.querySelectorAll('.order-row-select'));
    if (!rowCheckboxes.length) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }
    const checkedCount = rowCheckboxes.filter((input) => input.checked).length;
    selectAllCheckbox.checked = checkedCount === rowCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
  }

  function selectAllUnchecked() {
    if (!selectAllCheckbox) return;
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }

  function showLoading(show) {
    if (!loadingEl) return;
    loadingEl.classList.toggle('d-none', !show);
  }

  function setTableVisible(visible) {
    if (!tableWrapper) return;
    tableWrapper.classList.toggle('d-none', !visible);
  }

  function showEmpty(show) {
    if (!emptyEl) return;
    emptyEl.classList.toggle('d-none', !show);
  }

  function showFeedback(type, message) {
    if (!feedbackEl) return;
    feedbackEl.classList.remove('d-none', 'alert-danger', 'alert-success');
    feedbackEl.classList.add(type === 'success' ? 'alert-success' : 'alert-danger');
    if (feedbackMessageEl) {
      feedbackMessageEl.textContent = message;
    }
    if (type === 'success') {
      window.setTimeout(() => {
        hideFeedback();
      }, 3000);
    }
  }

  function hideFeedback() {
    if (!feedbackEl) return;
    feedbackEl.classList.add('d-none');
  }

  function safeJson(response) {
    return response
      .text()
      .then((text) => (text ? JSON.parse(text) : null))
      .catch(() => null);
  }

  function buildOrderRow(order) {
    const statusBadge = statusBadgeClass(order.status);
    const paymentBadge = paymentBadgeClass(order.payment_status || order.latest_payment?.status);
    const reference = `#LA${String(order.id).padStart(4, '0')}`;

    return `
      <tr data-order-id="${order.id}">
        <td>
          <label class="check-box mb-0">
            <input class="order-row-select" type="checkbox">
            <span class="checkmark outline-secondary ms-2"></span>
          </label>
        </td>
        <td>${escapeHtml(order.reference || reference)}</td>
        <td class="d-flex align-items-center gap-2">
          ${renderCustomerAvatar(order.customer)}
          <div>
            <span class="title-text mb-0">${escapeHtml(order.customer?.name || order.customer?.company || 'Unknown')}</span>
            <p class="text-muted mb-0 f-s-12">${escapeHtml(order.customer?.company || order.customer?.email || '')}</p>
          </div>
        </td>
        <td>${escapeHtml(order.product?.name || '—')}</td>
        <td><span class="badge text-light-${statusBadge}">${escapeHtml(order.status_label || formatStatus(order.status))}</span></td>
        <td>${formatDate(order.created_at)}</td>
        <td>
          ${renderPaymentMeta(order)}
          ${order.payment_status || order.latest_payment ? `<span class="badge text-light-${paymentBadge} mt-1 d-inline-block">${escapeHtml(paymentStatusLabel(order))}</span>` : ''}
        </td>
        <td>${formatCurrency(order.total_amount)}</td>
        <td>
          <a class="btn btn-outline-primary icon-btn w-30 h-30 b-r-22 me-2" href="orders_details.html?orderId=${order.id}" role="button" target="_blank" rel="noopener">
            <i class="ti ti-eye"></i>
          </a>
          <button class="btn btn-outline-success icon-btn w-30 h-30 b-r-22 me-2" data-order-id="${order.id}" type="button" title="Edit order">
            <i class="ti ti-edit"></i>
          </button>
          <button class="btn btn-outline-danger icon-btn w-30 h-30 b-r-22 order-delete-btn" data-order-id="${order.id}" type="button" title="Archive order">
            <i class="ti ti-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  function renderCustomerAvatar(customer) {
    if (customer?.avatar_url) {
      return `
        <div class="h-25 w-25 d-flex-center b-r-50 overflow-hidden text-bg-primary">
          <img alt="${escapeAttribute(customer.name || customer.email || 'Customer')}" class="img-fluid" src="${escapeAttribute(customer.avatar_url)}">
        </div>
      `;
    }
    const initials = getInitials(customer?.name || customer?.company || customer?.email);
    return `
      <div class="h-25 w-25 d-flex-center b-r-50 overflow-hidden text-bg-secondary">
        <span class="text-uppercase text-white f-w-600">${escapeHtml(initials)}</span>
      </div>
    `;
  }

  function renderPaymentMeta(order) {
    const provider = order.latest_payment?.provider || order.payment_provider;
    if (!provider) return '<span class="text-muted">—</span>';
    return `<span class="text-muted">${escapeHtml(provider)}</span>`;
  }

  function paymentStatusLabel(order) {
    return order.payment_status_label || formatStatus(order.payment_status || order.latest_payment?.status || 'unknown');
  }

  function statusBadgeClass(status) {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'success';
      case 'cancelled':
      case 'archived':
        return 'danger';
      case 'returned':
        return 'warning';
      case 'in_progress':
      case 'confirmed':
        return 'primary';
      case 'scheduled':
      case 'pending':
        return 'info';
      default:
        return 'secondary';
    }
  }

  function paymentBadgeClass(status) {
    switch ((status || '').toLowerCase()) {
      case 'paid':
      case 'succeeded':
        return 'success';
      case 'partial':
      case 'pending':
        return 'warning';
      case 'refunded':
      case 'failed':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  function formatStatus(status) {
    if (!status) return 'Unknown';
    return String(status)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function getInitials(value) {
    if (!value) return 'CU';
    return value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'CU';
  }
})();
/* eslint-enable no-console */
