/**
 * Cascade Apartment 3 - Shared Data Layer
 * Provides localStorage persistence for bookings, blocked dates,
 * iCal connections, and settings across all admin pages.
 */

(function() {
  'use strict';

  const KEYS = {
    BOOKINGS: 'ca3_bookings',
    BLOCKED:  'ca3_blocked',
    ICAL:     'ca3_ical_connections',
    RATES:    'ca3_rates',
    VERSION:  'ca3_data_version',
  };

  // Bump this whenever the seed data format changes. On version mismatch
  // any previously seeded fake/demo data is cleared so we start fresh.
  const DATA_VERSION = '2';

  /* ─── Version migration ─────────────────────────────────────────── */

  (function migrate() {
    const stored = localStorage.getItem(KEYS.VERSION);
    if (stored === DATA_VERSION) return;

    // Clear any old demo/seed data from earlier versions
    [KEYS.BOOKINGS, KEYS.BLOCKED, KEYS.ICAL].forEach(function(k) {
      localStorage.removeItem(k);
    });

    localStorage.setItem(KEYS.VERSION, DATA_VERSION);
  })();

  /* ─── Default seeds (empty — no fake data) ──────────────────────── */

  function emptyArray() { return []; }

  function seedRates() {
    return {
      winter:   { label: 'Winter Season',   months: [6,7,8],       ratePerNight: 385, minStay: 2 },
      standard: { label: 'Standard',        months: [3,4,5,9,10,11], ratePerNight: 285, minStay: 1 },
      offPeak:  { label: 'Off-peak',        months: [1,2,12],      ratePerNight: 220, minStay: 1 },
      cleaningFee: 100, serviceFeePercent: 5, taxPercent: 10, depositPercent: 30
    };
  }

  /* ─── Storage helpers ────────────────────────────────────────────── */

  function load(key, seedFn) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through */ }
    const data = seedFn();
    save(key, data);
    return data;
  }

  function save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* quota */ }
  }

  /* ─── Public API ─────────────────────────────────────────────────── */

  const CA3Data = {
    /* Bookings */
    getBookings()              { return load(KEYS.BOOKINGS, emptyArray); },
    saveBookings(list)         { save(KEYS.BOOKINGS, list); },
    addBooking(b)              { const list = this.getBookings(); list.push(b); this.saveBookings(list); },
    updateBooking(id, changes) {
      const list = this.getBookings().map(b => b.id === id ? { ...b, ...changes } : b);
      this.saveBookings(list);
    },
    deleteBooking(id)          { this.saveBookings(this.getBookings().filter(b => b.id !== id)); },

    /* Blocked dates */
    getBlocked()               { return load(KEYS.BLOCKED, emptyArray); },
    saveBlocked(list)          { save(KEYS.BLOCKED, list); },
    addBlocked(bl)             { const list = this.getBlocked(); list.push(bl); this.saveBlocked(list); },
    deleteBlocked(id)          { this.saveBlocked(this.getBlocked().filter(b => b.id !== id)); },

    /* iCal connections */
    getIcal()                  { return load(KEYS.ICAL, emptyArray); },
    saveIcal(list)             { save(KEYS.ICAL, list); },
    addIcal(conn)              { const list = this.getIcal(); list.push(conn); this.saveIcal(list); },
    removeIcal(id)             { this.saveIcal(this.getIcal().filter(c => c.id !== id)); },

    /* Rates */
    getRates()                 { return load(KEYS.RATES, seedRates); },
    saveRates(r)               { save(KEYS.RATES, r); },

    /* Helpers */
    getRateForDate(dateStr) {
      const rates = this.getRates();
      const month = new Date(dateStr).getMonth() + 1;
      if (rates.winter.months.includes(month))  return rates.winter.ratePerNight;
      if (rates.offPeak.months.includes(month)) return rates.offPeak.ratePerNight;
      return rates.standard.ratePerNight;
    },

    isDateBooked(dateStr) {
      const d = new Date(dateStr);
      return this.getBookings().some(b => {
        const ci = new Date(b.checkIn), co = new Date(b.checkOut);
        return d >= ci && d < co && b.status !== 'cancelled';
      });
    },

    isDateBlocked(dateStr) {
      const d = new Date(dateStr);
      return this.getBlocked().some(bl => {
        return d >= new Date(bl.startDate) && d <= new Date(bl.endDate);
      });
    },

    getBookingForDate(dateStr) {
      const d = new Date(dateStr);
      return this.getBookings().find(b => {
        const ci = new Date(b.checkIn), co = new Date(b.checkOut);
        return d >= ci && d < co && b.status !== 'cancelled';
      });
    },

    generateId(prefix) {
      return prefix + '-' + Date.now().toString(36).toUpperCase();
    }
  };

  window.CA3Data = CA3Data;

})();
