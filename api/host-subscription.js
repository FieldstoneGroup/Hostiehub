/* Create or resize the host subscription.
 *
 * HOSTIE_STRIPE_PRICE_ID defaults to price_1UbZFJFGh2TNwWGYsQhTzePk
 * (product prod_VcosxU73288ZLQ, account acct_1TH1K4FGh2TNwWGY).
 * STRIPE_SECRET_KEY must be a secret key for that same account.
 * The price is licensed, monthly, AUD, tiers_mode=volume.
 * Quantity is the host's property count (at least 1).
 * POST { action: "sync-quantity" } updates that quantity when properties change.
 * STRIPE_SECRET_KEY is the existing platform secret (already used by the worker).
 * The publishable anon key below is the same key already shipped in the public site.
 * This route never uses the service role key.
 */
const STRIPE_ACCOUNT_ID = 'acct_1TH1K4FGh2TNwWGY';
const STRIPE_PRODUCT_ID = 'prod_VcosxU73288ZLQ';
const STRIPE_PRICE_ID = 'price_1UbZFJFGh2TNwWGYsQhTzePk';
const SUPABASE_URL = 'https://hjwkycknjiyvrxbcejet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqd2t5Y2tuaml5dnJ4YmNlamV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njc3MjUsImV4cCI6MjA5MDQ0MzcyNX0.qmdp--Zw24bBlHqsXrQfFiIEv_ux0k9-1NE4RH_Ldb8';

function configuredPriceId() {
  return process.env.HOSTIE_STRIPE_PRICE_ID || STRIPE_PRICE_ID;
}

function billingConfig() {
  var priceId = configuredPriceId();
  var enabled = priceId.indexOf('price_') === 0 && Boolean(process.env.STRIPE_SECRET_KEY);
  return {
    enabled: enabled,
    trialDays: 30,
    priceId: priceId,
    priceLabel: 'From $6',
    accountId: STRIPE_ACCOUNT_ID,
    productId: STRIPE_PRODUCT_ID,
    message: enabled
      ? 'Per-property billing is on. The trial is 30 days and does not collect a card.'
      : 'Billing is off until STRIPE_SECRET_KEY for account ' + STRIPE_ACCOUNT_ID + ' is available. No card is collected.'
  };
}

function billableQuantity(count) {
  var n = Number(count) || 0;
  return n > 0 ? n : 1;
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

async function stripeRequest(method, path, params) {
  var response = await fetch('https://api.stripe.com/v1/' + path, {
    method: method,
    headers: {
      authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      ...(params ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
    },
    body: params || undefined
  });
  var body = await response.json();
  if (!response.ok) {
    var message = body && body.error && body.error.message ? body.error.message : 'Stripe error';
    throw new Error(message);
  }
  return body;
}

async function authedHost(token) {
  var userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token }
  });
  var user = await userRes.json();
  if (!userRes.ok || !user || !user.id) return null;
  var hostRes = await fetch(
    SUPABASE_URL + '/rest/v1/hosts?id=eq.' + encodeURIComponent(user.id) + '&select=email,trial_ends_at,stripe_subscription_id,subscription_status',
    { headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token } }
  );
  var hosts = await hostRes.json();
  var host = Array.isArray(hosts) ? hosts[0] : null;
  var propRes = await fetch(
    SUPABASE_URL + '/rest/v1/properties?host_id=eq.' + encodeURIComponent(user.id) + '&select=id',
    { headers: { apikey: SUPABASE_ANON_KEY, authorization: 'Bearer ' + token } }
  );
  var properties = await propRes.json();
  var count = Array.isArray(properties) ? properties.length : 0;
  return { user: user, host: host, quantity: billableQuantity(count), propertyCount: count };
}

async function syncStripeQuantity(host, quantity) {
  var subscription = await stripeRequest('GET', 'subscriptions/' + encodeURIComponent(host.stripe_subscription_id));
  var items = subscription.items && subscription.items.data ? subscription.items.data : [];
  var priceId = configuredPriceId();
  var item = items.find(function (row) { return row.price && row.price.id === priceId; }) || items[0];
  if (!item) throw new Error('Subscription has no price item.');
  if (Number(item.quantity) === quantity) return { updated: false, quantity: quantity };
  var params = new URLSearchParams();
  params.append('quantity', String(quantity));
  params.append('proration_behavior', 'create_prorations');
  await stripeRequest('POST', 'subscription_items/' + encodeURIComponent(item.id), params);
  return { updated: true, quantity: quantity };
}

module.exports = async function handler(req, res) {
  var config = billingConfig();
  if (req.method === 'GET') {
    res.status(200).json({
      enabled: config.enabled,
      priceLabel: config.priceLabel,
      priceId: config.priceId,
      accountId: config.accountId,
      trialDays: config.trialDays,
      message: config.message,
      platformFeePercent: 0,
      productId: config.productId,
      tiers: [
        { upTo: 2, unitAud: 10 },
        { upTo: 10, unitAud: 8 },
        { upTo: null, unitAud: 6 }
      ]
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

  var account = await authedHost(token);
  if (!account || !account.host) {
    res.status(account ? 404 : 401).json({ error: account ? 'Host profile not found.' : 'Sign in required.' });
    return;
  }
  var user = account.user;
  var host = account.host;
  var action = (req.body && req.body.action) || 'checkout';

  if (action === 'sync-quantity') {
    if (!host.stripe_subscription_id || (host.subscription_status !== 'active' && host.subscription_status !== 'trialing')) {
      res.status(200).json({ enabled: true, updated: false, quantity: account.quantity, propertyCount: account.propertyCount });
      return;
    }
    try {
      var synced = await syncStripeQuantity(host, account.quantity);
      res.status(200).json(Object.assign({ enabled: true, propertyCount: account.propertyCount }, synced));
    } catch (err) {
      res.status(502).json({ enabled: true, error: err.message || 'Could not update quantity.' });
    }
    return;
  }

  if (host.stripe_subscription_id && (host.subscription_status === 'active' || host.subscription_status === 'trialing')) {
    res.status(200).json({ enabled: true, already: true, quantity: account.quantity, message: 'This store already has a monthly subscription.' });
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

  var params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('payment_method_collection', 'if_required');
  params.append('customer_email', host.email || user.email || '');
  params.append('client_reference_id', user.id);
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('line_items[0][price]', configuredPriceId());
  params.append('line_items[0][quantity]', String(account.quantity));
  params.append('metadata[kind]', 'host_monthly');
  params.append('metadata[host_id]', user.id);
  params.append('metadata[property_count]', String(account.propertyCount));
  params.append('subscription_data[trial_period_days]', '30');
  params.append('subscription_data[metadata][kind]', 'host_monthly');
  params.append('subscription_data[metadata][host_id]', user.id);

  try {
    var session = await stripeRequest('POST', 'checkout/sessions', params);
    res.status(200).json({ enabled: true, url: session.url, quantity: account.quantity });
  } catch (err) {
    res.status(502).json({ enabled: true, error: err.message || 'Could not start checkout.' });
  }
};
