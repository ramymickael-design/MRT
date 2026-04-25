const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

async function upsertSub(userId, fields) {
  const url = SUPABASE_URL + '/rest/v1/subscriptions?user_id=eq.' + userId;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE,
    'Prefer': 'resolution=merge-duplicates',
  };
  await fetch(SUPABASE_URL + '/rest/v1/subscriptions', {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, ...fields, updated_at: new Date().toISOString() }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const obj   = event.data && event.data.object;
    if (!obj) return res.status(400).json({ error: 'No event object' });

    const userId = (obj.metadata && obj.metadata.user_id) || obj.client_reference_id;
    const plan   = (obj.metadata && obj.metadata.plan) || 'pro';

    if (!userId) return res.status(200).json({ received: true });

    if (event.type === 'checkout.session.completed') {
      await upsertSub(userId, {
        status: 'trialing', plan,
        stripe_customer_id: obj.customer,
        stripe_subscription_id: obj.subscription,
        trial_end: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
      });
    } else if (event.type === 'customer.subscription.updated') {
      await upsertSub(userId, {
        status: obj.status,
        plan: (obj.metadata && obj.metadata.plan) || plan,
        stripe_subscription_id: obj.id,
        trial_end: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
        current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
      });
    } else if (event.type === 'customer.subscription.deleted') {
      await upsertSub(userId, { status: 'canceled' });
    } else if (event.type === 'invoice.payment_failed') {
      await upsertSub(userId, { status: 'past_due' });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
