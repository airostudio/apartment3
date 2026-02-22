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
  };

  /* ─── Sample seed data ─────────────────────────────────────────── */

  function seedBookings() {
    const y = new Date().getFullYear();
    return [
      {
        id: 'BK-001', ref: 'CA3-2026-00121',
        guestName: 'Sarah Mitchell', guestEmail: 'sarah.mitchell@example.com',
        guestPhone: '+61 412 345 678',
        checkIn: y + '-06-20', checkOut: y + '-06-27',
        nights: 7, guests: 4, status: 'confirmed', source: 'direct',
        baseRate: 285, total: 1995, paid: 1995, deposit: 599,
        notes: 'Family with two kids. Requested early check-in.'
      },
      {
        id: 'BK-002', ref: 'CA3-2026-00122',
        guestName: 'James & Wei Chen', guestEmail: 'jchen@example.com',
        guestPhone: '+61 433 901 234',
        checkIn: y + '-07-04', checkOut: y + '-07-11',
        nights: 7, guests: 6, status: 'confirmed', source: 'airbnb',
        baseRate: 385, total: 2695, paid: 808, deposit: 808,
        notes: 'Imported from Airbnb. Group of 6, 3 couples.'
      },
      {
        id: 'BK-003', ref: 'CA3-2026-00123',
        guestName: 'Thompson Family', guestEmail: 'thompsons@example.com',
        guestPhone: '+61 421 776 543',
        checkIn: y + '-07-18', checkOut: y + '-07-25',
        nights: 7, guests: 8, status: 'confirmed', source: 'booking_com',
        baseRate: 385, total: 2695, paid: 808, deposit: 808,
        notes: 'Imported from Booking.com. Full capacity, 8 guests.'
      },
      {
        id: 'BK-004', ref: 'CA3-2026-00124',
        guestName: 'Priya Patel', guestEmail: 'priya.patel@example.com',
        guestPhone: '+61 417 654 321',
        checkIn: y + '-08-01', checkOut: y + '-08-05',
        nights: 4, guests: 2, status: 'pending', source: 'direct',
        baseRate: 285, total: 1140, paid: 342, deposit: 342,
        notes: 'Awaiting payment confirmation.'
      },
      {
        id: 'BK-005', ref: 'CA3-2026-00125',
        guestName: 'Alex & Jordan Rivera', guestEmail: 'arivera@example.com',
        guestPhone: '+61 408 123 456',
        checkIn: y + '-09-12', checkOut: y + '-09-19',
        nights: 7, guests: 4, status: 'confirmed', source: 'direct',
        baseRate: 220, total: 1540, paid: 1540, deposit: 462,
        notes: ''
      }
    ];
  }

  function seedBlocked() {
    const y = new Date().getFullYear();
    return [
      {
        id: 'BL-001', startDate: y + '-06-14', endDate: y + '-06-19',
        reason: 'Owner use', source: 'manual'
      },
      {
        id: 'BL-002', startDate: y + '-08-22', endDate: y + '-08-31',
        reason: 'Maintenance', source: 'manual'
      }
    ];
  }

  function seedIcal() {
    return [
      {
        id: 'IC-001', platform: 'airbnb', label: 'Airbnb — Cascade Apt 4',
        url: 'https://www.airbnb.com.au/calendar/ical/YOUR_LISTING_ID.ics?s=YOUR_SECRET',
        status: 'active', lastSync: new Date(Date.now() - 28 * 60000).toISOString(),
        eventsImported: 14, frequency: '1hour',
        exportUrl: 'https://cascadeapartment3.com.au/ical/export/cascade-apt3.ics'
      },
      {
        id: 'IC-002', platform: 'booking_com', label: 'Booking.com — Cascade Apt 4',
        url: 'https://admin.booking.com/hotel/hoteladmin/ical.html?t=YOUR_TOKEN',
        status: 'active', lastSync: new Date(Date.now() - 55 * 60000).toISOString(),
        eventsImported: 8, frequency: '1hour',
        exportUrl: 'https://cascadeapartment3.com.au/ical/export/cascade-apt3.ics'
      }
    ];
  }

  function seedRates() {
    return {
      winter:   { label: 'Winter Season',   months: [6,7,8],  ratePerNight: 385, minStay: 2 },
      standard: { label: 'Standard',        months: [3,4,5,9,10,11], ratePerNight: 285, minStay: 1 },
      offPeak:  { label: 'Off-peak',        months: [1,2,12], ratePerNight: 220, minStay: 1 },
      cleaningFee: 100, serviceFeePercent: 5, taxPercent: 10, depositPercent: 30
    };
  }

  /* ─── Public API ────────────────────────────────────────────────── */

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

  const CA3Data = {
    /* Bookings */
    getBookings()         { return load(KEYS.BOOKINGS, seedBookings); },
    saveBookings(list)    { save(KEYS.BOOKINGS, list); },
    addBooking(b)         { const list = this.getBookings(); list.push(b); this.saveBookings(list); },
    updateBooking(id, changes) {
      const list = this.getBookings().map(b => b.id === id ? { ...b, ...changes } : b);
      this.saveBookings(list);
    },
    deleteBooking(id)     { this.saveBookings(this.getBookings().filter(b => b.id !== id)); },

    /* Blocked dates */
    getBlocked()          { return load(KEYS.BLOCKED, seedBlocked); },
    saveBlocked(list)     { save(KEYS.BLOCKED, list); },
    addBlocked(bl)        { const list = this.getBlocked(); list.push(bl); this.saveBlocked(list); },
    deleteBlocked(id)     { this.saveBlocked(this.getBlocked().filter(b => b.id !== id)); },

    /* iCal connections */
    getIcal()             { return load(KEYS.ICAL, seedIcal); },
    saveIcal(list)        { save(KEYS.ICAL, list); },
    addIcal(conn)         { const list = this.getIcal(); list.push(conn); this.saveIcal(list); },
    removeIcal(id)        { this.saveIcal(this.getIcal().filter(c => c.id !== id)); },

    /* Rates */
    getRates()            { return load(KEYS.RATES, seedRates); },
    saveRates(r)          { save(KEYS.RATES, r); },

    /* Helpers */
    getRateForDate(dateStr) {
      const rates = this.getRates();
      const month = new Date(dateStr).getMonth() + 1;
      if (rates.winter.months.includes(month))   return rates.winter.ratePerNight;
      if (rates.offPeak.months.includes(month))  return rates.offPeak.ratePerNight;
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
