// api/create-checkout.js — Standard Node.js Vercel function

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY;
  const PRO_PRICE_ID   = process.env.STRIPE_PRICE_ID;
  const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID;
  const APP_URL        = 'https://mrtjournal.com';

  try {
    const { userId, email, plan = 'pro' } = req.body;

    if (!userId || !email) return res.status(400).json({ error: 'Missing userId or email' });
    if (!STRIPE_SECRET)    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set in Vercel env vars' });

    const priceId = plan === 'elite' ? ELITE_PRICE_ID : PRO_PRICE_ID;
    if (!priceId) return res.status(500).json({ error: `Price ID not set for plan: ${plan}. Check STRIPE_PRICE_ID / STRIPE_ELITE_PRICE_ID in Vercel env vars.` });

    const params = new URLSearchParams({
      'mode': 'subscription',
      'payment_method_collection': 'if_required',
      'customer_email': email,
      'client_reference_id': userId,
      'metadata[user_id]': userId,
      'metadata[plan]': plan,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'subscription_data[trial_period_days]': '7',
      'subscription_data[metadata][user_id]': userId,
      'subscription_data[metadata][plan]': plan,
      'success_url': `${APP_URL}/MRT?subscribed=true&plan=${plan}`,
      'cancel_url': `${APP_URL}/MRT?canceled=true`,
      'allow_promotion_codes': 'true',
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) throw new Error(session.error?.message || 'Stripe error');

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
