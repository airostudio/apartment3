/**
 * Cascade Apartment 3 - Booking Engine
 * Handles: Price calculations, booking form validation, availability checks,
 * rate rules, seasonal pricing, and booking flow management
 */

(function() {
  'use strict';

  const BookingEngine = {
    // Default industry-standard settings (configurable per property)
    defaults: {
      checkInTime: '14:00',
      checkOutTime: '10:00',
      minStay: 1,
      maxStay: 30,
      maxGuests: 10,
      advanceBookingDays: 365,
      bookingCutoffHours: 24,
      currency: 'AUD',
      depositPercent: 30,
      cleaningFee: 75,
      serviceFeePercent: 5,
      taxPercent: 10,
    },

    // Rate types
    rateTypes: {
      PEAK: 'peak',
      STANDARD: 'standard',
      OFF_PEAK: 'off_peak',
      SPECIAL: 'special'
    },

    /**
     * Calculate total price for a booking
     */
    calculatePrice(params) {
      const {
        baseRate,
        checkin,
        checkout,
        guests = 2,
        adults,          // optional: number of adults
        children = 0,    // optional: number of children
        extraGuestFee = 0,
        extraAdultFee = 0,   // extra fee per adult per night beyond maxBaseGuests
        extraChildFee = 0,   // extra fee per child per night beyond remaining base slots
        maxBaseGuests = 2,
        seasonalRates = [],
        specialRules = [],
        cleaningFee = this.defaults.cleaningFee,
        serviceFeePercent = this.defaults.serviceFeePercent,
        taxPercent = this.defaults.taxPercent
      } = params;

      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));

      if (nights <= 0) {
        return { error: 'Check-out must be after check-in' };
      }

      // Calculate nightly rates considering seasonal pricing
      let nightlyBreakdown = [];
      let totalAccommodation = 0;

      for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkinDate);
        currentDate.setDate(currentDate.getDate() + i);

        let nightRate = baseRate;
        let rateName = 'Standard';

        // Check seasonal rates
        for (const season of seasonalRates) {
          const seasonStart = new Date(season.startDate);
          const seasonEnd = new Date(season.endDate);

          if (currentDate >= seasonStart && currentDate <= seasonEnd) {
            if (season.type === 'percentage') {
              nightRate = baseRate * (1 + season.modifier / 100);
            } else {
              nightRate = season.rate;
            }
            rateName = season.name;
            break;
          }
        }

        // Weekend surcharge
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday, Saturday
          nightRate *= 1.1; // 10% weekend surcharge (industry standard)
          rateName += ' (Weekend)';
        }

        nightlyBreakdown.push({
          date: currentDate.toISOString().split('T')[0],
          rate: Math.round(nightRate * 100) / 100,
          season: rateName
        });

        totalAccommodation += nightRate;
      }

      // Extra guest fees — adults fill base slots first, children cover remainder
      let totalExtraGuestFee = 0;
      if (adults !== undefined && (extraAdultFee > 0 || extraChildFee > 0)) {
        const a = parseInt(adults)   || 0;
        const c = parseInt(children) || 0;
        const remainingBase = Math.max(0, maxBaseGuests - a);
        const extraAdults   = Math.max(0, a - maxBaseGuests);
        const extraChildren = Math.max(0, c - remainingBase);
        totalExtraGuestFee  = (extraAdults * extraAdultFee + extraChildren * extraChildFee) * nights;
      } else {
        const totalGuests  = adults !== undefined
          ? (parseInt(adults) || 0) + (parseInt(children) || 0)
          : guests;
        totalExtraGuestFee = Math.max(0, totalGuests - maxBaseGuests) * extraGuestFee * nights;
      }

      // Apply special pricing rules
      let discount = 0;
      let discountLabel = '';

      for (const rule of specialRules) {
        if (rule.type === 'length_of_stay' && nights >= rule.minNights) {
          discount = totalAccommodation * (rule.discountPercent / 100);
          discountLabel = `${rule.minNights}+ night discount (${rule.discountPercent}%)`;
          break;
        }

        if (rule.type === 'early_bird') {
          const daysUntilCheckin = Math.ceil((checkinDate - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntilCheckin >= rule.minDaysAdvance) {
            discount = totalAccommodation * (rule.discountPercent / 100);
            discountLabel = `Early bird discount (${rule.discountPercent}%)`;
            break;
          }
        }

        if (rule.type === 'last_minute') {
          const daysUntilCheckin = Math.ceil((checkinDate - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntilCheckin <= rule.maxDaysAdvance) {
            discount = totalAccommodation * (rule.discountPercent / 100);
            discountLabel = `Last minute deal (${rule.discountPercent}%)`;
            break;
          }
        }
      }

      // Calculate fees
      const subtotal = totalAccommodation + totalExtraGuestFee - discount;
      const serviceFee = subtotal * (serviceFeePercent / 100);
      const taxableAmount = subtotal + serviceFee + cleaningFee;
      const tax = taxableAmount * (taxPercent / 100);
      const total = taxableAmount + tax;
      const deposit = total * (this.defaults.depositPercent / 100);

      return {
        nights,
        nightlyBreakdown,
        accommodation: Math.round(totalAccommodation * 100) / 100,
        averageNightlyRate: Math.round((totalAccommodation / nights) * 100) / 100,
        extraGuestFee: Math.round(totalExtraGuestFee * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        discountLabel,
        cleaningFee,
        serviceFee: Math.round(serviceFee * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        total: Math.round(total * 100) / 100,
        deposit: Math.round(deposit * 100) / 100,
        currency: this.defaults.currency
      };
    },

    /**
     * Check if dates are available
     */
    checkAvailability(checkin, checkout, bookedDates = [], blockedDates = []) {
      const checkinDate = new Date(checkin);
      const checkoutDate = new Date(checkout);
      const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));

      const unavailable = [];

      for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkinDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        if (bookedDates.includes(dateStr)) {
          unavailable.push({ date: dateStr, reason: 'booked' });
        } else if (blockedDates.includes(dateStr)) {
          unavailable.push({ date: dateStr, reason: 'blocked' });
        }
      }

      return {
        available: unavailable.length === 0,
        unavailable
      };
    },

    /**
     * Validate booking form data
     */
    validateBooking(data) {
      const errors = [];

      // Required fields
      if (!data.firstName?.trim()) errors.push({ field: 'firstName', message: 'First name is required' });
      if (!data.lastName?.trim()) errors.push({ field: 'lastName', message: 'Last name is required' });
      if (!data.email?.trim()) errors.push({ field: 'email', message: 'Email is required' });
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email address' });
      }
      if (!data.phone?.trim()) errors.push({ field: 'phone', message: 'Phone number is required' });

      // Date validation
      if (!data.checkin) errors.push({ field: 'checkin', message: 'Check-in date is required' });
      if (!data.checkout) errors.push({ field: 'checkout', message: 'Check-out date is required' });

      if (data.checkin && data.checkout) {
        const checkinDate = new Date(data.checkin);
        const checkoutDate = new Date(data.checkout);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkinDate < today) {
          errors.push({ field: 'checkin', message: 'Check-in date cannot be in the past' });
        }

        if (checkoutDate <= checkinDate) {
          errors.push({ field: 'checkout', message: 'Check-out must be after check-in' });
        }

        const nights = Math.ceil((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));
        if (nights < this.defaults.minStay) {
          errors.push({ field: 'checkout', message: `Minimum stay is ${this.defaults.minStay} night(s)` });
        }
        if (nights > this.defaults.maxStay) {
          errors.push({ field: 'checkout', message: `Maximum stay is ${this.defaults.maxStay} nights` });
        }
      }

      // Guest validation
      const totalGuests = (parseInt(data.adults) || 0) + (parseInt(data.children) || 0);
      if (totalGuests < 1) {
        errors.push({ field: 'adults', message: 'At least 1 guest is required' });
      }
      if (totalGuests > this.defaults.maxGuests) {
        errors.push({ field: 'adults', message: `Maximum ${this.defaults.maxGuests} guests allowed` });
      }

      return {
        valid: errors.length === 0,
        errors
      };
    },

    /**
     * Generate a booking reference
     */
    generateReference() {
      const prefix = 'TRA';
      const year = new Date().getFullYear();
      const num = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
      return `${prefix}-${year}-${num}`;
    },

    /**
     * Update the booking summary UI
     */
    updateSummaryUI(pricing, addonsTotal = 0) {
      const formatCurrency = window.CascadeApp?.formatCurrency ||
        (amount => `$${amount.toFixed(2)}`);

      const summaryEl = document.querySelector('.booking-summary');
      if (!summaryEl) return;

      // Update nights
      // Nights detail line
      const nightsLineEl = summaryEl.querySelector('#summaryNightsLine');
      if (nightsLineEl) nightsLineEl.textContent = `${pricing.nights} night${pricing.nights !== 1 ? 's' : ''} · Cascade Apartment 3`;

      // Rate label (e.g. "$289 × 4 nights")
      const rateLabelEl = summaryEl.querySelector('[data-summary="rate-label"]');
      if (rateLabelEl) rateLabelEl.textContent = `${formatCurrency(pricing.averageNightlyRate)} × ${pricing.nights} night${pricing.nights !== 1 ? 's' : ''}`;

      const nightsEl = summaryEl.querySelector('[data-summary="nights"]');
      if (nightsEl) nightsEl.textContent = `${pricing.nights} night${pricing.nights !== 1 ? 's' : ''}`;

      // Update accommodation
      const accomEl = summaryEl.querySelector('[data-summary="accommodation"]');
      if (accomEl) accomEl.textContent = formatCurrency(pricing.accommodation);

      // Extra guest fee row (hidden when zero)
      const extraGuestEl = summaryEl.querySelector('[data-summary="extra-guest"]');
      if (extraGuestEl) {
        const extraGuestRow = extraGuestEl.closest('.price-row');
        if (pricing.extraGuestFee > 0) {
          extraGuestEl.textContent = formatCurrency(pricing.extraGuestFee);
          if (extraGuestRow) extraGuestRow.style.display = '';
        } else {
          if (extraGuestRow) extraGuestRow.style.display = 'none';
        }
      }

      // Update cleaning fee
      const cleaningEl = summaryEl.querySelector('[data-summary="cleaning"]');
      if (cleaningEl) cleaningEl.textContent = formatCurrency(pricing.cleaningFee);

      // Update service fee
      const serviceEl = summaryEl.querySelector('[data-summary="service-fee"]');
      if (serviceEl) serviceEl.textContent = formatCurrency(pricing.serviceFee);

      // Update tax
      const taxEl = summaryEl.querySelector('[data-summary="tax"]');
      if (taxEl) taxEl.textContent = formatCurrency(pricing.tax);

      // Update discount
      const discountEl = summaryEl.querySelector('[data-summary="discount"]');
      if (discountEl) {
        if (pricing.discount > 0) {
          discountEl.textContent = `-${formatCurrency(pricing.discount)}`;
          discountEl.closest('.summary-row').style.display = '';
        } else {
          discountEl.closest('.summary-row').style.display = 'none';
        }
      }

      // Add-ons row
      const addonsEl = summaryEl.querySelector('[data-summary="addons"]');
      if (addonsEl) {
        const addonsRow = addonsEl.closest('.price-row');
        if (addonsTotal > 0) {
          addonsEl.textContent = formatCurrency(addonsTotal);
          if (addonsRow) addonsRow.style.display = '';
        } else {
          if (addonsRow) addonsRow.style.display = 'none';
        }
      }

      // Grand total (base pricing + add-ons)
      const grandTotal = pricing.total + addonsTotal;
      const totalEl = summaryEl.querySelector('[data-summary="total"]');
      if (totalEl) totalEl.textContent = formatCurrency(grandTotal);

      // Deposit (30% of grand total)
      const depositEl = summaryEl.querySelector('[data-summary="deposit"]');
      if (depositEl) depositEl.textContent = formatCurrency(Math.round(grandTotal * 0.3 * 100) / 100);
    }
  };

  // ============================================
  // Booking Form Handler
  // ============================================
  function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    // Auto-calculate price on date/guest change
    const dateInputs = form.querySelectorAll('input[type="date"]');
    const guestInputs = form.querySelectorAll('select[name*="guest"], select[name*="adult"], select[name*="children"], input[name*="guest"]');

    const recalculate = () => {
      const checkin  = (form.querySelector('[name="checkinDate"]')  || form.querySelector('[name="checkin"]'))?.value;
      const checkout = (form.querySelector('[name="checkoutDate"]') || form.querySelector('[name="checkout"]'))?.value;
      const adults   = parseInt((form.querySelector('[name="numAdults"]')   || form.querySelector('[name="adults"]'))?.value)   || 2;
      const children = parseInt((form.querySelector('[name="numChildren"]') || form.querySelector('[name="children"]'))?.value) || 0;

      // Keep sidebar date/guest labels in sync
      const summaryCheckin  = document.getElementById('summaryCheckin');
      const summaryCheckout = document.getElementById('summaryCheckout');
      const summaryGuests   = document.getElementById('summaryGuests');
      if (summaryCheckin && checkin) {
        const d = new Date(checkin + 'T00:00:00');
        summaryCheckin.textContent = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (summaryCheckout && checkout) {
        const d = new Date(checkout + 'T00:00:00');
        summaryCheckout.textContent = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (summaryGuests) {
        const total = adults + children;
        summaryGuests.textContent = total + ' Guest' + (total !== 1 ? 's' : '');
      }

      if (checkin && checkout) {
        const pricing = BookingEngine.calculatePrice({
          baseRate: 289,
          checkin,
          checkout,
          adults,
          children,
          guests: adults + children,
          extraAdultFee: 50,
          extraChildFee: 25,
          maxBaseGuests: 2,
        });

        if (!pricing.error) {
          let addonsTotal = 0;
          document.querySelectorAll('.addon-option input[type="checkbox"]:checked').forEach(opt => {
            const price = parseFloat(opt.value) || 0;
            const isPerNight = opt.closest('.addon-option')
              ?.querySelector('.addon-option__price')
              ?.textContent.includes('/night');
            addonsTotal += isPerNight ? price * pricing.nights : price;
          });
          BookingEngine.updateSummaryUI(pricing, addonsTotal);
        }
      }
    };

    dateInputs.forEach(input => input.addEventListener('change', recalculate));
    guestInputs.forEach(input => input.addEventListener('change', recalculate));
    document.querySelectorAll('.addon-option input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', recalculate);
    });

    // Clear error highlights when user corrects a field
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('input', () => {
        const group = field.closest('.form-group');
        if (group && group.classList.contains('form-group--error')) {
          group.classList.remove('form-group--error');
          group.querySelectorAll('.form-error').forEach(el => el.remove());
        }
      });
      field.addEventListener('change', () => {
        const group = field.closest('.form-group');
        if (group && group.classList.contains('form-group--error')) {
          group.classList.remove('form-group--error');
          group.querySelectorAll('.form-error').forEach(el => el.remove());
        }
      });
    });

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      // Normalize field names so validateBooking finds them
      const normalizedData = {
        ...data,
        checkin:  data.checkinDate  || data.checkin  || '',
        checkout: data.checkoutDate || data.checkout || '',
        adults:   data.numAdults    || data.adults   || '2',
        children: data.numChildren  || data.children || '0',
      };
      const validation = BookingEngine.validateBooking(normalizedData);

      // Clear previous errors
      form.querySelectorAll('.form-error').forEach(el => el.remove());
      form.querySelectorAll('.form-group--error').forEach(el => el.classList.remove('form-group--error'));

      if (!validation.valid) {
        // Map normalised field names back to actual form field names
        const fieldMap = { checkin: 'checkinDate', checkout: 'checkoutDate', adults: 'numAdults', children: 'numChildren' };
        let firstErrorGroup = null;

        validation.errors.forEach(error => {
          const actualName = fieldMap[error.field] || error.field;
          const field = form.querySelector(`[name="${actualName}"]`) || form.querySelector(`#${actualName}`);
          if (field) {
            const group = field.closest('.form-group');
            if (group) {
              group.classList.add('form-group--error');
              if (!firstErrorGroup) firstErrorGroup = group;
            }
            if (!field.parentElement.querySelector('.form-error')) {
              const errorEl = document.createElement('div');
              errorEl.className = 'form-error';
              errorEl.textContent = error.message;
              field.parentElement.appendChild(errorEl);
            }
          }
        });

        if (firstErrorGroup) {
          firstErrorGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        window.CascadeApp?.showToast('Please complete all required fields', 'error');
        return;
      }

      // Calculate final pricing to persist for checkout
      const adults   = parseInt(data.numAdults)   || 1;
      const children = parseInt(data.numChildren) || 0;
      const ci = data.checkinDate || data.checkin || '';
      const co = data.checkoutDate || data.checkout || '';
      const nights = (() => {
        const d1 = new Date(ci), d2 = new Date(co);
        return isNaN(d1) || isNaN(d2) ? null : Math.round((d2 - d1) / 86400000);
      })();

      const finalPricing = BookingEngine.calculatePrice({
        baseRate: 289,
        checkin: ci,
        checkout: co,
        adults,
        children,
        guests: adults + children,
        extraAdultFee: 50,
        extraChildFee: 25,
        maxBaseGuests: 2,
      });

      let addonsTotal = 0;
      const selectedAddons = [];
      document.querySelectorAll('.addon-option input[type="checkbox"]:checked').forEach(opt => {
        const price = parseFloat(opt.value) || 0;
        const label = opt.closest('.addon-option')?.querySelector('.addon-option__label')?.textContent?.trim() || opt.id;
        const isPerNight = opt.closest('.addon-option')
          ?.querySelector('.addon-option__price')
          ?.textContent.includes('/night');
        const total = isPerNight ? price * (finalPricing.nights || 0) : price;
        addonsTotal += total;
        selectedAddons.push({ id: opt.id, label, price, perNight: isPerNight, total });
      });

      const grandTotal = (finalPricing.total || 0) + addonsTotal;

      // Save booking data for checkout + confirmation pages
      sessionStorage.setItem('ca3_pending_booking', JSON.stringify({
        guestName:  ((data.firstName || '') + ' ' + (data.lastName || '')).trim(),
        guestEmail: data.email || '',
        guestPhone: data.phone || '',
        checkin:    ci,
        checkout:   co,
        nights,
        guests:     adults + children,
        specialRequests: data.specialRequests || '',
        pricing: {
          accommodation:      finalPricing.accommodation      || 0,
          extraGuestFee:      finalPricing.extraGuestFee      || 0,
          cleaningFee:        finalPricing.cleaningFee        || 0,
          serviceFee:         finalPricing.serviceFee         || 0,
          tax:                finalPricing.tax                || 0,
          discount:           finalPricing.discount           || 0,
          discountLabel:      finalPricing.discountLabel      || '',
          baseTotal:          finalPricing.total              || 0,
          addonsTotal,
          addons:             selectedAddons,
          grandTotal,
          averageNightlyRate: finalPricing.averageNightlyRate || 0,
          nights:             finalPricing.nights             || nights,
          currency:           'AUD',
        }
      }));

      // Proceed to checkout
      window.location.href = 'checkout.html';
    });
  }

  // ============================================
  // Additional Booking Options
  // ============================================
  function initBookingOptions() {
    // Add-on change listeners are wired inside initBookingForm
    // (where they share the recalculate closure).
  }

  // ============================================
  // Initialize
  // ============================================
  function init() {
    initBookingForm();
    initBookingOptions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose BookingEngine globally
  window.CascadeApp = window.CascadeApp || {};
  window.CascadeApp.BookingEngine = BookingEngine;
})();
