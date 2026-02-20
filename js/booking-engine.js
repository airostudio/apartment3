/**
 * TrendAccom - Booking Engine
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
        extraGuestFee = 0,
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

      // Extra guest fees
      const extraGuests = Math.max(0, guests - maxBaseGuests);
      const totalExtraGuestFee = extraGuests * extraGuestFee * nights;

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
    updateSummaryUI(pricing) {
      const formatCurrency = window.TrendAccom?.formatCurrency ||
        (amount => `$${amount.toFixed(2)}`);

      const summaryEl = document.querySelector('.booking-summary');
      if (!summaryEl) return;

      // Update nights
      const nightsEl = summaryEl.querySelector('[data-summary="nights"]');
      if (nightsEl) nightsEl.textContent = `${pricing.nights} night${pricing.nights !== 1 ? 's' : ''}`;

      // Update accommodation
      const accomEl = summaryEl.querySelector('[data-summary="accommodation"]');
      if (accomEl) accomEl.textContent = formatCurrency(pricing.accommodation);

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

      // Update total
      const totalEl = summaryEl.querySelector('[data-summary="total"]');
      if (totalEl) totalEl.textContent = formatCurrency(pricing.total);

      // Update deposit
      const depositEl = summaryEl.querySelector('[data-summary="deposit"]');
      if (depositEl) depositEl.textContent = formatCurrency(pricing.deposit);
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
      const checkin = form.querySelector('[name="checkin"]')?.value;
      const checkout = form.querySelector('[name="checkout"]')?.value;
      const adults = parseInt(form.querySelector('[name="adults"]')?.value) || 2;
      const children = parseInt(form.querySelector('[name="children"]')?.value) || 0;

      if (checkin && checkout) {
        const pricing = BookingEngine.calculatePrice({
          baseRate: 289, // Would come from property data
          checkin,
          checkout,
          guests: adults + children
        });

        if (!pricing.error) {
          BookingEngine.updateSummaryUI(pricing);
        }
      }
    };

    dateInputs.forEach(input => input.addEventListener('change', recalculate));
    guestInputs.forEach(input => input.addEventListener('change', recalculate));

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      const validation = BookingEngine.validateBooking(data);

      // Clear previous errors
      form.querySelectorAll('.form-error').forEach(el => el.remove());
      form.querySelectorAll('.form-input, .form-select').forEach(el => {
        el.style.borderColor = '';
      });

      if (!validation.valid) {
        validation.errors.forEach(error => {
          const field = form.querySelector(`[name="${error.field}"]`);
          if (field) {
            field.style.borderColor = 'var(--color-danger)';
            const errorEl = document.createElement('div');
            errorEl.className = 'form-error';
            errorEl.textContent = error.message;
            field.parentElement.appendChild(errorEl);
          }
        });

        window.TrendAccom?.showToast('Please correct the errors in the form', 'error');
        return;
      }

      // Proceed to checkout
      window.location.href = 'checkout.html';
    });
  }

  // ============================================
  // Additional Booking Options
  // ============================================
  function initBookingOptions() {
    document.querySelectorAll('.booking-option input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        // Recalculate with options
        const checkin = document.querySelector('[name="checkin"]')?.value;
        const checkout = document.querySelector('[name="checkout"]')?.value;

        if (checkin && checkout) {
          let addOns = 0;
          document.querySelectorAll('.booking-option input:checked').forEach(opt => {
            addOns += parseFloat(opt.dataset.price) || 0;
          });
          // Add-on total would be included in the summary
        }
      });
    });
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
  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.BookingEngine = BookingEngine;
})();
