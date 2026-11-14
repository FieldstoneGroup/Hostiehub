/* Hostie Hub host pricing — the only place the public monthly price is set.
 *
 * Luke: change MONTHLY_PRICE_AUD from null to the AUD amount (GST inclusive)
 * when you have decided it. Until then every page shows "TBC".
 *
 * Charging is a separate switch and does NOT live here. Checkout is created
 * only by /api/host-subscription when BOTH of these server env vars are set:
 *   HOSTIE_STRIPE_PRICE_ID=price_...     (Stripe Billing monthly price)
 *   HOSTIE_MONTHLY_PRICE_AUD=29          (must match the number below)
 * An empty price id means no Checkout Session is created and no card is taken.
 * Hostie Hub does not take a commission or platform fee on guest sales.
 */
(function (root) {
  var PRICING = {
    MONTHLY_PRICE_AUD: null, // TBC — Luke sets this. Do not invent a number.
    CURRENCY: 'aud',
    TRIAL_DAYS: 30,
    PLATFORM_FEE_PERCENT: 0
  };

  function priceLabel() {
    var amount = PRICING.MONTHLY_PRICE_AUD;
    if (amount == null || amount === '' || Number(amount) <= 0) return 'TBC';
    var n = Number(amount);
    return '$' + (Math.round(n) === n ? String(n) : n.toFixed(2));
  }

  function applyPrices(scope) {
    var label = priceLabel();
    var pending = label === 'TBC';
    (scope || document).querySelectorAll('[data-price-label]').forEach(function (el) {
      el.textContent = label;
    });
    (scope || document).querySelectorAll('[data-price-pending]').forEach(function (el) {
      el.hidden = !pending;
    });
    (scope || document).querySelectorAll('[data-price-known]').forEach(function (el) {
      el.hidden = pending;
    });
  }

  root.HOSTIE_PRICING = PRICING;
  root.hhPriceLabel = priceLabel;
  root.hhApplyPrices = applyPrices;

  function boot() { applyPrices(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('hh-locale-ready', boot);
})(typeof window !== 'undefined' ? window : globalThis);
