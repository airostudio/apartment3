/**
 * Cascade Apartment 3 — Data Layer (Supabase-backed)
 *
 * init()  — fetches all data from server APIs, populates in-memory cache
 * reads   — synchronous (from cache), so existing page code works unchanged
 * writes  — async (await required), wait for DB confirmation before resolving
 *
 * Usage:
 *   await CA3Data.init();          // on page load
 *   const list = CA3Data.getBookings();   // sync read from cache
 *   const saved = await CA3Data.addBooking({...});  // async write — returns saved record
 */

(function () {
  'use strict';

  /* ─── In-memory cache ─────────────────────────────────────────────── */

  var _cache = { bookings: [], blocked: [], ical: [], rates: null };
  var _initPromise = null;

  /* ─── Error toast ─────────────────────────────────────────────────── */

  function showToast(msg, type) {
    var bg = type === 'success' ? '#065f46' : '#b91c1c';
    var icon = type === 'success' ? '✓' : '⚠';
    var el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:99999',
      'background:' + bg, 'color:#fff',
      'padding:14px 20px', 'border-radius:10px',
      'font-size:14px', 'font-weight:600', 'line-height:1.4',
      'box-shadow:0 4px 24px rgba(0,0,0,0.25)',
      'max-width:380px', 'display:flex', 'align-items:flex-start', 'gap:10px',
      'transition:opacity 0.3s',
    ].join(';');
    el.innerHTML = '<span style="font-size:16px;flex-shrink:0;">' + icon + '</span>'
                 + '<span>' + String(msg).replace(/</g, '&lt;') + '</span>';
    document.body.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 350); }, 5000);
  }

  /* ─── Shared fetch helper ─────────────────────────────────────────── */

  function apiFetch(url, options) {
    var opts = Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, options);
    return fetch(url, opts).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (d) {
        var msg = d.error || ('Request failed: HTTP ' + r.status);
        if (r.status === 401) msg = 'Session expired — please log in again.';
        if (r.status === 503 && d.code === 'db_not_configured') {
          msg = 'Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.';
        }
        throw new Error(msg);
      });
    });
  }

  /* ─── ID generator ────────────────────────────────────────────────── */

  function genId(prefix) {
    return (prefix || 'CA3') + '-' + Date.now().toString(36).toUpperCase();
  }

  /* ─── Init: load everything from API ─────────────────────────────── */

  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = Promise.all([
      fetch('/api/available-dates',   { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : { bookings: [] }; }).catch(function(){ return { bookings: [] }; }),
      fetch('/api/blocked-dates',     { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : { blocked: [] }; }).catch(function(){ return { blocked: [] }; }),
      fetch('/api/ical-connections',  { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : { connections: [] }; }).catch(function(){ return { connections: [] }; }),
      fetch('/api/rates',             { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : { rates: null }; }).catch(function(){ return { rates: null }; }),
    ]).then(function (results) {
      _cache.bookings = results[0].bookings   || [];
      _cache.blocked  = results[1].blocked    || [];
      _cache.ical     = results[2].connections|| [];
      _cache.rates    = results[3].rates      || _seedRates();
    });
    return _initPromise;
  }

  function _seedRates() {
    return {
      seasons: {
        white:    { name: 'White Season',    months: [6,7,8,9],     ratePerNight: 420, minStay: 2 },
        green:    { name: 'Green Season',    months: [12,1,2],      ratePerNight: 280, minStay: 1 },
        shoulder: { name: 'Shoulder Season', months: [3,4,5,10,11], ratePerNight: 200, minStay: 1 },
      },
      fees: {
        cleaning:   { name: 'Cleaning Fee', amount: 0,   isPercent: false },
        service:    { name: 'Service Fee',  amount: 100, isPercent: false },
        extraguest: { name: 'Extra Guest',  amount: 10,  isPercent: false },
        pet:        { name: 'Pet Fee',      amount: 50,  isPercent: false },
      },
    };
  }

  /* ─── Public API ──────────────────────────────────────────────────── */

  var CA3Data = {

    init: init,
    generateId: genId,

    /* ── Bookings ── */

    getBookings: function () { return _cache.bookings.slice(); },

    addBooking: function (b) {
      if (!b.id) b.id = genId('CA3');
      return apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(b) })
        .then(function (data) {
          var saved = data.booking || b;
          _cache.bookings.unshift(saved);
          showToast('Booking saved', 'success');
          return saved;
        })
        .catch(function (err) {
          showToast('Could not save booking — ' + err.message, 'error');
          throw err;
        });
    },

    updateBooking: function (id, changes) {
      return apiFetch('/api/bookings', { method: 'PUT', body: JSON.stringify({ id: id, changes: changes }) })
        .then(function (data) {
          var saved = data.booking || changes;
          var idx = _cache.bookings.findIndex(function (b) { return b.id === id; });
          if (idx >= 0) Object.assign(_cache.bookings[idx], saved);
          showToast('Booking updated', 'success');
          return saved;
        })
        .catch(function (err) {
          showToast('Could not update booking — ' + err.message, 'error');
          throw err;
        });
    },

    deleteBooking: function (id) {
      return apiFetch('/api/bookings', { method: 'DELETE', body: JSON.stringify({ id: id }) })
        .then(function () {
          _cache.bookings = _cache.bookings.filter(function (b) { return b.id !== id; });
          showToast('Booking deleted', 'success');
        })
        .catch(function (err) {
          showToast('Could not delete booking — ' + err.message, 'error');
          throw err;
        });
    },

    saveBookings: function (list) { _cache.bookings = list; }, // legacy compat

    /* ── Blocked dates ── */

    getBlocked: function () { return _cache.blocked.slice(); },

    addBlocked: function (bl) {
      if (!bl.id) bl.id = genId('BL');
      return apiFetch('/api/blocked-dates', { method: 'POST', body: JSON.stringify(bl) })
        .then(function (data) {
          var saved = data.blocked || bl;
          _cache.blocked.push(saved);
          showToast('Dates blocked', 'success');
          return saved;
        })
        .catch(function (err) {
          showToast('Could not block dates — ' + err.message, 'error');
          throw err;
        });
    },

    deleteBlocked: function (id) {
      return apiFetch('/api/blocked-dates', { method: 'DELETE', body: JSON.stringify({ id: id }) })
        .then(function () {
          _cache.blocked = _cache.blocked.filter(function (b) { return b.id !== id; });
          showToast('Block removed', 'success');
        })
        .catch(function (err) {
          showToast('Could not remove block — ' + err.message, 'error');
          throw err;
        });
    },

    saveBlocked: function (list) { _cache.blocked = list; }, // legacy compat

    /* ── iCal connections ── */

    getIcal: function () { return _cache.ical.slice(); },

    addIcal: function (conn) {
      if (!conn.id) conn.id = genId('IC');
      return apiFetch('/api/ical-connections', { method: 'POST', body: JSON.stringify(conn) })
        .then(function (data) {
          var saved = data.connection || conn;
          _cache.ical.push(saved);
          showToast('iCal feed added', 'success');
          return saved;
        })
        .catch(function (err) {
          showToast('Could not add iCal feed — ' + err.message, 'error');
          throw err;
        });
    },

    removeIcal: function (id) {
      return apiFetch('/api/ical-connections', { method: 'DELETE', body: JSON.stringify({ id: id }) })
        .then(function () {
          _cache.ical = _cache.ical.filter(function (c) { return c.id !== id; });
          showToast('iCal feed removed', 'success');
        })
        .catch(function (err) {
          showToast('Could not remove feed — ' + err.message, 'error');
          throw err;
        });
    },

    saveIcal: function (list) {
      // Update last_sync on a connection — fire-and-forget (non-critical)
      _cache.ical = list;
      list.forEach(function (conn) {
        if (conn.lastSync) {
          fetch('/api/ical-connections', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: conn.id, changes: { lastSync: conn.lastSync } }),
          }).catch(function () {});
        }
      });
    },

    /* ── Rates ── */

    getRates: function () { return _cache.rates || _seedRates(); },
    saveRates: function (r) { _cache.rates = r; }, // rates.html POSTs directly to /api/rates

    /* ── Date/booking helpers ── */

    isDateBooked: function (dateStr) {
      var d = new Date(dateStr);
      return _cache.bookings.some(function (b) {
        var ci = new Date(b.checkIn  || b.checkin);
        var co = new Date(b.checkOut || b.checkout);
        return d >= ci && d < co && b.status !== 'cancelled';
      });
    },

    isDateBlocked: function (dateStr) {
      var d = new Date(dateStr);
      return _cache.blocked.some(function (bl) {
        return d >= new Date(bl.startDate) && d <= new Date(bl.endDate);
      });
    },

    getBookingForDate: function (dateStr) {
      var d = new Date(dateStr);
      return _cache.bookings.find(function (b) {
        var ci = new Date(b.checkIn  || b.checkin);
        var co = new Date(b.checkOut || b.checkout);
        return d >= ci && d < co && b.status !== 'cancelled';
      });
    },

    getRateForDate: function (dateStr) {
      var rates   = this.getRates();
      var month   = new Date(dateStr).getMonth() + 1;
      var seasons = (rates.seasons || {});
      for (var key in seasons) {
        if (seasons[key].months && seasons[key].months.indexOf(month) >= 0) {
          return seasons[key].ratePerNight;
        }
      }
      if (rates.winter  && rates.winter.months  && rates.winter.months.indexOf(month)  >= 0) return rates.winter.ratePerNight;
      if (rates.offPeak && rates.offPeak.months && rates.offPeak.months.indexOf(month) >= 0) return rates.offPeak.ratePerNight;
      return rates.standard ? rates.standard.ratePerNight : 200;
    },
  };

  window.CA3Data = CA3Data;

})();
