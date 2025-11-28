$(function () {
  $('.ticket-slider').slick({
    slidesToShow: 2,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 3
        }
      },
      {
        breakpoint: 576,
        settings: {
          slidesToShow: 1
        }
      }
    ]
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const tableEl = document.getElementById('ticketdatatable');
  if (!tableEl) return;

  const titleInput = document.getElementById('ticket-title');
  const clientSelect = document.getElementById('ticket-client');
  const prioritySelect = document.getElementById('ticket-priority');
  const statusSelect = document.getElementById('ticket-status');
  const descriptionInput = document.getElementById('ticket-description');
  const dueInput = document.getElementById('ticket-due');
  const categorySelect = document.getElementById('ticket-category');
  const assignedSelect = document.getElementById('ticket-assigned');
  const projectSelect = document.getElementById('ticket-project');
  const createButton = document.getElementById('ticketkey');
  const modalEl = document.getElementById('ticketModal');

  const ticketTable = $('#ticketdatatable').DataTable({
    ajax: {
      url: '/api/tickets',
      dataSrc: ''
    },
    order: [[6, 'desc']],
    columns: [
      {
        data: null,
        orderable: false,
        searchable: false,
        render: (_data, _type, row) => `
          <div class="checkbox-wrapper">
            <label class="check-box m-0">
              <input type="checkbox" data-ticket-id="${row.id}">
              <span class="checkmark outline-secondary"></span>
            </label>
          </div>
        `
      },
      {
        data: 'public_id',
        defaultContent: '--'
      },
      {
        data: null,
        render: (_data, _type, row) => renderClientCell(row)
      },
      {
        data: null,
        render: (_data, _type, row) => renderPriorityCell(row)
      },
      {
        data: 'title',
        defaultContent: '--',
        render: (data) => escapeHtml(data) || '--'
      },
      {
        data: null,
        render: (_data, _type, row) => renderStatusCell(row)
      },
      {
        data: 'created_at',
        render: (data) => formatDate(data)
      },
      {
        data: 'due_at',
        render: (data) => formatDate(data)
      },
      {
        data: null,
        orderable: false,
        searchable: false,
        render: (_data, _type, row) => renderActionsCell(row)
      }
    ]
  });

  loadMetadata();

  if (createButton) {
    createButton.addEventListener('click', handleCreateTicket);
  }

  $('#ticketdatatable tbody').on('click', '.delete-btn', async function (event) {
    event.preventDefault();
    const ticketId = $(this).data('id');
    if (!ticketId) return;
    const confirmed = window.confirm('Delete this ticket?');
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      ticketTable.ajax.reload(null, false);
    } catch (error) {
      console.error('Failed to delete ticket', error);
      alert(`Unable to delete ticket: ${error.message}`);
    }
  });

  $('#create_ticket_key').on('click', () => {
    resetForm();
    $('#ticketModal').modal('show');
  });

  if (modalEl) {
    modalEl.addEventListener('hidden.bs.modal', resetForm);
  }

  function resetForm() {
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (dueInput) dueInput.value = '';
    [clientSelect, prioritySelect, statusSelect, categorySelect, assignedSelect, projectSelect].forEach((select) => {
      if (select) select.selectedIndex = 0;
    });
  }

  async function loadMetadata() {
    try {
      const response = await fetch('/api/tickets/metadata', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
      const data = await response.json();
      populateSelect(clientSelect, data.clients || [], 'Select Client', (item) => String(item.id), (item) => item.company_name || 'Client');
      populateSelect(prioritySelect, data.priorities || [], 'Select Priority', (item) => String(item.id), (item) => toTitleCase(item.name));
      populateSelect(statusSelect, data.statuses || [], 'Select Status', (item) => String(item.id), (item) => item.label || toTitleCase(item.name));
      populateSelect(categorySelect, data.categories || [], 'Select Category', (item) => String(item.id), (item) => item.name);
      populateSelect(assignedSelect, data.assignees || [], 'Assign To', (item) => String(item.id), (item) => item.email || `User ${item.id}`);
      populateSelect(projectSelect, data.projects || [], 'Link Project (optional)', (item) => String(item.id), (item) => item.name || `Project ${item.id}`);
    } catch (error) {
      console.error('Failed to load ticket metadata', error);
    }
  }

  async function handleCreateTicket() {
    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) {
      alert('Title is required.');
      return;
    }

    const clientId = clientSelect ? clientSelect.value : '';
    if (!clientId) {
      alert('Client is required.');
      return;
    }

    const priorityId = prioritySelect ? prioritySelect.value : '';
    if (!priorityId) {
      alert('Priority is required.');
      return;
    }

    const statusId = statusSelect ? statusSelect.value : '';
    if (!statusId) {
      alert('Status is required.');
      return;
    }

    const payload = {
      title,
      client_id: Number.parseInt(clientId, 10),
      priority_id: Number.parseInt(priorityId, 10),
      status_id: Number.parseInt(statusId, 10),
      description: descriptionInput ? descriptionInput.value.trim() : '',
      due_date: dueInput && dueInput.value ? dueInput.value : null,
      category_id: categorySelect && categorySelect.value ? Number.parseInt(categorySelect.value, 10) : null,
      assigned_to_user_id: assignedSelect && assignedSelect.value ? Number.parseInt(assignedSelect.value, 10) : null,
      project_id: projectSelect && projectSelect.value ? Number.parseInt(projectSelect.value, 10) : null
    };

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      $('#ticketModal').modal('hide');
      resetForm();
      ticketTable.ajax.reload(null, false);
    } catch (error) {
      console.error('Failed to create ticket', error);
      alert(`Unable to create ticket: ${error.message}`);
    }
  }

  function renderClientCell(row) {
    const name = row.client_name || 'Client';
    const initial = getInitials(name);
    return `
      <div class="d-flex align-items-center">
        <div class="h-30 w-30 d-flex-center b-r-50 overflow-hidden text-bg-primary me-2">
          <span class="f-w-600 text-white">${escapeHtml(initial)}</span>
        </div>
        ${escapeHtml(name)}
      </div>
    `;
  }

  function renderPriorityCell(row) {
    const label = row.priority_name ? toTitleCase(row.priority_name) : 'Unknown';
    const badgeClass = row.priority_badge_class || 'text-outline-secondary';
    return `<span class="badge ${badgeClass}">${escapeHtml(label)}</span>`;
  }

  function renderStatusCell(row) {
    const label = row.status_label ? row.status_label : (row.status_name ? toTitleCase(row.status_name) : 'Unknown');
    const badgeClass = row.status_badge_class || 'text-outline-secondary';
    return `<span class="badge ${badgeClass}">${escapeHtml(label)}</span>`;
  }

  function renderActionsCell(row) {
    const ticketId = row.id;
    return `
      <div class="btn-group dropdown-icon-none">
        <button class="btn border-0 icon-btn b-r-4 dropdown-toggle active" type="button" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false">
          <i class="ti ti-dots-vertical"></i>
        </button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="./ticket_details.html?id=${encodeURIComponent(ticketId)}"><i class="ti ti-eye text-primary me-2"></i> View</a></li>
          <li><a class="dropdown-item delete-btn" href="#" data-id="${ticketId}"><i class="ti ti-trash text-danger me-2"></i> Delete</a></li>
        </ul>
      </div>
    `;
  }

  function populateSelect(select, items, placeholder, getValue, getLabel) {
    if (!select) return;
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholder;
    select.appendChild(defaultOption);

    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = getValue(item);
      option.textContent = getLabel(item);
      select.appendChild(option);
    });

    if (items.length === 1) {
      select.value = getValue(items[0]);
    }
  }

  function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '--';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getInitials(text) {
    if (!text) return 'NA';
    const parts = text.trim().split(/\s+/);
    const first = parts[0] ? parts[0][0] : '';
    const second = parts[1] ? parts[1][0] : (parts[0] ? parts[0][1] || '' : '');
    return (first + second).toUpperCase();
  }

  function toTitleCase(value) {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  function escapeHtml(value) {
    if (!value && value !== 0) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getErrorMessage(response) {
    try {
      const payload = await response.json();
      if (payload && payload.error) return payload.error;
      if (payload && payload.message) return payload.message;
    } catch (_err) {
      // ignore JSON parse errors
    }
    return response.statusText || 'Request failed';
  }
});


