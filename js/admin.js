/**
 * Cascade Apartment 3 - Admin Panel JavaScript
 * Handles: Dashboard interactions, property management,
 * booking management, and admin-specific UI
 */

(function() {
  'use strict';

  const Admin = {
    /**
     * Initialize admin panel
     */
    init() {
      // Apply authenticated session to topbar (auth.js handles redirect if not logged in)
      if (window.CA3Auth) { CA3Auth.requireAuth(); }
      this.initSidebar();
      this.initDashboardStats();
      this.initPropertyManagement();
      this.initBookingManagement();
      this.initCalendarView();
      this.initSettingsForm();
      this.initDataTables();
      this.highlightActiveSidebarLink();
    },

    /**
     * Sidebar toggle for mobile
     */
    initSidebar() {
      const toggle = document.querySelector('.sidebar-toggle');
      const sidebar = document.querySelector('.admin-sidebar');

      if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
          sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
          if (window.innerWidth <= 992 &&
              sidebar.classList.contains('open') &&
              !sidebar.contains(e.target) &&
              !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
          }
        });
      }
    },

    /**
     * Highlight active sidebar link based on current page
     */
    highlightActiveSidebarLink() {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';

      document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href && href.includes(currentPage)) {
          link.classList.add('active');
        }
      });
    },

    /**
     * Dashboard stats animation
     */
    initDashboardStats() {
      const statValues = document.querySelectorAll('.stat-value');

      statValues.forEach(el => {
        const finalValue = el.textContent;
        const isNumeric = /^[\$\d,\.%]+$/.test(finalValue.trim());

        if (isNumeric) {
          const numericValue = parseFloat(finalValue.replace(/[\$,%]/g, ''));
          const prefix = finalValue.startsWith('$') ? '$' : '';
          const suffix = finalValue.endsWith('%') ? '%' : '';
          const hasCommas = finalValue.includes(',');

          let current = 0;
          const increment = numericValue / 40;
          const timer = setInterval(() => {
            current += increment;
            if (current >= numericValue) {
              el.textContent = finalValue;
              clearInterval(timer);
            } else {
              let display = Math.floor(current);
              if (hasCommas) {
                display = display.toLocaleString();
              }
              el.textContent = `${prefix}${display}${suffix}`;
            }
          }, 30);
        }
      });
    },

    /**
     * Property management actions
     */
    initPropertyManagement() {
      // Toggle property status
      document.querySelectorAll('[data-toggle-status]').forEach(btn => {
        btn.addEventListener('click', () => {
          const propertyId = btn.dataset.toggleStatus;
          const currentStatus = btn.textContent.trim().toLowerCase();
          const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

          btn.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
          btn.className = `badge badge--${newStatus === 'active' ? 'success' : 'warning'}`;

          window.CascadeApp?.showToast(
            `Property ${newStatus === 'active' ? 'activated' : 'deactivated'}`,
            newStatus === 'active' ? 'success' : 'warning'
          );
        });
      });

      // Delete property
      document.querySelectorAll('[data-delete-property]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
            const row = btn.closest('tr');
            if (row) {
              row.style.opacity = '0';
              row.style.transition = 'opacity 0.3s ease';
              setTimeout(() => row.remove(), 300);
            }
            window.CascadeApp?.showToast('Property deleted', 'info');
          }
        });
      });

      // Property form tabs
      this.initFormTabs();
    },

    /**
     * Form tabs (for property edit)
     */
    initFormTabs() {
      document.querySelectorAll('.tabs').forEach(tabContainer => {
        const tabs = tabContainer.querySelectorAll('.tab');
        const parent = tabContainer.closest('.admin-card') || tabContainer.parentElement;

        tabs.forEach(tab => {
          tab.addEventListener('click', (e) => {
            e.preventDefault();

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetId = tab.dataset.tab;
            if (targetId && parent) {
              parent.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
              });
              const target = parent.querySelector(`#${targetId}`);
              if (target) target.classList.add('active');
            }
          });
        });
      });
    },

    /**
     * Booking management
     */
    initBookingManagement() {
      // Status filter buttons
      document.querySelectorAll('[data-filter-status]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-filter-status]').forEach(b => {
            b.classList.remove('btn--primary');
            b.classList.add('btn--ghost');
          });
          btn.classList.remove('btn--ghost');
          btn.classList.add('btn--primary');

          const status = btn.dataset.filterStatus;
          this.filterBookings(status);
        });
      });

      // Booking status change
      document.querySelectorAll('[data-booking-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.bookingAction;
          const bookingId = btn.dataset.bookingId;

          switch (action) {
            case 'confirm':
              this.updateBookingStatus(bookingId, 'confirmed');
              break;
            case 'cancel':
              if (confirm('Are you sure you want to cancel this booking?')) {
                this.updateBookingStatus(bookingId, 'cancelled');
              }
              break;
            case 'check-in':
              this.updateBookingStatus(bookingId, 'checked-in');
              break;
            case 'check-out':
              this.updateBookingStatus(bookingId, 'checked-out');
              break;
          }
        });
      });
    },

    /**
     * Filter bookings by status
     */
    filterBookings(status) {
      document.querySelectorAll('tr[data-status]').forEach(row => {
        if (status === 'all' || row.dataset.status === status) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    },

    /**
     * Update booking status
     */
    updateBookingStatus(bookingId, newStatus) {
      const row = document.querySelector(`tr[data-booking-id="${bookingId}"]`);
      if (row) {
        const badge = row.querySelector('.badge');
        if (badge) {
          badge.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
          badge.className = 'badge';

          const statusClasses = {
            'confirmed': 'badge--success',
            'pending': 'badge--warning',
            'cancelled': 'badge--danger',
            'checked-in': 'badge--info',
            'checked-out': 'badge--primary'
          };

          badge.classList.add(statusClasses[newStatus] || 'badge--primary');
        }
        row.dataset.status = newStatus;
      }

      window.CascadeApp?.showToast(`Booking ${newStatus}`, 'success');
    },

    /**
     * Admin calendar view
     */
    initCalendarView() {
      const calendarContainer = document.querySelector('.admin-calendar .calendar-grid');
      if (!calendarContainer) return;

      // Calendar navigation
      document.querySelectorAll('.calendar-nav button, .calendar-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'prev' || action === 'next') {
            // In a full implementation, this would re-render the calendar
            window.CascadeApp?.showToast(`Navigating ${action}`, 'info');
          }
        });
      });

      // Day click in admin calendar
      calendarContainer.querySelectorAll('.calendar-day').forEach(day => {
        day.addEventListener('click', () => {
          const date = day.dataset.date || day.querySelector('.day-number')?.textContent;
          if (date) {
            // Could open a modal to add/edit bookings for this day
            console.log('Admin calendar day clicked:', date);
          }
        });
      });
    },

    /**
     * Settings form save
     */
    initSettingsForm() {
      const saveBtns = document.querySelectorAll('[data-save-settings]');
      saveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          window.CascadeApp?.showToast('Settings saved successfully', 'success');
        });
      });

      // Toggle switches
      document.querySelectorAll('.toggle input').forEach(toggle => {
        toggle.addEventListener('change', () => {
          const label = toggle.closest('.settings-row')?.querySelector('h4')?.textContent;
          console.log(`Setting ${label} changed to ${toggle.checked}`);
        });
      });
    },

    /**
     * Initialize sortable/searchable tables
     */
    initDataTables() {
      // Table search
      document.querySelectorAll('[data-table-search]').forEach(input => {
        const tableId = input.dataset.tableSearch;
        const table = document.getElementById(tableId);
        if (!table) return;

        input.addEventListener('input', () => {
          const query = input.value.toLowerCase();
          table.querySelectorAll('tbody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
          });
        });
      });

      // Table sort headers
      document.querySelectorAll('th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          const table = th.closest('table');
          const column = th.dataset.sort;
          const colIndex = Array.from(th.parentElement.children).indexOf(th);
          const tbody = table.querySelector('tbody');
          const rows = Array.from(tbody.querySelectorAll('tr'));

          const isAsc = th.classList.contains('sort-asc');
          table.querySelectorAll('th').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
          });
          th.classList.add(isAsc ? 'sort-desc' : 'sort-asc');

          rows.sort((a, b) => {
            const aVal = a.children[colIndex]?.textContent.trim() || '';
            const bVal = b.children[colIndex]?.textContent.trim() || '';

            // Try numeric sort first
            const aNum = parseFloat(aVal.replace(/[\$,]/g, ''));
            const bNum = parseFloat(bVal.replace(/[\$,]/g, ''));

            if (!isNaN(aNum) && !isNaN(bNum)) {
              return isAsc ? bNum - aNum : aNum - bNum;
            }

            return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
          });

          rows.forEach(row => tbody.appendChild(row));
        });
      });
    },

    /**
     * Export data as CSV
     */
    exportCSV(tableId, filename) {
      const table = document.getElementById(tableId);
      if (!table) return;

      const rows = Array.from(table.querySelectorAll('tr'));
      const csv = rows.map(row => {
        return Array.from(row.querySelectorAll('th, td'))
          .map(cell => `"${cell.textContent.trim().replace(/"/g, '""')}"`)
          .join(',');
      }).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      window.CascadeApp?.showToast('Data exported successfully', 'success');
    }
  };

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Admin.init());
  } else {
    Admin.init();
  }

  window.CascadeApp = window.CascadeApp || {};
  window.CascadeApp.Admin = Admin;
})();

