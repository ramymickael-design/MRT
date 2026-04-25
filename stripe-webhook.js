// api/stripe-webhook.js
export const config = { runtime: 'edge' };

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

async function upsertSub(userId, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_SERVICE,'Authorization':`Bearer ${SUPABASE_SERVICE}`,'Prefer':'return=minimal'},
    body:JSON.stringify({...fields, updated_at:new Date().toISOString()}),
  });
  if (!res.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_SERVICE,'Authorization':`Bearer ${SUPABASE_SERVICE}`},
      body:JSON.stringify({user_id:userId,...fields}),
    });
  }
}

export default async function handler(req) {
  if (req.method!=='POST') return new Response('Method not allowed',{status:405});
  let event;
  try { event = JSON.parse(await req.text()); } catch { return new Response('Bad JSON',{status:400}); }

  const obj = event.data.object;
  const userId = obj.metadata?.user_id || obj.client_reference_id;
  const plan   = obj.metadata?.plan || obj.subscription_data?.metadata?.plan || 'pro';

  switch(event.type) {
    case 'checkout.session.completed':
      await upsertSub(userId,{
        status:'trialing', plan,
        stripe_customer_id:obj.customer,
        stripe_subscription_id:obj.subscription,
        trial_end:obj.trial_end ? new Date(obj.trial_end*1000).toISOString() : null,
      });
      break;
    case 'customer.subscription.updated':
      await upsertSub(userId,{
        status:obj.status,
        plan: obj.metadata?.plan || plan,
        stripe_subscription_id:obj.id,
        trial_end:obj.trial_end ? new Date(obj.trial_end*1000).toISOString() : null,
        current_period_end:new Date(obj.current_period_end*1000).toISOString(),
      });
      break;
    case 'customer.subscription.deleted':
      await upsertSub(userId,{status:'canceled',stripe_subscription_id:obj.id});
      break;
    case 'invoice.payment_failed':
      await upsertSub(userId,{status:'past_due'});
      break;
  }
  return new Response(JSON.stringify({received:true}),{status:200,headers:{'Content-Type':'application/json'}});
}
