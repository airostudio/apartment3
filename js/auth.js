/**
 * Cascade Apartment 3 — Client-side Authentication Module
 *
 * login()      → POST /api/admin-login  → sets HttpOnly ca3_session cookie
 * logout()     → POST /api/admin-logout → clears cookies
 * requireAuth()→ reads ca3_role cookie; falls back to GET /api/admin-check
 *
 * The ca3_role cookie (non-HttpOnly) is set by the server alongside the
 * HttpOnly ca3_session token so the client can read the role without
 * ever touching the actual auth token.
 *
 * Roles:
 *   admin  — Full access: all pages, rates, settings, iCal, properties
 *   owner  — Read-only portal: dashboard, bookings, payments/transfers
 */
(function () {
    'use strict';

    var REDIRECT_KEY = 'ca3_redirect';

    // ── Cookie helpers ────────────────────────────────────────────────────────
    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    // ── Session from cookie ───────────────────────────────────────────────────
    // Returns a minimal session object from the readable ca3_role cookie,
    // or null if not present.
    function getSession() {
        var role = getCookie('ca3_role');
        if (!role) return null;
        return { role: role };
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    // Returns Promise<{ success: bool, session?: object }>
    function login(email, password) {
        return fetch('/api/admin-login', {
            method:      'POST',
            credentials: 'same-origin',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ email: email, password: password }),
        }).then(function (r) {
            return r.json().then(function (data) {
                if (!data.success) return { success: false };
                // Server has set the cookies; build a local session object for UX
                var session = {
                    email:    email.toLowerCase().trim(),
                    role:     data.role,
                    name:     data.name,
                    initials: data.initials,
                };
                return { success: true, session: session };
            });
        }).catch(function () {
            return { success: false };
        });
    }

    // ── Logout ────────────────────────────────────────────────────────────────
    function logout() {
        fetch('/api/admin-logout', { method: 'POST', credentials: 'same-origin' })
            .finally(function () {
                window.location.href = '/admin/login.html';
            });
    }

    // ── Auth guard ────────────────────────────────────────────────────────────
    // Call at the top of each protected page.
    // Reads the ca3_role cookie first (instant). If absent, hits /api/admin-check
    // (one round-trip) to handle edge cases (e.g. HttpOnly cookie present but
    // readable cookie cleared). Redirects to login if unauthenticated.
    function requireAuth(callback) {
        var role = getCookie('ca3_role');

        if (role) {
            // Fast path — cookie present
            var session = { role: role };
            _applyToTopbar(session);
            if (callback) callback(session);
            return;
        }

        // Slow path — verify via API (covers cases where readable cookie is gone)
        fetch('/api/admin-check', { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('not authenticated');
                return r.json();
            })
            .then(function (data) {
                if (!data.authenticated) throw new Error('not authenticated');
                var session = { role: data.role, email: data.email };
                _applyToTopbar(session);
                if (callback) callback(session);
            })
            .catch(function () {
                sessionStorage.setItem(REDIRECT_KEY, window.location.href);
                window.location.href = '/admin/login.html';
            });
    }

    // ── Apply session to topbar ───────────────────────────────────────────────
    function _applyToTopbar(session) {
        // Handle avatar — multiple selector patterns are used across admin pages
        var avatar = document.querySelector(
            '.admin-topbar__user-avatar, .avatar-initials, #topbarAvatar, .topbar-user-avatar'
        );
        var uname = document.querySelector('.admin-topbar__user-name, #topbarName');
        if (avatar) avatar.textContent = session.initials || (session.role === 'admin' ? 'AD' : 'PO');
        if (uname)  uname.textContent  = session.name     || (session.role === 'admin' ? 'Admin' : 'Property Owner');

        // Role badge for owner
        if (session.role === 'owner') {
            var userBox = document.querySelector('.admin-topbar__user');
            if (userBox && !userBox.querySelector('.auth-role-badge')) {
                var badge = document.createElement('span');
                badge.className = 'auth-role-badge';
                badge.textContent = 'Owner';
                Object.assign(badge.style, {
                    background: '#635bff', color: '#fff',
                    fontSize: '0.65rem', fontWeight: '700',
                    padding: '2px 7px', borderRadius: '4px',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginRight: '6px', flexShrink: '0'
                });
                userBox.insertBefore(badge, userBox.firstChild);
            }
            _restrictOwnerNav();
        }

        // Logout button in header — try .admin-topbar__actions first, fall back to .topbar-right
        var actions = document.querySelector('.admin-topbar__actions')
                   || document.querySelector('.topbar-right');
        if (actions && !actions.querySelector('.auth-logout-btn')) {
            var btn = _makeLogoutButton();
            Object.assign(btn.style, { marginLeft: '8px', flexShrink: '0' });
            actions.appendChild(btn);
        }

        // Persistent footer on every admin page
        _injectAdminFooter(session);
    }

    // ── Build a styled Sign Out button ────────────────────────────────────────
    function _makeLogoutButton() {
        var btn = document.createElement('button');
        btn.className = 'auth-logout-btn';
        btn.title     = 'Sign out';
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" width="14" height="14">' +
            '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
            '<polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' +
            '</svg> Sign Out';
        Object.assign(btn.style, {
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px',
            border: '1.5px solid #e2e8f0', borderRadius: '6px',
            background: '#fff', cursor: 'pointer',
            fontSize: '0.8125rem', fontWeight: '500',
            color: '#64748b', fontFamily: "'Inter',sans-serif",
            transition: 'all 0.15s',
        });
        btn.addEventListener('mouseenter', function () {
            btn.style.background  = '#fef2f2';
            btn.style.color       = '#dc2626';
            btn.style.borderColor = '#fca5a5';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.background  = '#fff';
            btn.style.color       = '#64748b';
            btn.style.borderColor = '#e2e8f0';
        });
        btn.addEventListener('click', logout);
        return btn;
    }

    // ── Inject a persistent footer into every admin page ─────────────────────
    function _injectAdminFooter(session) {
        if (document.querySelector('.ca3-admin-footer')) return; // idempotent

        var main = document.querySelector('.admin-main') || document.body;

        var footer = document.createElement('footer');
        footer.className = 'ca3-admin-footer';
        footer.style.cssText =
            'border-top:1px solid #e2e8f0;padding:16px 24px;background:#f8fafc;' +
            'margin-top:auto;flex-shrink:0;';

        var inner = document.createElement('div');
        inner.style.cssText =
            'display:flex;align-items:center;justify-content:space-between;' +
            'gap:12px;flex-wrap:wrap;max-width:100%;';

        var left = document.createElement('span');
        left.style.cssText = 'font-size:0.8rem;color:#94a3b8;font-family:"Inter",sans-serif;';
        var roleName = session && session.role === 'owner' ? 'Property Owner' : 'Admin';
        left.textContent = 'Cascade Apartment 3 \u2014 Admin Panel \u00b7 Signed in as ' + roleName;

        var logoutBtn = _makeLogoutButton();
        Object.assign(logoutBtn.style, { padding: '6px 14px' });

        inner.appendChild(left);
        inner.appendChild(logoutBtn);
        footer.appendChild(inner);
        main.appendChild(footer);
    }

    // ── Owner nav restriction ─────────────────────────────────────────────────
    var OWNER_RESTRICTED = [
        'rates.html', 'settings.html', 'ical-sync.html',
        'properties.html', 'property-edit.html'
    ];

    function _restrictOwnerNav() {
        var page = window.location.pathname.split('/').pop();
        if (OWNER_RESTRICTED.indexOf(page) !== -1) {
            window.location.href = '/admin/index.html';
            return;
        }
        document.querySelectorAll('.sidebar-nav-link, .sidebar-nav a').forEach(function (a) {
            var href = (a.getAttribute('href') || '').split('/').pop();
            if (OWNER_RESTRICTED.indexOf(href) !== -1) {
                var item = a.closest('li') || a.parentElement;
                if (item) {
                    Object.assign(item.style, { opacity: '0.3', pointerEvents: 'none' });
                    a.title = 'Admin access only';
                }
            }
        });
    }

    // ── Expose public API ─────────────────────────────────────────────────────
    window.CA3Auth = {
        login:       login,
        logout:      logout,
        getSession:  getSession,
        requireAuth: requireAuth,
    };

}());