/* ── Admin notification badges ──────────────────────────────────────────────
 * Shows a green pulsing dot on sidebar nav items when there is unseen
 * activity: new confirmed bookings (bookings.html) or new enquiry emails
 * (emails.html).
 *
 * localStorage keys:
 *   ca3_bookings_seen_at    — ISO timestamp; updated when admin visits bookings.html
 *   ca3_emails_seen_count   — integer; updated when admin visits emails.html
 * sessionStorage key:
 *   ca3_emails_api_cache    — { count, ts } JSON; caches /api/emails for 5 min
 * ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var BOOKINGS_SEEN_KEY = 'ca3_bookings_seen_at';
  var EMAILS_SEEN_KEY   = 'ca3_emails_seen_count';
  var EMAILS_CACHE_KEY  = 'ca3_emails_api_cache';
  var EMAILS_CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

  var currentPage = window.location.pathname.split('/').pop() || 'index.html';

  /* Find a sidebar nav link by href substring */
  function findNavLink(hrefFragment) {
    return document.querySelector('.admin-sidebar a[href*="' + hrefFragment + '"]');
  }

  /* Append a green dot to a nav link (idempotent) */
  function addDot(link) {
    if (!link || link.querySelector('.nav-notify-dot')) return;
    var dot = document.createElement('span');
    dot.className = 'nav-notify-dot';
    link.appendChild(dot);
  }

  /* ── Booking badge ──────────────────────────────────────────────────────── */
  function applyBookingBadge() {
    if (!window.CA3Data) return;
    var seenTs = new Date(localStorage.getItem(BOOKINGS_SEEN_KEY) || 0).getTime();
    var hasNew = window.CA3Data.getBookings().some(function (b) {
      if (b.status === 'cancelled' || b.status === 'pending') return false;
      var ts = new Date(b.confirmedAt || b.createdAt || 0).getTime();
      return ts > seenTs;
    });
    if (hasNew) addDot(findNavLink('bookings.html'));
  }

  /* When admin opens the bookings page, mark all as seen */
  if (currentPage === 'bookings.html') {
    localStorage.setItem(BOOKINGS_SEEN_KEY, new Date().toISOString());
  }

  /* ── Email badge ────────────────────────────────────────────────────────── */
  function applyEmailBadge() {
    var seenCount = parseInt(localStorage.getItem(EMAILS_SEEN_KEY) || '0', 10);

    /* Try sessionStorage cache first */
    try {
      var cached = JSON.parse(sessionStorage.getItem(EMAILS_CACHE_KEY) || 'null');
      if (cached && (Date.now() - cached.ts) < EMAILS_CACHE_TTL) {
        if (cached.count > seenCount) addDot(findNavLink('emails.html'));
        return;
      }
    } catch (_) {}

    /* Fetch fresh count from API */
    fetch('/api/emails')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var count = Array.isArray(data.contacts) ? data.contacts.length : 0;
        sessionStorage.setItem(EMAILS_CACHE_KEY, JSON.stringify({ count: count, ts: Date.now() }));
        if (count > seenCount) addDot(findNavLink('emails.html'));
      })
      .catch(function () { /* fail silently — Resend may not be configured */ });
  }

  /* ── Public API (used by emails.html after loading enquiries) ───────────── */
  window.CA3Notify = {
    markEmailsSeen: function (count) {
      localStorage.setItem(EMAILS_SEEN_KEY, String(count));
      sessionStorage.setItem(EMAILS_CACHE_KEY, JSON.stringify({ count: count, ts: Date.now() }));
    },
  };

  /* ── Apply badges on DOMContentLoaded ───────────────────────────────────── */
  function applyBadges() {
    applyBookingBadge();
    if (currentPage !== 'emails.html') applyEmailBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBadges);
  } else {
    applyBadges();
  }
})();
