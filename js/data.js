/**
 * Cascade Apartment 3 — Data Layer (API-backed)
 *
 * Fetches all data from the server APIs on init() and keeps an in-memory cache.
 * Sync reads operate on the cache so existing admin page code doesn't change.
 * Writes update the cache immediately (optimistic) then persist to the API.
 *
 * Usage in admin pages:
 *   CA3Data.init().then(function() {
 *     loadBookings();  // or whatever the page's render function is
 *   });
 */

(function () {
  'use strict';

  /* ─── Default rates (used when DB is not yet configured) ─────────── */

  function seedRates() {
    return {
      seasons: {
        white:    { name: 'White Season',    subLabel: 'Winter / Ski Season',       dates: 'June – September',              months: [6,7,8,9],     ratePerNight: 420, minStay: 2 },
        green:    { name: 'Green Season',    subLabel: 'Summer / Holiday Season',   dates: 'December – February',           months: [12,1,2],      ratePerNight: 280, minStay: 1 },
        shoulder: { name: 'Shoulder Season', subLabel: 'Off-peak',                  dates: 'March – May, October – November', months: [3,4,5,10,11], ratePerNight: 200, minStay: 1 },
      },
      fees: {
        cleaning:   { name: 'Cleaning Fee', amount: 120, type: 'Per Stay',  isPercent: false },
        service:    { name: 'Service Fee',  amount: 0,   type: 'Per Stay',  isPercent: true  },
        extraguest: { name: 'Extra Guest',  amount: 30,  type: 'Per Night', isPercent: false },
        pet:        { name: 'Pet Fee',      amount: 50,  type: 'Per Stay',  isPercent: false },
      },
    };
  }

  /* ─── In-memory cache ────────────────────────────────────────────── */

  var _cache = {
    bookings:    [],
    blocked:     [],
    ical:        [],
    rates:       null,
    dbAvailable: false,
  };

  var _initPromise = null;

  /* ─── Helpers ────────────────────────────────────────────────────── */

  function genId(prefix) {
    return (prefix || 'CA3') + '-' + Date.now().toString(36).toUpperCase();
  }

  function apiPost(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function apiPut(url, body) {
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function apiDelete(url, body) {
    return fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /* ─── Init: fetch all data from APIs ────────────────────────────── */

  function init() {
    if (_initPromise) return _initPromise;

    _initPromise = Promise.all([
      fetch('/api/bookings').then(function (r) { return r.ok ? r.json() : { bookings: [] }; }).catch(function () { return { bookings: [] }; }),
      fetch('/api/blocked-dates').then(function (r) { return r.ok ? r.json() : { blocked: [] }; }).catch(function () { return { blocked: [] }; }),
      fetch('/api/ical-connections').then(function (r) { return r.ok ? r.json() : { connections: [] }; }).catch(function () { return { connections: [] }; }),
      fetch('/api/rates').then(function (r) { return r.ok ? r.json() : { rates: null, dbConfigured: false }; }).catch(function () { return { rates: null }; }),
    ]).then(function (results) {
      var bData  = results[0];
      var blData = results[1];
      var icData = results[2];
      var rData  = results[3];

      _cache.bookings    = bData.bookings   || [];
      _cache.blocked     = blData.blocked   || [];
      _cache.ical        = icData.connections || [];
      _cache.rates       = rData.rates      || seedRates();
      _cache.dbAvailable = !!(bData.bookings !== undefined && bData.code !== 'db_not_configured');
    });

    return _initPromise;
  }

  /* ─── Public API ─────────────────────────────────────────────────── */

  var CA3Data = {

    /* ── Init ── */
    init: init,

    isDbAvailable: function () { return _cache.dbAvailable; },

    /* ── Bookings (sync read, async write) ── */

    getBookings: function () { return _cache.bookings.slice(); },

    addBooking: function (b) {
      if (!b.id) b.id = genId('CA3');
      _cache.bookings.unshift(b); // optimistic add to front
      apiPost('/api/bookings', b).then(function (r) {
        if (r.ok) return r.json();
      }).then(function (data) {
        if (data && data.booking) {
          // Replace optimistic entry with server version
          var idx = _cache.bookings.findIndex(function (x) { return x.id === b.id; });
          if (idx >= 0) _cache.bookings[idx] = data.booking;
        }
      }).catch(function (err) {
        console.warn('[CA3Data] addBooking API error:', err);
      });
      return b;
    },

    updateBooking: function (id, changes) {
      var idx = _cache.bookings.findIndex(function (b) { return b.id === id; });
      if (idx >= 0) Object.assign(_cache.bookings[idx], changes); // optimistic
      apiPut('/api/bookings', { id: id, changes: changes }).catch(function (err) {
        console.warn('[CA3Data] updateBooking API error:', err);
      });
    },

    deleteBooking: function (id) {
      _cache.bookings = _cache.bookings.filter(function (b) { return b.id !== id; });
      apiDelete('/api/bookings', { id: id }).catch(function (err) {
        console.warn('[CA3Data] deleteBooking API error:', err);
      });
    },

    saveBookings: function (list) {
      // Batch replace — used by legacy code; just update cache (individual ops handle API)
      _cache.bookings = list;
    },

    /* ── Blocked dates ── */

    getBlocked: function () { return _cache.blocked.slice(); },

    addBlocked: function (bl) {
      if (!bl.id) bl.id = genId('BL');
      _cache.blocked.push(bl); // optimistic
      apiPost('/api/blocked-dates', bl).then(function (r) {
        if (r.ok) return r.json();
      }).then(function (data) {
        if (data && data.blocked) {
          var idx = _cache.blocked.findIndex(function (x) { return x.id === bl.id; });
          if (idx >= 0) _cache.blocked[idx] = data.blocked;
        }
      }).catch(function (err) {
        console.warn('[CA3Data] addBlocked API error:', err);
      });
      return bl;
    },

    deleteBlocked: function (id) {
      _cache.blocked = _cache.blocked.filter(function (b) { return b.id !== id; });
      apiDelete('/api/blocked-dates', { id: id }).catch(function (err) {
        console.warn('[CA3Data] deleteBlocked API error:', err);
      });
    },

    saveBlocked: function (list) { _cache.blocked = list; },

    /* ── iCal connections ── */

    getIcal: function () { return _cache.ical.slice(); },

    addIcal: function (conn) {
      if (!conn.id) conn.id = genId('IC');
      _cache.ical.push(conn); // optimistic
      apiPost('/api/ical-connections', conn).then(function (r) {
        if (r.ok) return r.json();
      }).then(function (data) {
        if (data && data.connection) {
          var idx = _cache.ical.findIndex(function (x) { return x.id === conn.id; });
          if (idx >= 0) _cache.ical[idx] = data.connection;
        }
      }).catch(function (err) {
        console.warn('[CA3Data] addIcal API error:', err);
      });
      return conn;
    },

    removeIcal: function (id) {
      _cache.ical = _cache.ical.filter(function (c) { return c.id !== id; });
      apiDelete('/api/ical-connections', { id: id }).catch(function (err) {
        console.warn('[CA3Data] removeIcal API error:', err);
      });
    },

    saveIcal: function (list) { _cache.ical = list; },

    /* ── Rates ── */

    getRates: function () { return _cache.rates || seedRates(); },

    saveRates: function (r) {
      _cache.rates = r;
      // Note: rates.html has its own save logic via POST /api/rates with auth
    },

    /* ── Helpers ── */

    generateId: genId,

    getRateForDate: function (dateStr) {
      var rates = this.getRates();
      var month = new Date(dateStr).getMonth() + 1;
      var seasons = rates.seasons || {};
      for (var key in seasons) {
        if (seasons[key].months && seasons[key].months.indexOf(month) >= 0) {
          return seasons[key].ratePerNight;
        }
      }
      // Fallback to old format
      if (rates.winter  && rates.winter.months  && rates.winter.months.indexOf(month)  >= 0) return rates.winter.ratePerNight;
      if (rates.offPeak && rates.offPeak.months && rates.offPeak.months.indexOf(month) >= 0) return rates.offPeak.ratePerNight;
      return rates.standard ? rates.standard.ratePerNight : 200;
    },

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
  };

  window.CA3Data = CA3Data;

})();
