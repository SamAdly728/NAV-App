/* eslint-disable no-console */
(function () {
  const cardsContainer = document.getElementById('project-cards-container');
  if (!cardsContainer) return;

  const loadingState = document.getElementById('project-loading');
  const emptyState = document.getElementById('project-empty-state');
  const feedbackAlert = document.getElementById('project-feedback');
  const feedbackMessage = document.getElementById('project-feedback-message');
  const filterTabs = Array.from(document.querySelectorAll('#project-filter-tabs .tab-link'));
  const createForm = document.getElementById('project-create-form');
  const submitButton = document.getElementById('project-submit-btn');
  const submitSpinner = submitButton ? submitButton.querySelector('.spinner-border') : null;
  const submitLabel = submitButton ? submitButton.querySelector('.default-label') : null;

  const API_ENDPOINT = '/api/projects';
  const state = {
    projects: [],
    activeFilter: 'all',
    feedbackTimer: null
  };

  init();

  function init() {
    bindFilters();
    bindCreateForm();
    fetchProjects();
  }

  function bindFilters() {
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', (event) => {
        event.preventDefault();
        const filter = tab.dataset.filter || 'all';
        if (state.activeFilter === filter) return;
        filterTabs.forEach((item) => item.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilter = filter;
        renderProjects();
      });
    });
  }

  function bindCreateForm() {
    if (!createForm || !submitButton) return;

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!createForm.checkValidity()) {
        createForm.classList.add('was-validated');
        return;
      }

      const payload = buildCreatePayload();
      if (!payload) return;

      setSubmitState(true);
      hideFeedback();

      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorBody = await safeJson(response);
          const message = errorBody?.error || `Unable to create project (${response.status})`;
          throw new Error(message);
        }

        const project = await response.json();
        if (project && typeof project === 'object') {
          state.projects = [project, ...state.projects];
          renderProjects();
          showFeedback('success', 'Project created successfully.');
        }

        resetForm();
        closeModal('projectCard');
      } catch (error) {
        console.error('Failed to create project', error);
        showFeedback('error', error.message || 'Unable to create project.');
      } finally {
        setSubmitState(false);
      }
    });
  }

  function buildCreatePayload() {
    const name = createForm.projectName?.value?.trim();
    const bookingId = createForm.shootBookingId?.value?.trim();
    const status = createForm.projectStatus?.value?.trim() || 'in_preproduction';
    const progressValue = createForm.projectProgress?.value?.trim();
    const startedAt = createForm.projectStart?.value?.trim();
    const deliveredAt = createForm.projectEnd?.value?.trim();
    const thumbnailUrl = createForm.projectThumbnail?.value?.trim();
    const notes = createForm.projectNotes?.value?.trim();

    if (!name || !bookingId) {
      return null;
    }

    const payload = {
      name,
      shoot_booking_id: Number(bookingId),
      status
    };

    if (progressValue !== '') {
      const parsedProgress = Number(progressValue);
      if (Number.isFinite(parsedProgress)) {
        payload.progress = parsedProgress;
      }
    }

    if (startedAt) payload.started_at = startedAt;
    if (deliveredAt) payload.delivered_at = deliveredAt;
    if (thumbnailUrl) payload.thumbnail_url = thumbnailUrl;
    if (notes) payload.notes = notes;

    return payload;
  }

  async function fetchProjects() {
    showLoading(true);
    hideFeedback();
    setCardsVisible(false);
    showEmpty(false);

    try {
      const response = await fetch(API_ENDPOINT, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Unable to load projects (${response.status})`);
      }

      const data = await safeJson(response);
      state.projects = Array.isArray(data) ? data : [];
      renderProjects();
    } catch (error) {
      console.error('Failed to load projects', error);
      showFeedback('error', error.message || 'Unable to load projects.');
    } finally {
      showLoading(false);
      updateEmptyState();
    }
  }

  function renderProjects() {
    const projects = getFilteredProjects();

    if (!projects.length) {
      cardsContainer.innerHTML = '';
      setCardsVisible(false);
      updateEmptyState();
      return;
    }

    const fragment = document.createDocumentFragment();
    projects.forEach((project) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'col-md-6 col-xl-4 project-card';
      wrapper.dataset.projectId = String(project.id);
      wrapper.dataset.status = project.status || '';
      wrapper.dataset.category = project.status_category || '';
      wrapper.innerHTML = buildProjectCardHtml(project);
      fragment.appendChild(wrapper);
    });

    cardsContainer.innerHTML = '';
    cardsContainer.appendChild(fragment);
    setCardsVisible(true);
    updateEmptyState();
    attachCardEvents();
    initTooltips();
  }

  function buildProjectCardHtml(project) {
    const progress = clampNumber(project.progress ?? 0, 0, 100);
    const progressClass = progressColor(progress);
    const statusClass = statusBadgeClass(project.status);
    const booking = project.shoot_booking || {};
    const members = Array.isArray(project.members) ? project.members : [];

    return `
      <div class="card hover-effect h-100">
        <div class="card-header border-0 pb-0">
          <div class="d-flex align-items-start gap-3">
            ${renderThumbnail(project)}
            <div class="flex-grow-1">
              <div class="d-flex align-items-start justify-content-between gap-2">
                <a class="text-dark f-w-600 text-decoration-none" href="project_details.html" target="_blank">${escapeHtml(project.name || 'Untitled Project')}</a>
                <div class="dropdown">
                  <button class="bg-none border-0 text-dark" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="ti ti-dots-vertical"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                      <button class="dropdown-item text-danger project-delete-btn" data-project-id="${project.id}" type="button">
                        <i class="ti ti-trash me-2"></i>Delete
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <span class="badge text-light-${statusClass} mt-2">${escapeHtml(project.status_label || formatStatus(project.status))}</span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
            <div>
              <p class="text-muted f-s-14 mb-1">Start Date</p>
              <h6 class="mb-0 text-dark">${formatDate(project.started_at) || 'TBD'}</h6>
            </div>
            <div class="text-end">
              <p class="text-muted f-s-14 mb-1">Delivery</p>
              <h6 class="mb-0 text-dark">${formatDate(project.delivered_at) || 'TBD'}</h6>
            </div>
          </div>
          <p class="text-secondary f-s-14 mb-3">${escapeHtml(project.notes || 'No notes added yet.')}</p>
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <span class="text-muted f-s-14">Progress</span>
              <span class="f-w-600">${progress}%</span>
            </div>
            <div class="progress w-100" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar bg-${progressClass}" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>
        <div class="card-footer border-0 pt-0">
          <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div>
              <span class="text-muted d-block f-s-14">Booking</span>
              <span class="text-dark f-w-600 d-block">${formatCurrency(booking.total_amount)}</span>
              <span class="text-muted f-s-12">${formatBookingRange(booking.scheduled_start, booking.scheduled_end)}</span>
            </div>
            <div class="text-end">
              ${renderMembers(members)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderThumbnail(project) {
    if (project.thumbnail_url) {
      return `
        <span class="h-45 w-45 d-flex-center b-r-10 overflow-hidden flex-shrink-0 bg-light-primary">
          <img class="img-fluid" src="${escapeAttribute(project.thumbnail_url)}" alt="${escapeAttribute(project.name || 'Project thumbnail')}">
        </span>
      `;
    }

    const initials = getInitials(project.name);
    return `
      <span class="h-45 w-45 d-flex-center b-r-10 overflow-hidden flex-shrink-0 bg-light-primary text-primary f-w-600 text-uppercase">
        ${escapeHtml(initials)}
      </span>
    `;
  }

  function renderMembers(members) {
    if (!members.length) {
      return '<span class="text-muted f-s-14">No team assigned</span>';
    }

    const maxVisible = 3;
    const visibleMembers = members.slice(0, maxVisible);
    const remaining = members.length - visibleMembers.length;

    const avatars = visibleMembers.map((member) => {
      if (member.avatar_url) {
        return `
          <li class="h-30 w-30 d-flex-center b-r-50 text-bg-primary b-2-light position-relative" data-bs-toggle="tooltip" title="${escapeAttribute(member.email || 'Team Member')}">
            <img alt="${escapeAttribute(member.email || 'Team Member')}" class="img-fluid b-r-50 overflow-hidden" src="${escapeAttribute(member.avatar_url)}">
          </li>
        `;
      }

      const initials = getInitials(member.email || '') || 'TM';
      return `
        <li class="h-30 w-30 d-flex-center b-r-50 text-bg-light b-2-light position-relative" data-bs-toggle="tooltip" title="${escapeAttribute(member.email || 'Team Member')}">
          <span class="text-dark f-w-600">${escapeHtml(initials)}</span>
        </li>
      `;
    });

    if (remaining > 0) {
      avatars.push(`
        <li class="text-bg-primary h-30 w-30 d-flex-center b-r-50" data-bs-toggle="tooltip" title="${remaining} more">
          +${remaining}
        </li>
      `);
    }

    return `<ul class="avatar-group breadcrumb-start mb-0">${avatars.join('')}</ul>`;
  }

  function attachCardEvents() {
    cardsContainer.querySelectorAll('.project-delete-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const projectId = Number(button.dataset.projectId);
        if (!Number.isFinite(projectId)) return;

        const confirmed = window.confirm('Are you sure you want to delete this project?');
        if (!confirmed) return;

        try {
          const response = await fetch(`${API_ENDPOINT}/${projectId}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!response.ok) {
            const body = await safeJson(response);
            const message = body?.error || `Failed to delete project (${response.status})`;
            throw new Error(message);
          }

          state.projects = state.projects.filter((project) => project.id !== projectId);
          renderProjects();
          showFeedback('success', 'Project deleted successfully.');
        } catch (error) {
          console.error('Delete failed', error);
          showFeedback('error', error.message || 'Unable to delete project.');
        }
      });
    });
  }

  function getFilteredProjects() {
    switch (state.activeFilter) {
      case 'designing':
        return state.projects.filter((project) => project.status_category === 'designing');
      case 'development':
        return state.projects.filter((project) => project.status_category === 'development');
      case 'completed':
        return state.projects.filter((project) => project.status === 'completed');
      case 'archived':
        return state.projects.filter((project) => project.status === 'archived');
      case 'all':
      default:
        return [...state.projects];
    }
  }

  function updateEmptyState() {
    const hasProjects = Boolean(cardsContainer.children.length);
    const isLoading = loadingState ? !loadingState.classList.contains('d-none') : false;
    showEmpty(!hasProjects && !isLoading);
  }

  function setCardsVisible(visible) {
    cardsContainer.classList.toggle('d-none', !visible);
  }

  function showLoading(show) {
    if (!loadingState) return;
    loadingState.classList.toggle('d-none', !show);
  }

  function showEmpty(show) {
    if (!emptyState) return;
    emptyState.classList.toggle('d-none', !show);
  }

  function showFeedback(type, message) {
    if (!feedbackAlert) return;

    clearFeedbackTimer();
    feedbackAlert.classList.remove('d-none', 'alert-danger', 'alert-success');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
    feedbackAlert.classList.add(alertClass);

    if (feedbackMessage) {
      feedbackMessage.textContent = message;
    }

    if (type === 'success') {
      state.feedbackTimer = window.setTimeout(() => {
        hideFeedback();
      }, 4000);
    }
  }

  function hideFeedback() {
    if (!feedbackAlert) return;
    clearFeedbackTimer();
    feedbackAlert.classList.add('d-none');
  }

  function clearFeedbackTimer() {
    if (state.feedbackTimer) {
      window.clearTimeout(state.feedbackTimer);
      state.feedbackTimer = null;
    }
  }

  function setSubmitState(isSubmitting) {
    if (!submitButton) return;
    submitButton.disabled = isSubmitting;
    if (submitSpinner) submitSpinner.classList.toggle('d-none', !isSubmitting);
    if (submitLabel) submitLabel.textContent = isSubmitting ? 'Saving…' : 'Create Project';
  }

  function resetForm() {
    if (!createForm) return;
    createForm.reset();
    createForm.classList.remove('was-validated');
  }

  function closeModal(id) {
    const modalElement = document.getElementById(id);
    if (!modalElement) return;
    const instance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    instance.hide();
  }

  function safeJson(response) {
    return response
      .text()
      .then((text) => (text ? JSON.parse(text) : null))
      .catch(() => null);
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  function progressColor(progress) {
    if (progress >= 75) return 'success';
    if (progress >= 35) return 'primary';
    if (progress > 0) return 'warning';
    return 'secondary';
  }

  function statusBadgeClass(status) {
    switch (status) {
      case 'completed':
        return 'success';
      case 'archived':
        return 'secondary';
      case 'pending_review':
        return 'warning';
      case 'in_production':
        return 'primary';
      case 'in_postproduction':
        return 'info';
      default:
        return 'primary';
    }
  }

  function formatStatus(status) {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatBookingRange(start, end) {
    const startFormatted = formatDate(start);
    const endFormatted = formatDate(end);
    if (startFormatted && endFormatted) return `${startFormatted} – ${endFormatted}`;
    if (startFormatted) return startFormatted;
    if (endFormatted) return endFormatted;
    return 'Schedule pending';
  }

  function formatCurrency(value) {
    if (!Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(Number(value));
  }

  function getInitials(text) {
    if (!text) return 'PR';
    const words = text.trim().split(/\s+/).slice(0, 2);
    return words.map((word) => word.charAt(0).toUpperCase()).join('');
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

  function initTooltips() {
    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
    const tooltipTriggers = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggers.forEach((element) => {
      const existing = bootstrap.Tooltip.getInstance(element);
      if (existing) {
        existing.dispose();
      }
      new bootstrap.Tooltip(element);
    });
  }
})();
/* eslint-enable no-console */
