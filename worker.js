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
      const supabaseUrl = 'https://hjwkycknjiyvrxbcejet.supabase.co';

      // ── SUBSCRIPTION PAYMENT — update host plan ──
      if (event.type === 'customer.subscription.created' ||
          (event.type === 'checkout.session.completed' && event.data.object.mode === 'subscription')) {
        const customerEmail = event.data.object.customer_email || event.data.object.customer_details?.email;
        const amount = event.data.object.amount_total || event.data.object.plan?.amount;
        const plan = amount >= 19900 ? 'pro' : 'host';
        if (customerEmail) {
          const r = await fetch(`${supabaseUrl}/rest/v1/hosts?email=eq.${encodeURIComponent(customerEmail)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ plan, is_active: true })
          });
          console.log('Subscription plan update:', r.status, customerEmail, plan);
        }
        return new Response('OK', { status: 200 });
      }

      // ── GUEST ORDER PAYMENT — save order + send emails ──
      if (event.type === 'checkout.session.completed' && event.data.object.mode === 'payment') {
        const session = event.data.object;
        const meta = session.metadata || {};
        const hostId = meta.host_id;
        const guestName = meta.guest_name || 'Guest';
        const guestEmail = meta.guest_email || session.customer_details?.email || '';
        const guestPhone = meta.guest_phone || '';
        const checkin = meta.checkin_date || '';
        const checkout_date = meta.checkout_date || '';
        const propId = meta.property_id || null;
        const propName = meta.property_name || '';
        const notes = meta.notes || '';
        const total = parseFloat(meta.total) || (session.amount_total / 100);
        let items = [];
        let productNotes = {};
        try { items = JSON.parse(meta.items || '[]'); } catch(e) {}
        try { productNotes = JSON.parse(meta.product_notes || '{}'); } catch(e) {}

        if (!hostId) {
          console.log('No host_id in metadata — skipping order save');
          return new Response('OK', { status: 200 });
        }

        // Fetch host details for emails
        const hostRes = await fetch(`${supabaseUrl}/rest/v1/hosts?id=eq.${encodeURIComponent(hostId)}&select=email,full_name,store_name,username,notif_emails&limit=1`, {
          headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
        });
        const hosts = await hostRes.json();
        const host = hosts?.[0];
        if (!host) {
          console.log('Host not found for id:', hostId);
          return new Response('OK', { status: 200 });
        }

        // Save order to Supabase
        await fetch(`${supabaseUrl}/rest/v1/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            host_id: hostId,
            guest_name: guestName,
            guest_email: guestEmail,
            checkin_date: checkin,
            checkout_date: checkout_date,
            notes,
            property_id: propId,
            property_name: propName,
            items,
            product_notes: productNotes,
            total,
            status: 'paid',
            stripe_session_id: session.id
          })
        });
        console.log('Order saved for host:', hostId, 'guest:', guestName);

        // Build items HTML rows (used in both emails)
        const itemsHtml = items.map(i => `<tr><td style="padding:10px 0;border-bottom:1px solid #e8e4df;font-size:15px">&#128722; ${i.name}${productNotes[i.name] ? '<div style="font-size:12px;color:#6b7280;margin-top:3px;font-style:italic">&#128203; ' + productNotes[i.name] + '</div>' : ''}</td><td style="padding:10px 0;border-bottom:1px solid #e8e4df;font-size:15px;text-align:right;font-weight:600">$${i.price}</td></tr>`).join('');
        const hostName = host.full_name || host.store_name || 'Host';
        const storeName = host.store_name || host.username || 'your store';

        // ── HOST NOTIFICATION EMAIL ──
        const hostEmailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
          '<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif;">' +
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 20px"><tr><td align="center">' +
          '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">' +
          '<tr><td style="background:#2C6E6A;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center">' +
          '<div style="font-size:24px;font-weight:700;color:white;font-family:Georgia,serif">Hostie Hub</div></td></tr>' +
          '<tr><td style="background:white;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 20px rgba(0,0,0,0.06)">' +
          '<div style="font-size:28px;margin-bottom:8px">&#128718;</div>' +
          '<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 8px">New order received!</h1>' +
          '<p style="font-size:15px;color:#6b7280;margin:0 0 32px;line-height:1.6">Hi ' + hostName + ', a guest has just placed an order through your <strong>' + storeName + '</strong> store.</p>' +
          '<div style="background:#f4f6f5;border-radius:12px;padding:20px;margin-bottom:24px">' +
          '<div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px">Guest Details</div>' +
          '<table width="100%" cellpadding="0" cellspacing="0">' +
          '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:40%">&#128100; Guest name</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + guestName + '</td></tr>' +
          (guestEmail ? '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280">&#128231; Email</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a">' + guestEmail + '</td></tr>' : '') +
          '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280">&#128197; Check-in</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + checkin + '</td></tr>' +
          '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280">&#128197; Check-out</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + checkout_date + '</td></tr>' +
          (propName ? '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280">&#127968; Property</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + propName + '</td></tr>' : '') +
          (notes ? '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;vertical-align:top">&#128172; Notes</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a;font-style:italic">"' + notes + '"</td></tr>' : '') +
          '</table></div>' +
          '<div style="margin-bottom:24px"><div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px">Order Items</div>' +
          '<table width="100%" cellpadding="0" cellspacing="0">' + itemsHtml +
          '<tr><td style="padding:14px 0 0;font-size:16px;font-weight:700;color:#1a1a1a">Total</td><td style="padding:14px 0 0;font-size:20px;font-weight:700;color:#2C6E6A;text-align:right;font-family:Georgia,serif">$' + total + '</td></tr>' +
          '</table></div>' +
          '<div style="text-align:center;margin:32px 0 24px"><a href="https://hostiehub.com.au/dashboard.html" style="background:#2C6E6A;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block">View in dashboard &#8594;</a></div>' +
          '<p style="font-size:13px;color:#6b7280;text-align:center;margin:0;line-height:1.6">This email was sent by Hostie Hub on behalf of your store.</p>' +
          '</td></tr><tr><td style="padding:24px 0;text-align:center"><div style="font-size:12px;color:#9ca3af">&#169; 2025 Hostie Hub &#183; Made with &#10084;&#65039; in Newcastle, Australia</div></td></tr>' +
          '</table></td></tr></table></body></html>';

        // Send to host
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: 'Hostie Hub <hello@hostiehub.com.au>', to: host.email, subject: '&#128718; New order from ' + guestName + ' \u2014 ' + storeName, html: hostEmailHtml })
        });

        // Send to additional notif_emails if any
        let notifEmails = [];
        try { notifEmails = Array.isArray(host.notif_emails) ? host.notif_emails : JSON.parse(host.notif_emails || '[]'); } catch(e) {}
        for (const u of notifEmails) {
          const email = typeof u === 'string' ? u : u.email;
          if (!email || email === host.email) continue;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
            body: JSON.stringify({ from: 'Hostie Hub <hello@hostiehub.com.au>', to: email, subject: '&#128718; New order from ' + guestName + ' \u2014 ' + storeName, html: hostEmailHtml })
          });
        }
        console.log('Host notification sent to:', host.email);

        // ── PARTNER REQUEST EMAILS ──
        let partnerRequests = [];
        try { partnerRequests = JSON.parse(meta.partner_requests || '[]'); } catch(e) {}
        for (const req of partnerRequests) {
          if (!req.partnerId) continue;
          const partnerRes = await fetch(`${supabaseUrl}/rest/v1/partners?id=eq.${encodeURIComponent(req.partnerId)}&select=email,business_name,contact_name,full_name&limit=1`, {
            headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
          });
          const partners = await partnerRes.json();
          const partner = partners?.[0];
          if (!partner || !partner.email) continue;
          const bizName = partner.business_name || req.businessName || 'Partner';
          const partnerEmailHtml = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f4f6f5;border-radius:16px">' +
            '<div style="background:linear-gradient(135deg,#E8A838,#d4952e);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">' +
            '<div style="font-size:36px;margin-bottom:8px">&#129309;</div>' +
            '<div style="font-size:18px;font-weight:700;color:white;font-family:Georgia,serif">New service request!</div>' +
            '<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">via ' + storeName + ' on Hostie Hub</div></div>' +
            '<div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px">' +
            '<div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px">Request Details</div>' +
            '<table cellpadding="8" style="width:100%;border-collapse:collapse">' +
            '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px;width:35%">Service</td><td style="font-weight:600;font-size:14px">' + req.productName + '</td></tr>' +
            '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Guest name</td><td style="font-size:14px">' + guestName + '</td></tr>' +
            (guestEmail ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Guest email</td><td style="font-size:14px"><a href="mailto:' + guestEmail + '" style="color:#2C6E6A">' + guestEmail + '</a></td></tr>' : '') +
            (guestPhone ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Guest phone</td><td style="font-size:14px;font-weight:600"><a href="tel:' + guestPhone + '" style="color:#2C6E6A">' + guestPhone + '</a></td></tr>' : '') +
            (propName ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Property</td><td style="font-size:14px">' + propName + '</td></tr>' : '') +
            '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Check-in</td><td style="font-size:14px">' + checkin + '</td></tr>' +
            '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Check-out</td><td style="font-size:14px">' + checkout_date + '</td></tr>' +
            (req.preferredDate ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Preferred date</td><td style="font-weight:600;font-size:14px;color:#2C6E6A">' + req.preferredDate + '</td></tr>' : '') +
            (req.notes ? '<tr><td style="color:#6b7280;font-size:13px;vertical-align:top">Notes</td><td style="font-size:14px;font-style:italic">"' + req.notes + '"</td></tr>' : '') +
            '</table></div>' +
            '<div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;font-size:13px;color:#15803d;line-height:1.5">&#10003; Please contact the guest directly to confirm the booking and arrange payment.</div>' +
            '</div>';
          // Store enriched partner details for guest email
          req._partnerEmail = partner.email;
          req._ownerName = partner.contact_name || partner.full_name || null;
          req._businessName = bizName;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
            body: JSON.stringify({ from: 'Hostie Hub <hello@hostiehub.com.au>', to: partner.email, subject: '&#129309; New service request \u2014 ' + req.productName, html: partnerEmailHtml })
          });
          console.log('Partner request email sent to:', partner.email, 'for:', req.productName);
        }

        // ── GUEST CONFIRMATION EMAIL ──
        if (guestEmail) {
          const partnerRequests = [];
          try { partnerRequests.push(...JSON.parse(meta.partner_requests || '[]')); } catch(e) {}
          const guestEmailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
            '<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif;">' +
            '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 20px"><tr><td align="center">' +
            '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">' +
            '<tr><td style="background:linear-gradient(135deg,#2C6E6A,#1d4d4a);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">' +
            '<div style="font-size:28px;font-weight:700;color:white;font-family:Georgia,serif;margin-bottom:4px">Hostie Hub</div>' +
            '<div style="font-size:13px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase">Order Confirmed</div></td></tr>' +
            '<tr><td style="background:white;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">' +
            '<div style="text-align:center;margin-bottom:32px">' +
            '<div style="font-size:48px;margin-bottom:12px">&#127881;</div>' +
            '<h1 style="font-size:26px;font-weight:700;color:#1a1a1a;font-family:Georgia,serif;margin:0 0 8px">You\'re all set, ' + guestName + '!</h1>' +
            '<p style="font-size:15px;color:#6b7280;margin:0;line-height:1.6">Your extras have been ordered from <strong style="color:#2C6E6A">' + storeName + '</strong>.<br>Your host will have everything ready for your arrival.</p></div>' +
            '<div style="background:#f4f6f5;border-radius:12px;padding:20px;margin-bottom:28px">' +
            '<div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px">Stay Details</div>' +
            '<table width="100%" cellpadding="0" cellspacing="0">' +
            (propName ? '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:40%">&#127968; Property</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + propName + '</td></tr>' : '') +
            '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280">&#128197; Check-in</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + checkin + '</td></tr>' +
            '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280">&#128197; Check-out</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a1a1a">' + checkout_date + '</td></tr>' +
            (notes ? '<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;vertical-align:top">&#128203; Notes</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a">' + notes + '</td></tr>' : '') +
            '</table></div>' +
            '<div style="margin-bottom:28px"><div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px">Your Order</div>' +
            '<table width="100%" cellpadding="0" cellspacing="0">' + itemsHtml +
            '<tr><td style="padding:16px 0 0;font-size:16px;font-weight:700;color:#1a1a1a">Total</td><td style="padding:16px 0 0;font-size:22px;font-weight:700;color:#2C6E6A;text-align:right;font-family:Georgia,serif">$' + total + '</td></tr>' +
            '</table></div>' +
            '<div style="background:#e6f2f1;border-radius:12px;padding:20px;margin-bottom:28px;border-left:4px solid #2C6E6A">' +
            '<div style="font-size:20px;font-weight:700;color:#1d4d4a;margin-bottom:6px">For Purchased Products</div>' +
            '<div style="font-size:11px;color:#2C6E6A;font-style:italic;margin-bottom:12px">Ignore this section if you haven\'t purchased any host products.</div>' +
            '<div style="font-size:14px;font-weight:700;color:#2C6E6A;margin-bottom:8px">What happens next?</div>' +
            '<p style="font-size:14px;color:#1d4d4a;margin:0;line-height:1.7">Your host <strong>' + hostName + '</strong> has been notified and will have everything ready for your arrival. If you have any questions about your order or stay, please contact your host directly.</p></div>' +
            (partnerRequests.length > 0
              ? '<div style="background:#fff7e6;border-radius:12px;padding:20px;margin-bottom:28px;border-left:4px solid #E8A838">' +
                '<div style="font-size:20px;font-weight:700;color:#92600a;margin-bottom:6px">For Requested Products/Services</div>' +
                '<div style="font-size:11px;color:#E8A838;font-style:italic;margin-bottom:12px">Ignore this section if you haven\'t requested any partner products or services.</div>' +
                '<p style="font-size:13px;color:#92600a;margin:0 0 12px;line-height:1.6">The following businesses will contact you directly to confirm and arrange payment:</p>' +
                partnerRequests.map(r =>
                  '<div style="background:white;border-radius:8px;padding:14px 16px;margin-bottom:8px;border:1px solid #fde68a">' +
                  '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:8px">' + r.productName + '</div>' +
                  '<table cellpadding="4" style="width:100%;border-collapse:collapse">' +
                  '<tr><td style="font-size:12px;color:#6b7280;width:35%">Business</td><td style="font-size:13px;font-weight:600;color:#92600a">' + (r._businessName || r.businessName || 'Local Partner') + '</td></tr>' +
                  (r._ownerName ? '<tr><td style="font-size:12px;color:#6b7280">Contact</td><td style="font-size:13px;font-weight:600;color:#1a1a1a">' + r._ownerName + '</td></tr>' : '') +
                  (r._partnerEmail ? '<tr><td style="font-size:12px;color:#6b7280">Email</td><td style="font-size:13px"><a href="mailto:' + r._partnerEmail + '" style="color:#2C6E6A;font-weight:600">' + r._partnerEmail + '</a></td></tr>' : '') +
                  (r.preferredDate ? '<tr><td style="font-size:12px;color:#6b7280">Preferred date</td><td style="font-size:13px;color:#1a1a1a">' + r.preferredDate + '</td></tr>' : '') +
                  '</table>' +
                  (r.notes ? '<div style="font-size:12px;color:#6b7280;font-style:italic;margin-top:8px;border-top:1px solid #f0ece8;padding-top:8px">"' + r.notes + '"</div>' : '') +
                  '</div>'
                ).join('') +
                '</div>'
              : '') +
            '<p style="font-size:13px;color:#6b7280;text-align:center;margin:0;line-height:1.6">&#9888;&#65039; <strong>Please do not reply to this email.</strong><br>This is an automated confirmation from Hostie Hub.</p>' +
            '</td></tr><tr><td style="padding:28px 0;text-align:center">' +
            '<div style="font-size:13px;font-weight:700;color:#2C6E6A;font-family:Georgia,serif;margin-bottom:6px">Hostie Hub</div>' +
            '<div style="font-size:12px;color:#9ca3af">&#169; 2025 Hostie Hub &#183; Made with &#10084;&#65039; in Newcastle, Australia</div>' +
            '</td></tr></table></td></tr></table></body></html>';

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
            body: JSON.stringify({ from: 'Hostie Hub <noreply@hostiehub.com.au>', to: guestEmail, subject: '\u2705 Your order is confirmed \u2014 ' + storeName, html: guestEmailHtml })
          });
          console.log('Guest confirmation sent to:', guestEmail);
        }

        return new Response('OK', { status: 200 });
      }

      return new Response('OK', { status: 200 });
    }

    // ── PARTNER REQUEST NOTIFICATION ──
    if (service === 'partner-request-notify') {
      const body = await request.json();
      const { partnerId, productName, businessName, guestName, guestEmail, guestPhone, propName, checkin, checkout, preferredDate, notes, storeName } = body;

      if (!partnerId) return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });

      const supabaseUrl = 'https://hjwkycknjiyvrxbcejet.supabase.co';
      const partnerRes = await fetch(`${supabaseUrl}/rest/v1/partners?id=eq.${encodeURIComponent(partnerId)}&select=email,business_name,contact_name,full_name&limit=1`, {
        headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` }
      });
      const partners = await partnerRes.json();
      const partner = partners?.[0];
      if (!partner?.email) return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });

      const bizName = partner.business_name || businessName || 'Local Partner';
      const html = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f4f6f5;border-radius:16px">' +
        '<div style="background:linear-gradient(135deg,#E8A838,#d4952e);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">' +
        '<div style="font-size:36px;margin-bottom:8px">&#129309;</div>' +
        '<div style="font-size:18px;font-weight:700;color:white;font-family:Georgia,serif">New service request!</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">via ' + (storeName || 'Hostie Hub') + '</div></div>' +
        '<div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px">' +
        '<div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:14px">Request Details</div>' +
        '<table cellpadding="8" style="width:100%;border-collapse:collapse">' +
        '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px;width:35%">Service</td><td style="font-weight:600;font-size:14px">' + (productName || '') + '</td></tr>' +
        '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Guest name</td><td style="font-size:14px">' + (guestName || '') + '</td></tr>' +
        (guestEmail ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Guest email</td><td style="font-size:14px"><a href="mailto:' + guestEmail + '" style="color:#2C6E6A">' + guestEmail + '</a></td></tr>' : '') +
        (guestPhone ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Guest phone</td><td style="font-size:14px;font-weight:600"><a href="tel:' + guestPhone + '" style="color:#2C6E6A">' + guestPhone + '</a></td></tr>' : '') +
        (propName ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Property</td><td style="font-size:14px">' + propName + '</td></tr>' : '') +
        (checkin ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Check-in</td><td style="font-size:14px">' + checkin + '</td></tr>' : '') +
        (checkout ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Check-out</td><td style="font-size:14px">' + checkout + '</td></tr>' : '') +
        (preferredDate ? '<tr style="border-bottom:1px solid #f0ece8"><td style="color:#6b7280;font-size:13px">Preferred date</td><td style="font-weight:600;font-size:14px;color:#2C6E6A">' + preferredDate + '</td></tr>' : '') +
        (notes ? '<tr><td style="color:#6b7280;font-size:13px;vertical-align:top">Notes</td><td style="font-size:14px;font-style:italic">"' + notes + '"</td></tr>' : '') +
        '</table></div>' +
        '<div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;font-size:13px;color:#15803d;line-height:1.5">&#10003; Please contact the guest directly to confirm the booking and arrange payment.</div>' +
        '</div>';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Hostie Hub <hello@hostiehub.com.au>',
          to: partner.email,
          subject: '&#129309; New service request \u2014 ' + (productName || 'Request'),
          html
        })
      });
      console.log('Partner request email sent to:', partner.email);
      return new Response(JSON.stringify({
        email: partner.email,
        businessName: bizName,
        contactName: partner.contact_name || partner.full_name || null
      }), { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
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

      // ── WELCOME EMAIL TO NEW HOST ──
      if (record.email) {
        const hostName = record.full_name || 'there';
        const storeUrl = record.username ? 'https://hostiehub.com.au/store/' + record.username : 'https://hostiehub.com.au/dashboard.html';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${env.RESEND_API_KEY}\` },
          body: JSON.stringify({
            from: 'Hostie Hub <hello@hostiehub.com.au>',
            to: record.email,
            subject: '🎉 Welcome to Hostie Hub — your store is ready!',
            html: \`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#2C6E6A,#1d4d4a);border-radius:16px 16px 0 0;padding:48px 40px;text-align:center">
    <div style="font-size:52px;margin-bottom:16px">🎉</div>
    <div style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:white;margin-bottom:10px">You're in, \${hostName}!</div>
    <div style="font-size:16px;color:rgba(255,255,255,0.8);line-height:1.6">Your Hostie Hub store is live and ready to go.<br>Let's get you set up and earning.</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:white;padding:48px 40px">

    <!-- Store URL -->
    <div style="background:#f0fdf4;border:2px solid #2C6E6A;border-radius:14px;padding:20px 24px;margin-bottom:36px;text-align:center">
      <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#2C6E6A;margin-bottom:6px">Your store link</div>
      <div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:14px">\${storeUrl}</div>
      <a href="\${storeUrl}" style="background:#2C6E6A;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px">View my store →</a>
    </div>

    <!-- Intro -->
    <p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 36px">Hostie Hub lets you offer your guests amazing add-ons and extras — delivered straight to their door or ready on arrival. Here's everything you need to get started:</p>

    <!-- Steps -->
    <div style="margin-bottom:36px">

      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #2C6E6A">
        <div style="width:36px;height:36px;background:#2C6E6A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;text-align:center;line-height:36px">1</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:4px">Set up your store branding</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.6">Go to <strong>Store Settings</strong> in your dashboard and add your store name, colours and logo. This is what guests see when they open your link.</div>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #2C6E6A">
        <div style="width:36px;height:36px;background:#2C6E6A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;text-align:center;line-height:36px">2</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:4px">Add your properties</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.6">Go to <strong>Properties</strong> and add each property you manage. Guests will select which property they're staying at when they order.</div>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #2C6E6A">
        <div style="width:36px;height:36px;background:#2C6E6A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;text-align:center;line-height:36px">3</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:4px">Add products & services</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.6">Go to <strong>Products</strong> and click <strong>Browse presets</strong> to pick from our library of ready-made products — welcome hampers, experiences, grocery packs and more. Or create your own from scratch.</div>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #2C6E6A">
        <div style="width:36px;height:36px;background:#2C6E6A;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;text-align:center;line-height:36px">4</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:4px">Connect Stripe to get paid</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.6">Go to <strong>Stripe Connect</strong> and link your Stripe account. This is how payments go directly to you — Hostie Hub never touches your money.</div>
        </div>
      </div>

      <div style="display:flex;align-items:flex-start;gap:16px;padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #E8A838">
        <div style="width:36px;height:36px;background:#E8A838;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;text-align:center;line-height:36px">5</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a;margin-bottom:4px">Share your store link with guests</div>
          <div style="font-size:14px;color:#6b7280;line-height:1.6">Copy your store link and paste it into your Airbnb/Booking.com welcome message, or include it in your guest communication. That's it — guests browse and order directly.</div>
        </div>
      </div>

    </div>

    <!-- Local partners callout -->
    <div style="background:#fff7e6;border:1.5px solid #E8A838;border-radius:14px;padding:20px 24px;margin-bottom:36px">
      <div style="font-size:15px;font-weight:700;color:#92600a;margin-bottom:6px">🤝 Discover local partner offers</div>
      <div style="font-size:14px;color:#a16207;line-height:1.6">Check out <strong>Local Products</strong> in your dashboard — local businesses in your area have listed their offers (restaurants, experiences, tours) that you can add to your store for free and earn a commission.</div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:36px">
      <a href="https://hostiehub.com.au/dashboard.html" style="background:#2C6E6A;color:white;padding:16px 40px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block">Go to my dashboard →</a>
    </div>

    <!-- Support -->
    <div style="border-top:1.5px solid #f0ece8;padding-top:28px;text-align:center">
      <div style="font-size:14px;color:#6b7280;line-height:1.7">Got questions? We're real people and we read every email.<br>
      <a href="mailto:hello@hostiehub.com.au" style="color:#2C6E6A;font-weight:600">hello@hostiehub.com.au</a> — we'll get back to you fast.</div>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:28px 0;text-align:center">
    <div style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#2C6E6A;margin-bottom:6px">Hostie Hub</div>
    <div style="font-size:12px;color:#9ca3af">Australia's first extras store platform built by hosts, for hosts.<br>© 2025 Hostie Hub · Made with ❤️ in Newcastle, Australia</div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>\`
          })
        });
      }

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

      // ── WELCOME EMAIL TO NEW PARTNER ──
      if (record.email) {
        const bizName = record.business_name || 'there';
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${env.RESEND_API_KEY}\` },
          body: JSON.stringify({
            from: 'Hostie Hub <hello@hostiehub.com.au>',
            to: record.email,
            subject: '🤝 Welcome to Hostie Hub — your partner account is live!',
            html: \`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#E8A838,#d4952e);border-radius:16px 16px 0 0;padding:48px 40px;text-align:center">
    <div style="font-size:52px;margin-bottom:16px">🤝</div>
    <div style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:white;margin-bottom:10px">Welcome, \${bizName}!</div>
    <div style="font-size:16px;color:rgba(255,255,255,0.85);line-height:1.6">Your partner account is live.<br>Let's get your first listing in front of local guests.</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:white;padding:48px 40px">

    <!-- Intro -->
    <p style="font-size:16px;color:#374151;line-height:1.7;margin:0 0 36px">Hostie Hub connects your business with guests staying at local short-term rental properties. Hosts in your area can add your listings to their guest stores — meaning guests discover you <strong>before they even arrive</strong>. Here's how to get set up:</p>

    <!-- Steps -->
    <div style="margin-bottom:36px">

      <div style="padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #E8A838;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:30px;height:30px;background:#E8A838;border-radius:50%;color:white;font-weight:700;font-size:14px;text-align:center;line-height:30px;flex-shrink:0">1</div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a">Create your first listing</div>
        </div>
        <div style="font-size:14px;color:#6b7280;line-height:1.6;padding-left:42px">Go to <strong>My Listings → Add Listing</strong> in your dashboard. Add your product or service name, description, category and wholesale price. Upload a photo — listings with images get significantly more clicks.</div>
      </div>

      <div style="padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #E8A838;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:30px;height:30px;background:#E8A838;border-radius:50%;color:white;font-weight:700;font-size:14px;text-align:center;line-height:30px;flex-shrink:0">2</div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a">Set your service area</div>
        </div>
        <div style="font-size:14px;color:#6b7280;line-height:1.6;padding-left:42px">Enter your suburb and click Apply — we'll cover all postcodes within 30km automatically. Only hosts in your area will see your listing, so you only reach relevant guests.</div>
      </div>

      <div style="padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #E8A838;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:30px;height:30px;background:#E8A838;border-radius:50%;color:white;font-weight:700;font-size:14px;text-align:center;line-height:30px;flex-shrink:0">3</div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a">Attach a voucher (optional but powerful)</div>
        </div>
        <div style="font-size:14px;color:#6b7280;line-height:1.6;padding-left:42px">Upload a voucher image or PDF — when a guest books, it's automatically emailed to them. Perfect for restaurants offering a complimentary drink, spas offering a discount, or any business with a special offer.</div>
      </div>

      <div style="padding:20px;background:#f9fafb;border-radius:12px;border-left:4px solid #E8A838;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:30px;height:30px;background:#E8A838;border-radius:50%;color:white;font-weight:700;font-size:14px;text-align:center;line-height:30px;flex-shrink:0">4</div>
          <div style="font-weight:700;font-size:15px;color:#1a1a1a">Publish and you're live</div>
        </div>
        <div style="font-size:14px;color:#6b7280;line-height:1.6;padding-left:42px">Click <strong>Publish listing</strong> and your offer is immediately available for local hosts to add to their guest stores. You'll see clicks, views and redemptions in your Analytics tab.</div>
      </div>

    </div>

    <!-- Pricing callout -->
    <div style="background:#fff7e6;border:1.5px solid #E8A838;border-radius:14px;padding:20px 24px;margin-bottom:36px">
      <div style="font-size:15px;font-weight:700;color:#92600a;margin-bottom:8px">💛 Your 3-month free trial is active</div>
      <div style="font-size:14px;color:#a16207;line-height:1.6">Everything is completely free for 3 months. After that, billing is simple — <strong>$49/listing/month</strong> and <strong>$10/voucher/month</strong>. Only active listings count, and you can pause or deactivate anytime.</div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:36px">
      <a href="https://hostiehub.com.au/partner-dashboard.html" style="background:#E8A838;color:white;padding:16px 40px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block">Go to my dashboard →</a>
    </div>

    <!-- Support -->
    <div style="border-top:1.5px solid #f0ece8;padding-top:28px;text-align:center">
      <div style="font-size:14px;color:#6b7280;line-height:1.7">Need help setting up? We're here for you.<br>
      <a href="mailto:hello@hostiehub.com.au" style="color:#E8A838;font-weight:600">hello@hostiehub.com.au</a> — we'll get back to you quickly.</div>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:28px 0;text-align:center">
    <div style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#E8A838;margin-bottom:6px">Hostie Hub</div>
    <div style="font-size:12px;color:#9ca3af">Connecting local businesses with short-stay guests across Australia.<br>© 2025 Hostie Hub · Made with ❤️ in Newcastle, Australia</div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>\`
          })
        });
      }

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
