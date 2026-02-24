/**
 * Cascade Apartment 3 — Client-side Authentication Module
 *
 * Uses SHA-256 (Web Crypto API) to hash credentials on first login.
 * Hashed credentials are stored in localStorage; session in sessionStorage.
 *
 * DEMO ONLY — In production, replace with server-side authentication
 * (e.g. JWT tokens, HTTP-only session cookies, Auth0, Firebase Auth, etc.)
 *
 * Roles:
 *   admin  — Full access: all pages, rates, settings, iCal, properties
 *   owner  — Read-only portal: dashboard, bookings (view), payments/transfers
 */
(function () {
    'use strict';

    var SESSION_KEY  = 'ca3_session';
    var USERS_KEY    = 'ca3_users';
    var REDIRECT_KEY = 'ca3_redirect';
    var SALT         = 'ca3-kXp9mZ-2026';

    // ── User seed ─────────────────────────────────────────────────────────────
    // Credentials are hashed with SHA-256 + salt on first login attempt,
    // then stored as hashes in localStorage. Plaintext is never re-used after that.
    var SEED = [
        {
            email:    'hello@mtbawbawcascade3.com',
            password: 'CaAdmin#2026',
            role:     'admin',
            name:     'Admin',
            initials: 'AD'
        },
        {
            email:    'typhoon.tall69@gmail.com',
            password: 'Rx8#Tz5mKp2w',
            role:     'owner',
            name:     'Property Owner',
            initials: 'PO'
        }
    ];

    // ── Crypto ────────────────────────────────────────────────────────────────
    function sha256(str) {
        return crypto.subtle.digest(
            'SHA-256', new TextEncoder().encode(str)
        ).then(function (buf) {
            return Array.from(new Uint8Array(buf))
                .map(function (b) { return b.toString(16).padStart(2, '0'); })
                .join('');
        });
    }

    // ── User store ────────────────────────────────────────────────────────────
    // Hashes all seed passwords and stores in localStorage (runs once)
    function ensureUsers() {
        if (localStorage.getItem(USERS_KEY)) return Promise.resolve();
        var out = {};
        return Promise.all(SEED.map(function (u) {
            return sha256(u.email.toLowerCase() + ':' + u.password + ':' + SALT)
                .then(function (hash) {
                    out[u.email.toLowerCase()] = {
                        hash:     hash,
                        role:     u.role,
                        name:     u.name,
                        initials: u.initials
                    };
                });
        })).then(function () {
            localStorage.setItem(USERS_KEY, JSON.stringify(out));
        });
    }

    // ── Session helpers ───────────────────────────────────────────────────────
    function getSession() {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
        catch (e) { return null; }
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    // Returns Promise<{ success: bool, session?: object }>
    function login(email, password) {
        return ensureUsers().then(function () {
            var users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
            var key   = (email || '').toLowerCase().trim();
            var user  = users[key];
            if (!user) return { success: false };
            return sha256(key + ':' + password + ':' + SALT).then(function (hash) {
                if (hash !== user.hash) return { success: false };
                var session = {
                    email:    key,
                    role:     user.role,
                    name:     user.name,
                    initials: user.initials,
                    ts:       Date.now()
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
                return { success: true, session: session };
            });
        });
    }

    // ── Logout ────────────────────────────────────────────────────────────────
    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '/admin/login.html';
    }

    // ── Auth guard ────────────────────────────────────────────────────────────
    // Call from each protected page. Redirects to login if no session.
    // If session exists, applies user info to topbar and returns session.
    function requireAuth() {
        var session = getSession();
        if (!session) {
            sessionStorage.setItem(REDIRECT_KEY, window.location.href);
            window.location.href = '/admin/login.html';
            return null;
        }
        _applyToTopbar(session);
        return session;
    }

    // ── Apply session to topbar ───────────────────────────────────────────────
    function _applyToTopbar(session) {
        var avatar = document.querySelector('.admin-topbar__user-avatar');
        var uname  = document.querySelector('.admin-topbar__user-name');
        if (avatar) avatar.textContent = session.initials;
        if (uname)  uname.textContent  = session.name;

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

        // Logout button
        var actions = document.querySelector('.admin-topbar__actions');
        if (actions && !actions.querySelector('.auth-logout-btn')) {
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
                transition: 'all 0.15s', marginLeft: '8px', flexShrink: '0'
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
            actions.appendChild(btn);
        }
    }

    // ── Owner nav restriction ─────────────────────────────────────────────────
    // Owner can view: Dashboard, Bookings, Calendar, Guests, Reports, Payments
    // Owner is redirected away from: Rates, Settings, iCal Sync, Properties
    function _restrictOwnerNav() {
        var RESTRICTED = [
            'rates.html', 'settings.html', 'ical-sync.html',
            'properties.html', 'property-edit.html'
        ];
        var page = window.location.pathname.split('/').pop();
        if (RESTRICTED.indexOf(page) !== -1) {
            window.location.href = '/admin/index.html';
            return;
        }
        document.querySelectorAll('.sidebar-nav-link, .sidebar-nav a').forEach(function (a) {
            var href = (a.getAttribute('href') || '').split('/').pop();
            if (RESTRICTED.indexOf(href) !== -1) {
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
        requireAuth: requireAuth
    };

    // Pre-warm the user store (hashes on first visit, resolves immediately after)
    if (window.crypto && window.crypto.subtle) {
        ensureUsers().catch(function () {});
    }

}());
