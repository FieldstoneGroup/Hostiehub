const { parseListingHtml, platformFromUrl } = require('./lib/listing-parse');
const { assertPublicHttpUrl } = require('./lib/public-url');

const MAX_BYTES = 1000000;
const MAX_REDIRECTS = 3;

function emptyResult(platform, error) {
  return {
    ok: false,
    title: '',
    description: '',
    location: '',
    address: '',
    postcode: '',
    photos: [],
    propertyType: '',
    platform: platform || 'other',
    error: error || 'unreadable'
  };
}

async function readPublicHtml(url, hops) {
  if (hops > MAX_REDIRECTS) throw new Error('Too many redirects.');
  var response = await fetch(url.toString(), {
    redirect: 'manual',
    headers: {
      'user-agent': 'HostieHubListingPreview/1.0 (+https://hostiehub.com.au)',
      accept: 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(8000)
  });
  if (response.status >= 300 && response.status < 400) {
    var next = response.headers.get('location');
    if (!next) throw new Error('The listing redirected without a destination.');
    var nextUrl = await assertPublicHttpUrl(new URL(next, url).toString());
    return readPublicHtml(nextUrl, hops + 1);
  }
  if (!response.ok) throw new Error('The listing page returned ' + response.status + '.');
  var type = response.headers.get('content-type') || '';
  if (type && type.indexOf('html') === -1 && type.indexOf('xml') === -1 && type.indexOf('text/') === -1) {
    throw new Error('That page is not a public listing.');
  }
  var reader = response.body && response.body.getReader ? response.body.getReader() : null;
  if (!reader) return await response.text();
  var chunks = [];
  var size = 0;
  while (true) {
    var step = await reader.read();
    if (step.done) break;
    size += step.value.byteLength;
    if (size > MAX_BYTES) break;
    chunks.push(step.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  var body = req.body || {};
  var rawUrl = body.url || '';
  var platform = 'other';
  try {
    var url = await assertPublicHttpUrl(rawUrl);
    platform = platformFromUrl(url.toString());
    var html = await readPublicHtml(url, 0);
    var parsed = parseListingHtml(html, url.toString());
    parsed.platform = platform;
    if (!parsed.ok) parsed = emptyResult(platform, 'unreadable');
    res.status(200).json(parsed);
  } catch (err) {
    res.status(200).json(emptyResult(platformFromUrl(rawUrl), 'unreadable'));
  }
};
