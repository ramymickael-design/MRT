export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });

  const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY;
  const PRO_PRICE_ID   = process.env.STRIPE_PRICE_ID;
  const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID;
  const APP_URL        = 'https://mrtjournal.com';

  try {
    const body   = await req.json();
    const userId = body.userId;
    const email  = body.email;
    const plan   = body.plan || 'pro';

    if (!userId || !email) return new Response(JSON.stringify({ error: 'Missing userId or email' }), { status: 400, headers: cors });
    if (!STRIPE_SECRET)    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not set' }), { status: 500, headers: cors });

    const priceId = plan === 'elite' ? ELITE_PRICE_ID : PRO_PRICE_ID;
    if (!priceId)  return new Response(JSON.stringify({ error: 'Price ID not set for: ' + plan }), { status: 500, headers: cors });

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('payment_method_collection', 'if_required');
    params.append('customer_email', email);
    params.append('client_reference_id', userId);
    params.append('metadata[user_id]', userId);
    params.append('metadata[plan]', plan);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('subscription_data[trial_period_days]', '7');
    params.append('subscription_data[metadata][user_id]', userId);
    params.append('subscription_data[metadata][plan]', plan);
    params.append('success_url', APP_URL + '/MRT?subscribed=true&plan=' + plan);
    params.append('cancel_url', APP_URL + '/MRT?canceled=true');
    params.append('allow_promotion_codes', 'true');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_SECRET,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) throw new Error(session.error ? session.error.message : 'Stripe error');

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}
