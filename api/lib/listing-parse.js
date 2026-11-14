/* Pull public listing fields out of HTML. No network and no writes. */

function decode(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return String.fromCodePoint(parseInt(hex, 16)); })
    .replace(/&#(\d+);/g, function (_, num) { return String.fromCodePoint(Number(num)); })
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, key) {
  var escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var patterns = [
    new RegExp('<meta[^>]+(?:property|name)=["\']' + escaped + '["\'][^>]+content=["\']([^"\']+)["\']', 'i'),
    new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + escaped + '["\']', 'i')
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match) return decode(match[1]);
  }
  return '';
}

function flattenLd(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach(function (item) { flattenLd(item, out); });
    return;
  }
  if (typeof node !== 'object') return;
  if (Array.isArray(node['@graph'])) flattenLd(node['@graph'], out);
  out.push(node);
}

function jsonLdNodes(html) {
  var out = [];
  var re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var match;
  while ((match = re.exec(html))) {
    try { flattenLd(JSON.parse(match[1]), out); } catch (err) { /* ignore broken blocks */ }
  }
  return out;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function imageUrls(value) {
  var urls = [];
  asArray(value).forEach(function (item) {
    if (!item) return;
    if (typeof item === 'string') urls.push(item);
    else if (typeof item === 'object') urls.push(item.url || item.contentUrl || '');
  });
  return urls;
}

function addressText(address) {
  if (!address) return { line: '', postcode: '', label: '' };
  if (typeof address === 'string') return { line: decode(address), postcode: '', label: decode(address) };
  var parts = [address.streetAddress, address.addressLocality, address.addressRegion, address.addressCountry]
    .map(function (part) { return decode(part); })
    .filter(Boolean);
  return {
    line: parts.join(', '),
    postcode: decode(address.postalCode || ''),
    label: [address.addressLocality, address.addressRegion].map(decode).filter(Boolean).join(', ')
  };
}

function inferType(text) {
  var blob = text.toLowerCase();
  var rules = [
    ['beach house', /beach ?house|beachfront|oceanfront|by the sea/],
    ['cabin', /cabin|chalet|lodge/],
    ['villa', /\bvilla\b/],
    ['farm', /farmstay|farm stay|\bfarm\b/],
    ['apartment', /apartment|\bflat\b|condo|\bloft\b|\bstudio\b|\bunit\b/],
    ['house', /\bhouse\b|\bhome\b|bungalow|townhouse|cottage/]
  ];
  for (var i = 0; i < rules.length; i++) {
    if (rules[i][1].test(blob)) return rules[i][0];
  }
  return '';
}

function platformFromUrl(url) {
  var host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch (err) { host = ''; }
  if (host.indexOf('airbnb.') !== -1) return 'airbnb';
  if (host.indexOf('booking.') !== -1) return 'booking';
  if (host.indexOf('guesty') !== -1) return 'guesty';
  if (host.indexOf('hostaway') !== -1) return 'hostaway';
  if (host.indexOf('hostify') !== -1) return 'hostify';
  if (host.indexOf('lodgify') !== -1) return 'lodgify';
  return 'other';
}

function cleanTitle(title) {
  return decode(title)
    .replace(/\s+[|\-–—]\s+(Airbnb|Booking\.com|Vrbo|Expedia).*$/i, '')
    .replace(/^Airbnb\s*[|\-–—]\s*/i, '')
    .slice(0, 140);
}

function uniquePhotos(urls) {
  var seen = {};
  var out = [];
  urls.forEach(function (url) {
    if (!url || seen[url]) return;
    if (!/^https?:\/\//i.test(url)) return;
    seen[url] = true;
    out.push(url.slice(0, 500));
  });
  return out.slice(0, 6);
}

function parseListingHtml(html, pageUrl) {
  var raw = String(html || '');
  var nodes = jsonLdNodes(raw);
  var lodging = nodes.find(function (node) {
    var type = node['@type'];
    var types = asArray(type).join(' ').toLowerCase();
    return /lodging|hotel|apartment|house|accommodation|residence|place|vacation/.test(types);
  }) || nodes.find(function (node) { return node.name || node.address; }) || {};

  var title = cleanTitle(lodging.name || meta(raw, 'og:title') || meta(raw, 'twitter:title') || (raw.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '');
  var description = decode(lodging.description || meta(raw, 'og:description') || meta(raw, 'description')).slice(0, 500);
  var address = addressText(lodging.address);
  var photos = uniquePhotos(
    imageUrls(lodging.image).concat([
      meta(raw, 'og:image'),
      meta(raw, 'og:image:url'),
      meta(raw, 'twitter:image')
    ])
  );
  var blob = [title, description, address.line].join(' ');
  var readable = Boolean(title) && !/just a moment|access denied|captcha|enable javascript/i.test(title);

  return {
    ok: readable,
    title: readable ? title : '',
    description: readable ? description : '',
    location: readable ? (address.label || '') : '',
    address: readable ? address.line : '',
    postcode: readable ? address.postcode : '',
    photos: readable ? photos : [],
    propertyType: readable ? inferType(blob) : '',
    platform: platformFromUrl(pageUrl),
    error: readable ? '' : 'unreadable'
  };
}

module.exports = {
  parseListingHtml: parseListingHtml,
  platformFromUrl: platformFromUrl,
  inferType: inferType
};
