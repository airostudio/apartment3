/**
 * Cascade Apartment 3 — Stripe Payment Element
 *
 * Flow (matches Stripe's recommended integration):
 *   1. Page load  → read booking amount from sessionStorage
 *   2.            → POST /api/create-payment-intent → receive clientSecret
 *   3.            → stripe.elements({ clientSecret }) → mount 'payment' element
 *   4. Form submit → validate name + billing address
 *   5.            → stripe.confirmPayment({ elements, redirect:'if_required' })
 *   6. On success → save confirmed booking → redirect to confirmation.html
 *
 * For cards that require 3DS authentication Stripe redirects the browser
 * to the bank's auth page and then back to confirmation.html, where
 * ca3_checkout_state (saved before confirmPayment is called) is used to
 * complete the booking record.
 *
 * Environment variables (set in Vercel → Settings → Environment Variables):
 *   STRIPE_PUBLISHABLE_KEY — pk_live_... or pk_test_...
 *   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
 */

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function showError(msg) {
    const errEl = el('payment-errors');
    if (errEl) errEl.textContent = msg || '';
  }

  function setPayBtn(loading, originalHtml) {
    const btn = el('payNowBtn');
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<span style="opacity:.7">Processing payment\u2026</span>';
    } else {
      btn.disabled = false;
      if (originalHtml !== undefined) btn.innerHTML = originalHtml;
    }
  }

  function showPlaceholder(msg) {
    const container = el('payment-element');
    if (container) {
      container.innerHTML =
        '<div style="padding:16px;border:2px dashed #e5e7eb;border-radius:8px;color:#6b7280;">' +
        '<p style="font-size:14px;font-weight:500;margin:0 0 4px;">Payment unavailable</p>' +
        '<p style="font-size:12px;margin:0;line-height:1.5;">' + msg + '</p>' +
        '</div>';
    }
    const btn = el('payNowBtn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.45';
      btn.style.cursor = 'not-allowed';
    }
  }

  function generateRef() {
    return 'CA3-' + new Date().getFullYear() + '-' +
      String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  }

  // ── Main ───────────────────────────────────────────────────────────
  async function init() {
    // Only run on the checkout page
    if (!el('payment-element')) return;

    // Read pending booking (written by booking.html before redirect)
    let pending = {};
    try {
      pending = JSON.parse(sessionStorage.getItem('ca3_pending_booking') || '{}');
    } catch (_) {}

    const grand = (pending.pricing && pending.pricing.grandTotal) ||
                  pending.grandTotal || 0;
    if (!grand) return; // no amount — booking.html will redirect back

    const amountCents = Math.round(grand * 100);

    // 1. Fetch publishable key
    let publishableKey = '';
    try {
      const resp = await fetch('/api/stripe-config');
      if (resp.ok) {
        const cfg = await resp.json();
        publishableKey = cfg.publishableKey || '';
      }
    } catch (_) {}

    if (!publishableKey || publishableKey.startsWith('pk_test_your')) {
      showPlaceholder(
        'Add <code>STRIPE_PUBLISHABLE_KEY</code> and <code>STRIPE_SECRET_KEY</code> ' +
        'in Vercel \u2192 Settings \u2192 Environment Variables, then redeploy.'
      );
      return;
    }

    if (typeof Stripe === 'undefined') {
      showPlaceholder('Stripe.js failed to load. Please check your connection and refresh.');
      return;
    }

    const stripe = Stripe(publishableKey);

    // 2. Create PaymentIntent on the server and get the clientSecret
    let clientSecret = '';
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:    amountCents,
          currency:  'aud',
          email:     pending.guestEmail || '',
          checkin:   pending.checkin    || '',
          checkout:  pending.checkout   || '',
          guests:    pending.guests     || '',
          bookingId: pending.ref        || '',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not create payment session.');
      }

      const data = await res.json();
      clientSecret = data.clientSecret;
    } catch (e) {
      showPlaceholder(e.message);
      return;
    }

    // 3. Initialise Stripe Elements with the clientSecret
    const elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary:     '#0f2744',
          colorBackground:  '#ffffff',
          colorText:        '#2d2926',
          colorDanger:      '#e74c3c',
          fontFamily:       'Inter, sans-serif',
          spacingUnit:      '4px',
          borderRadius:     '8px',
        },
      },
    });

    // 4. Mount the Payment Element (handles card, Apple Pay, Google Pay, etc.)
    const paymentElement = elements.create('payment', {
      fields: {
        // We collect name and billing address in our own form fields and
        // pass them via payment_method_data in confirmPayment.
        // Tell Stripe not to duplicate those fields inside the element,
        // otherwise Stripe will reject the submission as conflicting data.
        billingDetails: {
          name:    'never',
          address: 'never',
        },
      },
    });
    paymentElement.mount('#payment-element');

    // 5. Wire up the checkout form
    const form = el('paymentForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');

      const name     = (el('cardHolderName')  && el('cardHolderName').value.trim())  || '';
      const street   = (el('billingStreet')   && el('billingStreet').value.trim())   || '';
      const city     = (el('billingCity')     && el('billingCity').value.trim())     || '';
      const state    = (el('billingState')    && el('billingState').value.trim())    || '';
      const postcode = (el('billingPostcode') && el('billingPostcode').value.trim()) || '';
      const country  = (el('billingCountry') && el('billingCountry').value) || 'AU';

      if (!name)                             { showError('Please enter the cardholder name.'); return; }
      if (!street || !city || !state || !postcode) { showError('Please complete your billing address.'); return; }

      const originalHtml = el('payNowBtn') && el('payNowBtn').innerHTML;
      setPayBtn(true);

      // Generate a booking reference now so we can stash it before the
      // confirmPayment call (needed if Stripe redirects for 3DS auth).
      const ref = generateRef();

      // Persist checkout state so confirmation.html can recover the booking
      // details if the browser is redirected away by Stripe for 3DS.
      sessionStorage.setItem('ca3_checkout_state', JSON.stringify({
        ref,
        amountCents,
        pending,
      }));

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Required by Stripe even when redirect:'if_required'.
          // Used as fallback for payment methods that DO redirect.
          return_url: window.location.origin + '/confirmation.html',
          payment_method_data: {
            billing_details: {
              name,
              email: pending.guestEmail || '',
              address: {
                line1:       street,
                city,
                state,
                postal_code: postcode,
                country,
              },
            },
          },
        },
        redirect: 'if_required',
      });

      if (error) {
        // Payment failed or was declined — show the message Stripe provides
        showError(error.message);
        setPayBtn(false, originalHtml);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        await onPaymentSuccess({ ref, amountCents, pending, paymentIntent });
      } else {
        showError('Payment could not be completed. Please try again.');
        setPayBtn(false, originalHtml);
      }
    });
  }

  // ── Post-payment handling ──────────────────────────────────────────
  async function onPaymentSuccess({ ref, amountCents, pending, paymentIntent }) {
    const totalFormatted = new Intl.NumberFormat('en-AU', {
      style: 'currency', currency: 'AUD',
    }).format(amountCents / 100);

    const confirmedBooking = Object.assign({}, pending, {
      ref,
      paymentIntentId: paymentIntent.id,
      guestName:       pending.guestName  || 'Guest',
      guestEmail:      pending.guestEmail || '',
      totalAmount:     totalFormatted,
      paymentStatus:   'paid',
      confirmedAt:     new Date().toISOString(),
    });

    // Persist for confirmation.html to read
    sessionStorage.setItem('ca3_confirmed_booking', JSON.stringify(confirmedBooking));

    // Upgrade the pending booking that was written on booking.html to 'confirmed',
    // or add a new confirmed booking if no pending entry is found.
    if (window.CA3Data) {
      const pendingId = sessionStorage.getItem('ca3_pending_id');
      if (pendingId) {
        window.CA3Data.updateBooking(pendingId, {
          id:              ref,
          ref,
          guestName:       confirmedBooking.guestName,
          guestEmail:      confirmedBooking.guestEmail,
          status:          'confirmed',
          total:           amountCents / 100,
          paid:            amountCents / 100,
          paymentIntentId: paymentIntent.id,
          confirmedAt:     confirmedBooking.confirmedAt,
        });
        sessionStorage.removeItem('ca3_pending_id');
      } else {
        // Fallback: no pending booking found — add a fresh confirmed booking
        window.CA3Data.addBooking({
          id:              ref,
          ref,
          guestName:       confirmedBooking.guestName,
          guestEmail:      confirmedBooking.guestEmail,
          guestPhone:      pending.guestPhone || '',
          checkIn:         pending.checkin    || '',
          checkOut:        pending.checkout   || '',
          nights:          pending.nights     || 0,
          guests:          pending.guests     || 1,
          status:          'confirmed',
          source:          'direct',
          baseRate:        (pending.pricing && pending.pricing.averageNightlyRate) || 0,
          total:           amountCents / 100,
          paid:            amountCents / 100,
          deposit:         0,
          paymentIntentId: paymentIntent.id,
          notes:           pending.specialRequests || '',
        });
      }
    }

    window.location.href = 'confirmation.html?ref=' + encodeURIComponent(ref);
  }

  // ── Boot ───────────────────────────────────────────────────────────
  function boot() {
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.CascadeApp = window.CascadeApp || {};

})();
