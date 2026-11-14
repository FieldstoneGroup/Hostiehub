/* Create a Stripe Billing monthly subscription Checkout Session.
 *
 * Nothing is sent to Stripe unless BOTH env vars are set:
 *   HOSTIE_STRIPE_PRICE_ID=price_...
 *   HOSTIE_MONTHLY_PRICE_AUD=29
 * STRIPE_SECRET_KEY is the existing platform secret (already used by the worker).
 * The publishable anon key below is the same key already shipped in the public site.
 * This route never uses the service role key.
 */
const SUPABASE_URL = 'https://hjwkycknjiyvrxbcejet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqd2t5Y2tuaml5dnJ4YmNlamV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njc3MjUsImV4cCI6MjA5MDQ0MzcyNX0.qmdp--Zw24bBlHqsXrQfFiIEv_ux0k9-1NE4RH_Ldb8';

function billingConfig() {
  var priceId = process.env.HOSTIE_STRIPE_PRICE_ID || '';
  var amount = process.env.HOSTIE_MONTHLY_PRICE_AUD;
  var amountOk = amount != null && amount !== '' && Number(amount) > 0;
  var enabled = priceId.indexOf('price_') === 0 && amountOk && Boolean(process.env.STRIPE_SECRET_KEY);
  return {
    enabled: enabled,
    trialDays: 30,
    priceLabel: amountOk ? ('$' + String(amount).replace(/\.00$/, '')) : 'TBC',
    message: enabled
      ? 'Monthly billing is on.'
      : 'Monthly billing is off until HOSTIE_STRIPE_PRICE_ID and HOSTIE_MONTHLY_PRICE_AUD are set. No card is collected.'
  };
}

function sameOrigin(value, origin) {
  if (!value) return '';
  try {
    var target = new URL(value);
    var allowed = new URL(origin);
    if (target.origin !== allowed.origin) return '';
    return target.toString();
  } catch (err) {
    return '';
  }
}

async function stripeForm(path, params) {
  var response = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  var body = await response.json();
  if (!response.ok) {
    var message = body && body.error && body.error.message ? body.error.message : 'Stripe error';
    throw new Error(message);
  }
  return body;
}

module.exports = async function handler(req, res) {
  var config = billingConfig();
  if (req.method === 'GET') {
    res.status(200).json({
      enabled: config.enabled,
      priceLabel: config.priceLabel,
      trialDays: config.trialDays,
      message: config.message,
      platformFeePercent: 0
    });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  if (!config.enabled) {
    res.status(200).json({ enabled: false, message: config.message });
    return;
  }

  var token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return;
  }

  var userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  var user = await userRes.json();
  if (!userRes.ok || !user || !user.id) {
    res.status(401).json({ error: 'Sign in required.' });
    return;
  }

  var hostRes = await fetch(
    SUPABASE_URL + '/rest/v1/hosts?id=eq.' + encodeURIComponent(user.id) + '&select=email,trial_ends_at,stripe_subscription_id,subscription_status',
    { headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token } }
  );
  var hosts = await hostRes.json();
  var host = Array.isArray(hosts) ? hosts[0] : null;
  if (!host) {
    res.status(404).json({ error: 'Host profile not found.' });
    return;
  }
  if (host.stripe_subscription_id && (host.subscription_status === 'active' || host.subscription_status === 'trialing')) {
    res.status(200).json({ enabled: true, already: true, message: 'This store already has a monthly subscription.' });
    return;
  }

  var origin = req.headers.origin || (req.headers['x-forwarded-proto'] && req.headers.host
    ? req.headers['x-forwarded-proto'] + '://' + req.headers.host
    : '');
  var successUrl = sameOrigin(req.body && req.body.success_url, origin) || (origin ? origin + '/dashboard.html?billing=success' : '');
  var cancelUrl = sameOrigin(req.body && req.body.cancel_url, origin) || (origin ? origin + '/dashboard.html?billing=cancel' : '');
  if (!successUrl || !cancelUrl) {
    res.status(400).json({ error: 'Missing return URL.' });
    return;
  }

  var trialDays = 0;
  if (host.trial_ends_at) {
    var remaining = Math.ceil((new Date(host.trial_ends_at).getTime() - Date.now()) / 86400000);
    if (remaining >= 2) trialDays = remaining;
    else if (remaining > 0) trialDays = 2;
  }

  var params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('customer_email', host.email || user.email || '');
  params.append('client_reference_id', user.id);
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('line_items[0][price]', process.env.HOSTIE_STRIPE_PRICE_ID);
  params.append('line_items[0][quantity]', '1');
  params.append('metadata[kind]', 'host_monthly');
  params.append('metadata[host_id]', user.id);
  params.append('subscription_data[metadata][kind]', 'host_monthly');
  params.append('subscription_data[metadata][host_id]', user.id);
  if (trialDays) params.append('subscription_data[trial_period_days]', String(trialDays));

  try {
    var session = await stripeForm('checkout/sessions', params);
    res.status(200).json({ enabled: true, url: session.url });
  } catch (err) {
    res.status(502).json({ enabled: true, error: err.message || 'Could not start checkout.' });
  }
};
