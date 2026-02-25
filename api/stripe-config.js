/**
 * Vercel Serverless Function — /api/stripe-config
 *
 * Returns the Stripe publishable key to the client safely.
 * The publishable key is safe to expose publicly — it cannot be used
 * to make charges. The secret key (STRIPE_SECRET_KEY) stays server-side.
 *
 * Required environment variables (set in Vercel dashboard):
 *   STRIPE_PUBLISHABLE_KEY  — pk_live_... or pk_test_... from Stripe Dashboard
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

  return res.status(200).json({ publishableKey });
}
