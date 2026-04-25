// api/stripe-webhook.js — Standard Node.js Vercel function

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SUPABASE_URL     = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

  async function upsertSub(userId, fields) {
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    });
    // If no row to patch, insert instead
    if (patch.status === 404 || patch.status === 200) {
      try {
        const count = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=id`, {
          headers: { 'apikey': SUPABASE_SERVICE, 'Authorization': `Bearer ${SUPABASE_SERVICE}` }
        });
        const rows = await count.json();
        if (!rows.length) {
          await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE, 'Authorization': `Bearer ${SUPABASE_SERVICE}` },
            body: JSON.stringify({ user_id: userId, ...fields }),
          });
        }
      } catch(e) { console.error('Insert fallback error:', e); }
    }
  }

  try {
    const event = req.body;
    const obj   = event.data?.object;
    if (!obj) return res.status(400).json({ error: 'No event object' });

    const userId = obj.metadata?.user_id || obj.client_reference_id;
    const plan   = obj.metadata?.plan || 'pro';

    if (!userId) return res.status(200).json({ received: true }); // ignore events without user

    switch (event.type) {
      case 'checkout.session.completed':
        await upsertSub(userId, {
          status: 'trialing',
          plan,
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          trial_end: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
        });
        break;
      case 'customer.subscription.updated':
        await upsertSub(userId, {
          status: obj.status,
          plan: obj.metadata?.plan || plan,
          stripe_subscription_id: obj.id,
          trial_end: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
          current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
        });
        break;
      case 'customer.subscription.deleted':
        await upsertSub(userId, { status: 'canceled', stripe_subscription_id: obj.id });
        break;
      case 'invoice.payment_failed':
        await upsertSub(userId, { status: 'past_due' });
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
