import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  moneyToCents,
  recordedRefundedCents,
  remainingRefundableCents,
  parseRefundAmountCents,
  refundOrderStatus,
  refundIdempotencyKey,
} from '../worker.js';

assert.equal(moneyToCents('19.99'), 1999);
assert.equal(moneyToCents(10.1), 1010);
assert.equal(moneyToCents(0), 0);
assert.equal(moneyToCents(null), 0);
assert.equal(moneyToCents(-5), 0);

assert.equal(recordedRefundedCents({ refunded_cents: 0, refunded_amount: 5 }), 0);
assert.equal(recordedRefundedCents({ refunded_cents: null, refunded_amount: '12.50' }), 1250);
assert.equal(recordedRefundedCents({ refunded_cents: '500' }), 500);
assert.equal(recordedRefundedCents({}), 0);

assert.equal(remainingRefundableCents(2500, 0, null), 2500);
assert.equal(remainingRefundableCents(2500, 1000, null), 1500);
assert.equal(remainingRefundableCents(2500, 0, 1500), 1500);
assert.equal(remainingRefundableCents(2500, 2000, 1500), 500);
assert.equal(remainingRefundableCents(2500, 2500, 2500), 0);

assert.deepEqual(parseRefundAmountCents(null, 1500), { cents: 1500 });
assert.equal(parseRefundAmountCents(1500, 1500).cents, 1500);
assert.equal(parseRefundAmountCents(500, 1500).cents, 500);
assert.ok(parseRefundAmountCents(1501, 1500).error);
assert.ok(parseRefundAmountCents(0, 1500).error);
assert.ok(parseRefundAmountCents(1.5, 1500).error);
assert.ok(parseRefundAmountCents('500', 1500).error);
assert.ok(parseRefundAmountCents(null, 0).error);

assert.equal(refundOrderStatus(2500, 2500, false), 'refunded');
assert.equal(refundOrderStatus(100, 2500, false), 'partially_refunded');
assert.equal(refundOrderStatus(2499, 2500, true), 'refunded');
assert.equal(refundOrderStatus(0, 2500, false), 'paid');

const key = refundIdempotencyKey('abc', 0, 500);
assert.equal(key, refundIdempotencyKey('abc', 0, 500));
assert.notEqual(key, refundIdempotencyKey('abc', 500, 500));

const src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const start = src.indexOf('async function handleProcessRefund');
const end = src.indexOf('export default');
assert.ok(start > 0 && end > start);
const fn = src.slice(start, end);
assert.equal(/\bbody\.stripe_account_id\b/.test(fn), false);
assert.equal(/\bbody\.sessionId\b/.test(fn), false);
assert.equal(/\bbody\.amount\b/.test(fn), false);
assert.equal(/\bbody\.amountCents\b/.test(fn), true);
assert.equal(fn.includes('/auth/v1/user'), true);
assert.equal(fn.includes('refundIdempotencyKey('), true);
assert.equal(fn.includes('stripe_account_id'), true);
assert.equal(fn.includes("service === 'process-refund'"), false);
assert.equal(src.includes("headers['Stripe-Account'] = accountId"), true);
assert.equal(src.includes("headers['Idempotency-Key'] = opts.idempotencyKey"), true);
assert.equal(src.includes("service === 'process-refund'"), true);
assert.equal(src.includes('Authorization, stripe-signature'), true);

console.log('refund checks ok');
