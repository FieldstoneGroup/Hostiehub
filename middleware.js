const SUPABASE_URL = 'https://hjwkycknjiyvrxbcejet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqd2t5Y2tuaml5dnJ4YmNlamV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njc3MjUsImV4cCI6MjA5MDQ0MzcyNX0.qmdp--Zw24bBlHqsXrQfFiIEv_ux0k9-1NE4RH_Ldb8';

export const config = {
  matcher: ['/store/:path*']
};

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function middleware(request) {
  const url = new URL(request.url);

  // Prevent infinite loop when fetching HTML internally
  if (url.searchParams.has('_og_bypass')) return;

  // Extract username from /store/username
  const username = url.pathname.replace(/^\/store\//, '').split('/')[0];
  if (!username) return;

  // Fetch host data from Supabase
  let host;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/hosts_public?username=eq.${encodeURIComponent(username)}&select=store_name,store_tagline,brand_colour&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    const data = await res.json();
    host = data?.[0];
  } catch (e) {
    return; // On error, serve page normally
  }

  if (!host) return; // Unknown username — serve normally

  const storeName = host.store_name || 'Guest Extras';
  const colour = /^#[0-9A-Fa-f]{6}$/.test(host.brand_colour) ? host.brand_colour : '#2C6E6A';
  const tagline = host.store_tagline || 'Extras & experiences for your stay';
  const desc = `Browse add-ons, experiences and local offers for your stay at ${storeName}.`;
  const ogImage = `https://hostiehub.com.au/api/og?name=${encodeURIComponent(storeName)}&color=${encodeURIComponent(colour)}&tagline=${encodeURIComponent(tagline)}`;

  // Fetch the base guest-store.html with bypass flag
  const bypassUrl = new URL('/guest-store.html', request.url);
  bypassUrl.searchParams.set('_og_bypass', '1');

  let html;
  try {
    const htmlRes = await fetch(bypassUrl.toString());
    html = await htmlRes.text();
  } catch (e) {
    return;
  }

  // Remove existing static OG/Twitter meta tags
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '');

  // Build dynamic tags
  const tags = `
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeAttr(url.href)}">
  <meta property="og:title" content="${escapeAttr(storeName)} — Guest Extras">
  <meta property="og:description" content="${escapeAttr(desc)}">
  <meta property="og:image" content="${escapeAttr(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(storeName)} — Guest Extras">
  <meta name="twitter:description" content="${escapeAttr(desc)}">
  <meta name="twitter:image" content="${escapeAttr(ogImage)}">`;

  html = html.replace('</head>', tags + '\n</head>');

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
