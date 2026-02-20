/**
 * TrendAccom - Stripe Connect Integration
 * Handles: Stripe Connect onboarding, payment processing,
 * payment intents, and checkout flow
 *
 * NOTE: This module requires the Stripe.js library to be loaded:
 * <script src="https://js.stripe.com/v3/"></script>
 *
 * For Stripe Connect, you need:
 * 1. A Stripe platform account with Connect enabled
 * 2. Each property owner connects their Stripe account
 * 3. Payments go through the platform and are split to connected accounts
 */

(function() {
  'use strict';

  const StripeConnect = {
    stripe: null,
    elements: null,
    cardElement: null,

    // Configuration (would be set from server/environment)
    config: {
      publishableKey: 'pk_test_your_stripe_publishable_key',
      locale: 'en-AU',
      currency: 'aud',
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#0f2744',
          colorBackground: '#ffffff',
          colorText: '#2d2926',
          colorDanger: '#e74c3c',
          fontFamily: 'Inter, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px',
        }
      }
    },

    /**
     * Initialize Stripe
     */
    init() {
      if (typeof Stripe === 'undefined') {
        console.warn('Stripe.js not loaded. Payment processing unavailable.');
        this.showPlaceholder();
        return;
      }

      try {
        this.stripe = Stripe(this.config.publishableKey);
        this.createElements();
      } catch (e) {
        console.warn('Failed to initialize Stripe:', e.message);
        this.showPlaceholder();
      }
    },

    /**
     * Create Stripe Elements for card input
     */
    createElements() {
      const cardContainer = document.getElementById('stripe-card-element');
      if (!cardContainer || !this.stripe) return;

      this.elements = this.stripe.elements({
        appearance: this.config.appearance
      });

      this.cardElement = this.elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#2d2926',
            fontFamily: 'Inter, sans-serif',
            '::placeholder': {
              color: '#b8b0a4',
            },
          },
          invalid: {
            color: '#e74c3c',
          },
        }
      });

      this.cardElement.mount('#stripe-card-element');

      // Handle real-time validation
      this.cardElement.on('change', (event) => {
        const errorEl = document.getElementById('card-errors');
        if (errorEl) {
          errorEl.textContent = event.error ? event.error.message : '';
        }
      });
    },

    /**
     * Show placeholder when Stripe is not loaded
     */
    showPlaceholder() {
      const cardContainer = document.getElementById('stripe-card-element');
      if (cardContainer) {
        cardContainer.innerHTML = `
          <div style="padding: 16px; border: 2px dashed var(--color-light); border-radius: 8px; text-align: center; color: var(--color-gray);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px;">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <p style="font-size: 14px; margin-bottom: 4px;">Stripe Payment Element</p>
            <p style="font-size: 12px; opacity: 0.7;">Connect your Stripe account to enable payments</p>
          </div>
        `;
      }
    },

    /**
     * Process payment (would communicate with your server)
     * In production, create a PaymentIntent on your server first
     */
    async processPayment(bookingData) {
      if (!this.stripe || !this.cardElement) {
        throw new Error('Stripe not initialized');
      }

      // In production, this would:
      // 1. Send booking data to your server
      // 2. Server creates a PaymentIntent with Stripe Connect params
      // 3. Return the client_secret
      // 4. Confirm payment on the client side

      const billingDetails = {
        name: bookingData.cardholderName,
        email: bookingData.email,
        address: {
          line1: bookingData.address,
          city: bookingData.city,
          state: bookingData.state,
          postal_code: bookingData.postcode,
          country: bookingData.country || 'AU',
        }
      };

      // Simulate server call for PaymentIntent
      // In production, replace with actual API call:
      // const response = await fetch('/api/create-payment-intent', { ... });
      // const { clientSecret } = await response.json();

      console.log('Payment would be processed with:', {
        amount: bookingData.amount,
        currency: this.config.currency,
        connectedAccountId: bookingData.propertyStripeAccount,
        applicationFeeAmount: Math.round(bookingData.amount * 0.05), // 5% platform fee
        billingDetails
      });

      // Simulate successful payment
      return {
        success: true,
        paymentIntentId: 'pi_simulated_' + Date.now(),
        status: 'succeeded'
      };
    },

    /**
     * Stripe Connect Onboarding for property owners
     * Creates an Account Link for the Connect onboarding flow
     */
    async startOnboarding() {
      // In production, this would:
      // 1. Call your server to create a Connect account
      // 2. Server calls Stripe to create an Account Link
      // 3. Redirect the property owner to Stripe's onboarding

      console.log('Starting Stripe Connect onboarding...');

      // Simulated redirect URL
      const onboardingUrl = 'https://connect.stripe.com/setup/s/demo';

      window.TrendAccom?.showToast('Redirecting to Stripe Connect...', 'info');

      // In production: window.location.href = onboardingUrl;
      return { url: onboardingUrl };
    },

    /**
     * Check Connect account status
     */
    async checkAccountStatus(accountId) {
      // In production, call your server to check the connected account status
      return {
        accountId: accountId || 'acct_demo',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        businessType: 'company',
        created: '2026-01-15'
      };
    },

    /**
     * Create a refund
     */
    async createRefund(paymentIntentId, amount, reason) {
      console.log('Refund would be processed:', {
        paymentIntentId,
        amount,
        reason
      });

      return {
        success: true,
        refundId: 'rf_simulated_' + Date.now(),
        status: 'succeeded'
      };
    }
  };

  // ============================================
  // Checkout Form Handler
  // ============================================
  function initCheckoutForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
      }

      try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const result = await StripeConnect.processPayment({
          cardholderName: data.cardholderName,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          postcode: data.postcode,
          country: data.country,
          amount: parseInt(data.amount) || 0
        });

        if (result.success) {
          window.TrendAccom?.showToast('Payment successful!', 'success');
          window.location.href = 'confirmation.html?ref=' +
            (window.TrendAccom?.BookingEngine?.generateReference() || 'TRA-2026-00001');
        }
      } catch (error) {
        window.TrendAccom?.showToast(error.message || 'Payment failed. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // ============================================
  // Stripe Connect Admin Handler
  // ============================================
  function initStripeAdmin() {
    const connectBtn = document.getElementById('stripeConnectBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        await StripeConnect.startOnboarding();
      });
    }

    const disconnectBtn = document.getElementById('stripeDisconnectBtn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to disconnect your Stripe account?')) {
          window.TrendAccom?.showToast('Stripe account disconnected', 'warning');
        }
      });
    }
  }

  // ============================================
  // Initialize
  // ============================================
  function init() {
    StripeConnect.init();
    initCheckoutForm();
    initStripeAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.StripeConnect = StripeConnect;
})();
