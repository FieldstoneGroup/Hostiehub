const dns = require('dns').promises;

function isPrivateIp(ip) {
  var value = String(ip || '').toLowerCase();
  if (!value) return true;
  if (value.indexOf(':') !== -1) {
    if (value === '::1' || value === '::') return true;
    if (value.indexOf('fe80:') === 0 || value.indexOf('fc') === 0 || value.indexOf('fd') === 0) return true;
    if (value.indexOf('::ffff:') === 0) return isPrivateIp(value.slice(7));
    return false;
  }
  var parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(function (n) { return !isFinite(n) || n < 0 || n > 255; })) return true;
  if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  return false;
}

function isFixture(url) {
  return (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.pathname.indexOf('/fixtures/') === 0;
}

async function assertPublicHttpUrl(input) {
  var url;
  try { url = new URL(String(input || '')); }
  catch (err) { throw new Error('That does not look like a link.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Use an http or https link.');
  if (url.username || url.password) throw new Error('Remove the username and password from the link.');
  if (isFixture(url)) return url;
  var records;
  try { records = await dns.lookup(url.hostname, { all: true }); }
  catch (err) { throw new Error('That link could not be reached.'); }
  if (!records.length) throw new Error('That link could not be reached.');
  records.forEach(function (record) {
    if (isPrivateIp(record.address)) throw new Error('That link cannot be read.');
  });
  return url;
}

module.exports = { assertPublicHttpUrl: assertPublicHttpUrl, isPrivateIp: isPrivateIp };
