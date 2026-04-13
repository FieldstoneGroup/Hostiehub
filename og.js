module.exports = function handler(req, res) {
  const raw = req.query.name || 'Guest Extras';
  const name = raw.length > 36 ? raw.substring(0, 36) + '...' : raw;
  const colour = /^#[0-9A-Fa-f]{6}$/.test(req.query.color) ? req.query.color : '#2C6E6A';

  // Darken the brand colour slightly for the bottom bar
  function darken(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - 40);
    const g = Math.max(0, ((n >> 8) & 0xff) - 40);
    const b = Math.max(0, (n & 0xff) - 40);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  const dark = darken(colour);

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colour}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle overlay pattern -->
  <rect width="1200" height="630" fill="rgba(0,0,0,0.08)"/>

  <!-- Top-right decorative circle -->
  <circle cx="1100" cy="80" r="180" fill="rgba(255,255,255,0.05)"/>
  <circle cx="1050" cy="600" r="120" fill="rgba(255,255,255,0.04)"/>

  <!-- Hostie Hub wordmark -->
  <text x="72" y="108" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="400" fill="rgba(255,255,255,0.65)" letter-spacing="1">Hostie Hub</text>
  <circle cx="218" cy="94" r="7" fill="#E8A838"/>

  <!-- Divider -->
  <rect x="72" y="130" width="80" height="3" rx="2" fill="rgba(255,255,255,0.3)"/>

  <!-- Store name — large -->
  <text x="72" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="80" font-weight="700" fill="white" letter-spacing="-2">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</text>

  <!-- Subtitle -->
  <text x="72" y="368" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="400" fill="rgba(255,255,255,0.72)">Guest Extras &amp; Local Experiences</text>

  <!-- Bottom bar -->
  <rect x="0" y="530" width="1200" height="100" fill="rgba(0,0,0,0.22)"/>

  <!-- Store URL -->
  <text x="72" y="591" font-family="Georgia, 'Times New Roman', serif" font-size="26" fill="rgba(255,255,255,0.55)">hostiehub.com.au/store/</text>

  <!-- Gold accent line bottom -->
  <rect x="0" y="620" width="1200" height="10" fill="#E8A838"/>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  res.end(svg);
};
