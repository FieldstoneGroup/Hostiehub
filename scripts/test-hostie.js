const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseListingHtml, inferType } = require('../api/lib/listing-parse');
const { isPrivateIp } = require('../api/lib/public-url');
const { suggest } = require('../js/suggestions');
const { rateForCount, monthlyTotal, billableQuantity, PRICING } = require('../js/pricing');

assert.strictEqual(PRICING.STRIPE_ACCOUNT_ID, 'acct_1TH1K4FGh2TNwWGY');
assert.strictEqual(PRICING.STRIPE_PRODUCT_ID, 'prod_VcosxU73288ZLQ');
assert.strictEqual(PRICING.STRIPE_PRICE_ID, 'price_1UbZFJFGh2TNwWGYsQhTzePk');
assert.strictEqual(rateForCount(1), 10);
assert.strictEqual(rateForCount(2), 10);
assert.strictEqual(monthlyTotal(2), 20);
assert.strictEqual(rateForCount(3), 8);
assert.strictEqual(monthlyTotal(10), 80);
assert.strictEqual(rateForCount(11), 6);
assert.strictEqual(monthlyTotal(11), 66);
assert.strictEqual(billableQuantity(0), 1);

const html = fs.readFileSync(path.join(__dirname, '../fixtures/sample-listing.html'), 'utf8');
const parsed = parseListingHtml(html, 'http://127.0.0.1/fixtures/sample-listing.html');
assert.strictEqual(parsed.ok, true);
assert.strictEqual(parsed.title, 'Sunroom Cottage');
assert.strictEqual(parsed.postcode, '2026');
assert.strictEqual(parsed.location, 'Bondi Beach, NSW');
assert.strictEqual(parsed.propertyType, 'beach house');
assert.ok(parsed.photos.length >= 1);

assert.strictEqual(parseListingHtml('<title>Just a moment...</title>', 'https://airbnb.com/rooms/1').ok, false);
assert.strictEqual(inferType('Loft apartment in the city'), 'apartment');
assert.strictEqual(isPrivateIp('127.0.0.1'), true);
assert.strictEqual(isPrivateIp('10.1.2.3'), true);
assert.strictEqual(isPrivateIp('8.8.8.8'), false);

const ideas = suggest({
  question: 'what should I add',
  propertyType: 'beach house',
  location: 'Bondi Beach, NSW',
  products: [{ id: '1', name: 'Late check-out', price: 45 }]
});
assert.ok(ideas.suggestions.some(function (item) { return item.key === 'early-checkin' && item.action === 'add'; }));
assert.ok(!ideas.suggestions.some(function (item) { return item.key === 'late-checkout'; }));
assert.ok(ideas.suggestions.some(function (item) { return item.key === 'beach-setup'; }));

const prices = suggest({
  question: 'pricing ideas',
  propertyType: 'house',
  location: 'Newcastle',
  products: [{ id: 'late', name: 'Late check-out', price: 20 }]
});
assert.ok(prices.suggestions.some(function (item) {
  return item.action === 'edit' && item.productId === 'late' && item.price === 45;
}));

const locales = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'];
const english = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf8'));
function leaves(node, prefix, out) {
  Object.keys(node).forEach(function (key) {
    var next = prefix ? prefix + '.' + key : key;
    if (node[key] && typeof node[key] === 'object') leaves(node[key], next, out);
    else out.push(next);
  });
}
const keys = [];
leaves(english, '', keys);
assert.ok(keys.length > 40);
locales.forEach(function (code) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/' + code + '.json'), 'utf8'));
  const found = [];
  leaves(data, '', found);
  keys.forEach(function (key) { assert.ok(found.indexOf(key) !== -1, code + ' missing ' + key); });
});

console.log('hostie checks ok', keys.length, 'locale keys');
