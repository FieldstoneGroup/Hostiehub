// Hostie Hub iCal Feed Worker
// Deploy this to Cloudflare Workers
// Route: /ical/:username
// Env vars needed: SUPABASE_URL, SUPABASE_ANON_KEY

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname; // e.g. /ical/stayable

    // CORS for calendar apps
    const headers = {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    };

    const match = path.match(/^\/ical\/(.+)$/);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const username = match[1];

    try {
      // Look up host by username
      const hostRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/hosts_public?username=eq.${encodeURIComponent(username)}&select=id,full_name`,
        {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
        }
      );
      const hosts = await hostRes.json();
      if (!hosts.length) return new Response('Host not found', { status: 404 });

      const host = hosts[0];

      // Fetch orders for this host
      const ordersRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/orders?host_id=eq.${host.id}&select=*&order=created_at.desc&limit=100`,
        {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
        }
      );
      const orders = await ordersRes.json();

      // Build iCal
      const now = formatIcalDate(new Date());
      let ical = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hostie Hub//Orders//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:Hostie Hub Orders – ${host.full_name || username}`,
        'X-WR-TIMEZONE:Australia/Sydney',
        'X-WR-CALDESC:Guest orders from your Hostie Hub store',
      ].join('\r\n');

      for (const order of orders) {
        const uid = order.id + '@hostiehub.com.au';
        const created = formatIcalDate(new Date(order.created_at));
        const checkin = order.checkin_date ? formatIcalDateOnly(order.checkin_date) : null;
        const checkout = order.checkout_date ? formatIcalDateOnly(order.checkout_date) : null;

        if (!checkin) continue;

        const items = Array.isArray(order.items)
          ? order.items
          : JSON.parse(order.items || '[]');
        const itemNames = items.map(i => i.name).join(', ');
        const summary = (order.guest_name || 'Guest') + ' – ' + (itemNames || 'Order');
        const description = [
          'Property: ' + (order.property_name || 'N/A'),
          'Items: ' + (itemNames || 'N/A'),
          'Total: $' + (order.total || 0),
          'Status: ' + (order.status || 'pending'),
          order.notes ? 'Notes: ' + order.notes : '',
        ].filter(Boolean).join('\\n');

        ical += '\r\nBEGIN:VEVENT';
        ical += '\r\nUID:' + uid;
        ical += '\r\nDTSTAMP:' + now;
        ical += '\r\nCREATED:' + created;
        ical += '\r\nSUMMARY:' + escapeIcal(summary);
        ical += '\r\nDESCRIPTION:' + escapeIcal(description);
        ical += '\r\nDTSTART;VALUE=DATE:' + checkin;
        ical += '\r\nDTEND;VALUE=DATE:' + (checkout || checkin);
        if (order.property_name) {
          ical += '\r\nLOCATION:' + escapeIcal(order.property_name);
        }
        ical += '\r\nSTATUS:CONFIRMED';
        ical += '\r\nEND:VEVENT';
      }

      ical += '\r\nEND:VCALENDAR';

      return new Response(ical, { headers });

    } catch (err) {
      return new Response('Error: ' + err.message, { status: 500 });
    }
  }
};

function formatIcalDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatIcalDateOnly(dateStr) {
  // dateStr like "2026-04-10"
  return dateStr.replace(/-/g, '');
}

function escapeIcal(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
