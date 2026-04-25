// api/create-checkout.js
export const config = { runtime: 'edge' };

const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY;
const PRO_PRICE_ID   = process.env.STRIPE_PRICE_ID;
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID;
const APP_URL        = 'https://mrtjournal.com';

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ['https://mrtjournal.com','https://www.mrtjournal.com','https://mrt-one.vercel.app'];
  const co = allowed.includes(origin) ? origin : allowed[0];
  const cors = {'Content-Type':'application/json','Access-Control-Allow-Origin':co,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method!=='POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:cors});

  try {
    const { userId, email, plan='pro' } = await req.json();
    if (!userId||!email) return new Response(JSON.stringify({error:'Missing userId or email'}),{status:400,headers:cors});
    const priceId = plan==='elite' ? ELITE_PRICE_ID : PRO_PRICE_ID;
    if (!priceId) return new Response(JSON.stringify({error:`Price not configured: ${plan}`}),{status:500,headers:cors});

    const params = new URLSearchParams({
      'mode':'subscription',
      'payment_method_collection':'if_required',
      'customer_email':email,
      'client_reference_id':userId,
      'metadata[user_id]':userId,
      'metadata[plan]':plan,
      'line_items[0][price]':priceId,
      'line_items[0][quantity]':'1',
      'subscription_data[trial_period_days]':'7',
      'subscription_data[metadata][user_id]':userId,
      'subscription_data[metadata][plan]':plan,
      'success_url':`${APP_URL}/MRT?subscribed=true&plan=${plan}`,
      'cancel_url':`${APP_URL}/MRT?canceled=true`,
      'allow_promotion_codes':'true',
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{'Authorization':`Bearer ${STRIPE_SECRET}`,'Content-Type':'application/x-www-form-urlencoded'},
      body:params.toString(),
    });
    const session = await res.json();
    if (!res.ok) throw new Error(session.error?.message||'Stripe error');
    return new Response(JSON.stringify({url:session.url}),{status:200,headers:cors});
  } catch(err) {
    return new Response(JSON.stringify({error:err.message}),{status:500,headers:cors});
  }
}
