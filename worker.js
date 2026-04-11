export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, X-Service, stripe-signature' } });
    }

    const service = request.headers.get('X-Service');

    // ── STRIPE WEBHOOK ──
    if (service === 'stripe-webhook' || request.headers.get('stripe-signature')) {
      const body = await request.text();
      const sig = request.headers.get('stripe-signature');

      const encoder = new TextEncoder();
      const parts = sig.split(',');
      const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
      const v1 = parts.find(p => p.startsWith('v1=')).split('=')[1];

      const signedPayload = `${timestamp}.${body}`;
      const key = await crypto.subtle.importKey('raw', encoder.encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
      const expectedSig = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (expectedSig !== v1) {
        return new Response('Invalid signature', { status: 400 });
      }

      const event = JSON.parse(body);
      console.log('Stripe webhook event:', event.type);

      if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
        const customerEmail = event.data.object.customer_email || event.data.object.customer_details?.email;
        const amount = event.data.object.amount_total || event.data.object.plan?.amount;
        const plan = amount >= 19900 ? 'pro' : 'host';

        if (customerEmail) {
          const supabaseUrl = 'https://hjwkycknjiyvrxbcejet.supabase.co';
          const r = await fetch(`${supabaseUrl}/rest/v1/hosts?email=eq.${encodeURIComponent(customerEmail)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ plan, is_active: true })
          });
          console.log('Supabase update status:', r.status, 'email:', customerEmail, 'plan:', plan);
        }
      }

      return new Response('OK', { status: 200 });
    }

    // ── NEW HOST SIGNUP NOTIFICATION ──
    if (service === 'new-host-notify') {
      const body = await request.json();
      const record = body.record || {};
      const signedUp = record.created_at ? new Date(record.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Hostie Hub <hello@hostiehub.com.au>',
          to: ['newuser@hostiehub.com.au'],
          subject: '🎉 New host signed up — ' + (record.full_name || record.email || 'Unknown'),
          html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f4f6f5;border-radius:16px">
  <div style="background:linear-gradient(135deg,#2C6E6A,#1d4d4a);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:40px;margin-bottom:8px">🎉</div>
    <div style="font-size:20px;font-weight:700;color:white;font-family:Georgia,serif">New host signed up!</div>
  </div>
  <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px">
    <table cellpadding="10" style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px;width:35%">Name</td><td style="font-weight:600;font-size:14px">${record.full_name || '—'}</td></tr>
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Email</td><td style="font-size:14px">${record.email || '—'}</td></tr>
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Store name</td><td style="font-size:14px">${record.store_name || '—'}</td></tr>
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Username</td><td style="font-size:14px">${record.username ? 'hostiehub.com.au/store/' + record.username : '—'}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px">Signed up</td><td style="font-size:14px">${signedUp} AEST</td></tr>
    </table>
  </div>
  <div style="text-align:center">
    <a href="https://hostiehub.com.au/admin.html" style="background:#2C6E6A;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px">View in Admin →</a>
  </div>
</div>`
        })
      });

      return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // ── NEW PARTNER SIGNUP NOTIFICATION ──
    if (service === 'new-partner-notify') {
      const body = await request.json();
      const record = body.record || {};
      const signedUp = record.created_at ? new Date(record.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Hostie Hub <hello@hostiehub.com.au>',
          to: ['newuser@hostiehub.com.au'],
          subject: '🤝 New partner signed up — ' + (record.business_name || record.email || 'Unknown'),
          html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f4f6f5;border-radius:16px">
  <div style="background:linear-gradient(135deg,#E8A838,#d4952e);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:40px;margin-bottom:8px">🤝</div>
    <div style="font-size:20px;font-weight:700;color:white;font-family:Georgia,serif">New partner signed up!</div>
  </div>
  <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px">
    <table cellpadding="10" style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px;width:35%">Business</td><td style="font-weight:600;font-size:14px">${record.business_name || '—'}</td></tr>
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Email</td><td style="font-size:14px">${record.email || '—'}</td></tr>
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Phone</td><td style="font-size:14px">${record.phone || '—'}</td></tr>
      <tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Postcodes</td><td style="font-size:14px">${Array.isArray(record.postcodes) ? record.postcodes.join(', ') : '—'}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px">Signed up</td><td style="font-size:14px">${signedUp} AEST</td></tr>
    </table>
  </div>
  <div style="text-align:center">
    <a href="https://hostiehub.com.au/admin.html" style="background:#E8A838;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px">View in Admin →</a>
  </div>
</div>`
        })
      });

      return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (request.method !== 'POST') {
      return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const body = await request.json();
    let responseData;

    if (service === 'resend') {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify(body)
      });
      responseData = await r.json();

    } else if (service === 'stripe-create-account') {
      const r = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ type: 'express', country: 'AU', email: body.email, 'capabilities[card_payments][requested]': 'true', 'capabilities[transfers][requested]': 'true' })
      });
      responseData = await r.json();

    } else if (service === 'stripe-connect-url') {
      const r = await fetch('https://api.stripe.com/v1/account_links', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ account: body.account_id, return_url: body.return_url, refresh_url: body.refresh_url, type: 'account_onboarding' })
      });
      responseData = await r.json();

    } else if (service === 'stripe-checkout') {
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('success_url', body.success_url);
      params.append('cancel_url', body.cancel_url);
      if (body.guest_email) params.append('customer_email', body.guest_email);
      params.append('payment_intent_data[application_fee_amount]', '0');
      body.items.forEach((item, i) => {
        params.append(`line_items[${i}][price_data][currency]`, 'aud');
        params.append(`line_items[${i}][price_data][product_data][name]`, item.name);
        params.append(`line_items[${i}][price_data][unit_amount]`, Math.round(item.price * 100));
        params.append(`line_items[${i}][quantity]`, '1');
      });
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Account': body.stripe_account_id },
        body: params
      });
      responseData = await r.json();

    } else {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body)
      });
      responseData = await r.json();
    }

    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  },

  // ── SCHEDULED TRIAL REMINDER ──
  async scheduled(event, env, ctx) {
    const supabaseUrl = 'https://hjwkycknjiyvrxbcejet.supabase.co';

    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();

    const r = await fetch(`${supabaseUrl}/rest/v1/hosts?trial_ends_at=lte.${in3days}&trial_ends_at=gte.${tomorrow}&plan=is.null&select=email,full_name,username,trial_ends_at`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    });

    const hosts = await r.json();
    console.log('Trial reminder — hosts to notify:', hosts.length);

    for (const host of hosts) {
      const trialEnds = new Date(host.trial_ends_at);
      const daysLeft = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));
      const name = host.full_name || 'there';
      const storeUrl = `https://hostiehub.com.au/store/${host.username}`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Hostie Hub <hello@hostiehub.com.au>',
          to: host.email,
          subject: `⏰ Your Hostie Hub trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2C6E6A,#1d4d4a);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:white;font-family:Georgia,serif">Hostie Hub</div>
        </td></tr>
        <tr><td style="background:white;padding:40px;border-radius:0 0 16px 16px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="font-size:48px;margin-bottom:12px">⏰</div>
            <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;font-family:Georgia,serif;margin:0 0 8px">Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h1>
            <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0">Hey ${name} — your Hostie Hub free trial is coming to an end. We'd hate for your store to go offline!</p>
          </div>
          <div style="background:#f4f6f5;border-radius:12px;padding:20px;margin-bottom:28px;text-align:center">
            <div style="font-size:13px;color:#6b7280;margin-bottom:4px">Your store</div>
            <div style="font-size:16px;font-weight:600;color:#2C6E6A">${storeUrl}</div>
          </div>
          <div style="background:#fdf3e0;border-left:4px solid #E8A838;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:28px">
            <p style="font-size:14px;color:#92600a;margin:0;line-height:1.6">After your trial ends your store will be temporarily paused — guests won't be able to browse or order until you activate a plan.</p>
          </div>
          <div style="text-align:center;margin-bottom:20px">
            <a href="https://hostiehub.com.au/plans.html" style="background:#2C6E6A;color:white;padding:16px 36px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:600;display:inline-block">Activate my plan →</a>
          </div>
          <div style="text-align:center">
            <a href="https://hostiehub.com.au/plans.html" style="display:block;margin-bottom:10px;background:#2C6E6A;color:white;padding:12px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">🏠 Host Plan — $99/yr (1 property)</a>
            <a href="https://hostiehub.com.au/plans.html" style="display:block;background:#1d4d4a;color:white;padding:12px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">⭐ Pro Plan — $199/yr (2–10 properties)</a>
          </div>
          <p style="font-size:13px;color:#9ca3af;text-align:center;margin-top:24px">Questions? Reply to this email or contact us at hello@hostiehub.com.au</p>
        </td></tr>
        <tr><td style="padding:24px 0;text-align:center">
          <div style="font-size:12px;color:#9ca3af">© 2025 Hostie Hub · Made with ❤️ in Newcastle, Australia</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
        })
      });
      console.log(`Trial reminder sent to ${host.email} — ${daysLeft} days left`);
    }
  }
};
