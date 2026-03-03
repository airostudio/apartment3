/**
 * Vercel Serverless Function — /api/create-payment-intent
 *
 * Creates a Stripe PaymentIntent and returns the client_secret so the
 * browser can confirm the payment directly with Stripe via the
 * Payment Element (stripe.confirmPayment).
 *
 * Required environment variables (set in Vercel dashboard):
 *   STRIPE_SECRET_KEY      — sk_live_... or sk_test_... from Stripe Dashboard
 *   STRIPE_PUBLISHABLE_KEY — pk_live_... or pk_test_... from Stripe Dashboard
 */

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { STRIPE_SECRET_KEY } = process.env;

  if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    return res.status(500).json({ error: 'Payment processing is not configured.' });
  }

  const { amount, currency = 'aud', bookingId, email, checkin, checkout, guests } = req.body;

  if (!amount || typeof amount !== 'number' || amount < 50) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }

  try {
    const amountCents = Math.round(amount);

    // Use automatic_payment_methods so the Payment Element can offer all
    // payment methods enabled in your Stripe Dashboard for this currency.
    // allow_redirects=never restricts to card-only (no redirect-based methods
    // like Klarna/Afterpay), keeping the checkout flow fully on-page.
    const params = new URLSearchParams({
      amount:                                      String(amountCents),
      currency:                                    currency.toLowerCase(),
      'automatic_payment_methods[enabled]':        'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      'metadata[booking_id]':                      bookingId || '',
      'metadata[property]':                        'Cascade Apartment 3',
      'metadata[checkin]':                         checkin  || '',
      'metadata[checkout]':                        checkout || '',
      'metadata[guests]':                          String(guests || ''),
    });

    if (email) {
      params.set('receipt_email', email);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe error:', data.error);
      return res.status(stripeResponse.status).json({
        error: data.error?.message || 'Payment session could not be created.'
      });
    }

    return res.status(200).json({ clientSecret: data.client_secret });

  } catch (err) {
    console.error('create-payment-intent error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
