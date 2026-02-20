/**
 * Admin Authentication Guard
 * Include this script at the top of every protected admin page.
 * Redirects unauthenticated users to the login page.
 */
(function() {
    'use strict';

    var ADMIN_PAGES_PATH = '/admin/';
    var LOGIN_PAGE = 'login.html';

    function isLoggedIn() {
        return sessionStorage.getItem('adminLoggedIn') === 'true';
    }

    function getCurrentPath() {
        return window.location.pathname;
    }

    function getLoginUrl() {
        // Determine correct path to login.html based on current location
        var path = getCurrentPath();
        if (path.indexOf('/admin/') !== -1) {
            return LOGIN_PAGE;
        }
        return 'admin/' + LOGIN_PAGE;
    }

    function redirectToLogin() {
        // Save intended destination so we can redirect back after login
        sessionStorage.setItem('adminRedirect', window.location.href.split('/').pop() || 'index.html');
        window.location.replace(getLoginUrl());
    }

    // Run auth check immediately (before page renders content)
    if (!isLoggedIn()) {
        redirectToLogin();
    }

    // Export helpers for use by admin pages
    window.AdminAuth = {
        /**
         * Get the current logged-in admin email
         */
        getEmail: function() {
            return sessionStorage.getItem('adminEmail') || '';
        },

        /**
         * Get the current admin role ('owner' or 'admin')
         */
        getRole: function() {
            return sessionStorage.getItem('adminRole') || 'admin';
        },

        /**
         * Check if the current user is the property owner
         */
        isOwner: function() {
            return sessionStorage.getItem('adminRole') === 'owner';
        },

        /**
         * Log out and redirect to login page
         */
        logout: function() {
            sessionStorage.removeItem('adminLoggedIn');
            sessionStorage.removeItem('adminEmail');
            sessionStorage.removeItem('adminRole');
            sessionStorage.removeItem('adminRedirect');
            window.location.replace(getLoginUrl());
        },

        /**
         * Populate topbar user info from session (call in DOMContentLoaded)
         */
        populateTopbar: function() {
            var email = this.getEmail();
            var role = this.getRole();

            var avatarEl = document.getElementById('topbarAvatar');
            var nameEl = document.getElementById('topbarName');

            if (avatarEl && email) {
                var initials = email.split('@')[0].split(/[._]/).map(function(p) {
                    return p.charAt(0).toUpperCase();
                }).slice(0, 2).join('');
                avatarEl.textContent = initials || 'AD';
            }

            if (nameEl && role) {
                nameEl.textContent = role === 'owner' ? 'Owner' : 'Admin';
            }
        }
    };

    // Auto-populate topbar and inject logout button after DOM loads
    document.addEventListener('DOMContentLoaded', function() {
        if (window.AdminAuth) {
            window.AdminAuth.populateTopbar();
        }

        // Inject logout button into topbar-right
        var userEl = document.querySelector('.topbar-user, .admin-topbar__user');
        if (userEl && userEl.parentNode) {
            var logoutBtn = document.createElement('button');
            logoutBtn.type = 'button';
            logoutBtn.title = 'Sign Out';
            logoutBtn.setAttribute('aria-label', 'Sign Out');
            logoutBtn.style.cssText = [
                'display:inline-flex', 'align-items:center', 'gap:4px',
                'padding:6px 10px', 'border-radius:6px',
                'border:1px solid rgba(255,255,255,0.15)',
                'background:rgba(255,255,255,0.08)',
                'color:rgba(255,255,255,0.8)', 'font-size:12px',
                'font-weight:500', 'cursor:pointer',
                'transition:all 0.15s', 'margin-left:8px',
                'font-family:inherit', 'white-space:nowrap'
            ].join(';');
            logoutBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Sign Out';
            logoutBtn.addEventListener('click', function() {
                if (window.AdminAuth) { window.AdminAuth.logout(); }
            });
            logoutBtn.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(255,255,255,0.18)';
                this.style.color = 'white';
            });
            logoutBtn.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.08)';
                this.style.color = 'rgba(255,255,255,0.8)';
            });
            userEl.parentNode.appendChild(logoutBtn);
        }
    });
})();
