/* Host subscription: one monthly price, billed per property.
 *
 * Volume tiers (every property is charged at the rate of the tier you reach):
 *   1–2 properties   $10 AUD each
 *   3–10 properties  $8 AUD each
 *   11+ properties   $6 AUD each
 *
 * First month is free (30-day trial). No card is required to start.
 * Hosts keep 100% of guest sales. Hostie Hub takes no commission.
 *
 * Checkout uses Stripe price price_1UbZFJFGh2TNwWGYsQhTzePk
 * (product prod_VcosxU73288ZLQ on account acct_1TH1K4FGh2TNwWGY).
 * Set HOSTIE_STRIPE_PRICE_ID to that price. Do not use prod_Vcoq2mnFXsp5ij.
 */
(function (root) {
  var TIERS = [
    { min: 1, max: 2, unitAud: 10 },
    { min: 3, max: 10, unitAud: 8 },
    { min: 11, max: null, unitAud: 6 }
  ];

  var PRICING = {
    TIERS: TIERS,
    FROM_AUD: 6,
    CURRENCY: 'aud',
    TRIAL_DAYS: 30,
    PLATFORM_FEE_PERCENT: 0,
    STRIPE_ACCOUNT_ID: 'acct_1TH1K4FGh2TNwWGY',
    STRIPE_PRODUCT_ID: 'prod_VcosxU73288ZLQ',
    STRIPE_PRICE_ID: 'price_1UbZFJFGh2TNwWGYsQhTzePk'
  };

  function money(amount) {
    return '$' + amount;
  }

  function rateForCount(count) {
    var n = Number(count) || 0;
    if (n >= 11) return 6;
    if (n >= 3) return 8;
    return 10;
  }

  function billableQuantity(count) {
    var n = Number(count) || 0;
    return n > 0 ? n : 1;
  }

  function monthlyTotal(count) {
    var quantity = billableQuantity(count);
    return rateForCount(quantity) * quantity;
  }

  function text(key, fallback) {
    if (root.hhT) {
      var value = root.hhT(key);
      if (value && value !== key) return value;
    }
    return fallback;
  }

  function applyPrices(scope) {
    var rootEl = scope || document;
    rootEl.querySelectorAll('[data-price-from]').forEach(function (el) {
      el.textContent = money(PRICING.FROM_AUD);
    });
    rootEl.querySelectorAll('[data-price-label]').forEach(function (el) {
      el.textContent = money(PRICING.FROM_AUD);
    });
    rootEl.querySelectorAll('[data-price-table]').forEach(function (el) {
      var onDark = Boolean(el.closest && el.closest('.hosts-section, .hh-price-on-dark'));
      var rows = TIERS.map(function (tier) {
        var label = tier.max == null ? (tier.min + '+') : (tier.min + '–' + tier.max);
        return '<tr><td>' + label + '</td><td>' + money(tier.unitAud) + '</td></tr>';
      }).join('');
      el.innerHTML = '<table class="hh-tier-table' + (onDark ? ' hh-tier-on-dark' : '') + '">'
        + '<thead><tr><th>' + text('pricing.colProperties', 'Properties') + '</th><th>' + text('pricing.colEach', 'Each per month') + '</th></tr></thead>'
        + '<tbody>' + rows + '</tbody></table>'
        + '<p class="hh-tier-note">' + text('pricing.tierNote', 'Every property is billed at the rate for the tier you reach.') + '</p>';
    });
  }

  function ensureStyle() {
    if (document.getElementById('hh-tier-style')) return;
    var style = document.createElement('style');
    style.id = 'hh-tier-style';
    style.textContent = ''
      + '.hh-tier-table{width:100%;border-collapse:collapse;margin-top:12px;text-align:left}'
      + '.hh-tier-table th,.hh-tier-table td{padding:8px 4px;border-bottom:1px solid #e8e4df;font-size:14px}'
      + '.hh-tier-table th{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;font-weight:700}'
      + '.hh-tier-table td:last-child,.hh-tier-table th:last-child{text-align:right;font-weight:700}'
      + '.hh-tier-note{margin:10px 0 0;font-size:13px;line-height:1.45;color:#6b7280}'
      + '.hh-tier-on-dark th,.hh-tier-on-dark td{border-bottom-color:rgba(255,255,255,.18);color:#fff}'
      + '.hh-tier-on-dark th{color:rgba(255,255,255,.75)}'
      + '.hh-tier-on-dark + .hh-tier-note,.hosts-section .hh-tier-note{color:rgba(255,255,255,.85)}';
    document.head.appendChild(style);
  }

  root.HOSTIE_PRICING = PRICING;
  root.hhRateForCount = rateForCount;
  root.hhBillableQuantity = billableQuantity;
  root.hhMonthlyTotal = monthlyTotal;
  root.hhPriceLabel = function () { return money(PRICING.FROM_AUD); };
  root.hhApplyPrices = function (scope) { ensureStyle(); applyPrices(scope); };

  function boot() { ensureStyle(); applyPrices(document); }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    document.addEventListener('hh-locale-ready', boot);
    document.addEventListener('hh-locale', boot);
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {
      PRICING: PRICING,
      rateForCount: rateForCount,
      billableQuantity: billableQuantity,
      monthlyTotal: monthlyTotal
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
