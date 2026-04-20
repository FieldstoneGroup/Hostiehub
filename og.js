// OG IMAGE GENERATOR — returns an SVG preview card at /api/og
// Called by the OG meta tags that middleware.js injects on /store/:username
// Query params: ?name=<storeName>&color=<#brand>&tagline=<optional>

export const config = { runtime: 'edge' };

function clampHex(input, fallback) {
  if (typeof input !== 'string') return fallback;
  return /^#[0-9A-Fa-f]{6}$/.test(input) ? input : fallback;
}

function escXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(str, max) {
  const s = String(str || '');
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function lighten(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return '#' + lr.toString(16).padStart(2, '0') + lg.toString(16).padStart(2, '0') + lb.toString(16).padStart(2, '0');
}

export default async function handler(request) {
  const url = new URL(request.url);
  const name = truncate(url.searchParams.get('name') || 'Your Stay', 28);
  const tagline = truncate(url.searchParams.get('tagline') || 'Extras & experiences for your stay', 52);
  const brand = clampHex(url.searchParams.get('color'), '#2C6E6A');
  const brandLight = lighten(brand, 0.82);
  const accent = '#E8A838';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${brand}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${brand}" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="${brandLight}" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="80" r="140" fill="white" fill-opacity="0.06"/>
  <circle cx="80" cy="560" r="100" fill="white" fill-opacity="0.05"/>
  <rect x="70" y="70" width="1060" height="490" rx="32" fill="url(#card)"/>
  <rect x="70" y="70" width="1060" height="10" rx="5" fill="${accent}"/>
  <text x="120" y="170" font-family="Georgia, 'Playfair Display', serif" font-size="28" font-weight="700" fill="${brand}">Hostie Hub</text>
  <circle cx="300" cy="162" r="6" fill="${accent}"/>
  <text x="120" y="330" font-family="Georgia, 'Playfair Display', serif" font-size="78" font-weight="700" fill="#1a1a1a">${escXml(name)}</text>
  <text x="120" y="400" font-family="system-ui, -apple-system, 'DM Sans', sans-serif" font-size="32" font-weight="400" fill="#4b5563">${escXml(tagline)}</text>
  <g transform="translate(120, 470)">
    <rect x="0" y="0" width="200" height="48" rx="24" fill="${brand}" fill-opacity="0.12"/>
    <text x="100" y="31" text-anchor="middle" font-family="system-ui, -apple-system, 'DM Sans', sans-serif" font-size="18" font-weight="600" fill="${brand}">Guest extras</text>
    <rect x="220" y="0" width="220" height="48" rx="24" fill="${brand}" fill-opacity="0.12"/>
    <text x="330" y="31" text-anchor="middle" font-family="system-ui, -apple-system, 'DM Sans', sans-serif" font-size="18" font-weight="600" fill="${brand}">Local partners</text>
    <rect x="460" y="0" width="200" height="48" rx="24" fill="${brand}" fill-opacity="0.12"/>
    <text x="560" y="31" text-anchor="middle" font-family="system-ui, -apple-system, 'DM Sans', sans-serif" font-size="18" font-weight="600" fill="${brand}">Experiences</text>
  </g>
  <text x="1080" y="530" text-anchor="end" font-family="system-ui, -apple-system, 'DM Sans', sans-serif" font-size="16" font-weight="500" fill="#9ca3af">hostiehub.com.au</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    }
  });
}
