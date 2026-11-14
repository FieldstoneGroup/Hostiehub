/* Suggested host products. Shared by the browser and the assistant API.
 * Suggestions are never written to a store by this file. A host click does that.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHSuggestions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function reason(text) {
    return function () { return text; };
  }

  var CATALOG = [
    { key: 'early-checkin', name: 'Early check-in', description: 'Arrive before the usual time, when the property is free. We confirm it is available.', price: 40, unit: 'per stay', category: 'service', emoji: '🕐', notes_prompt: 'What time would you like to check in?', tags: ['core'], match: ['early check-in', 'early check in'], reason: reason('Guests often pay to arrive before the standard time.') },
    { key: 'late-checkout', name: 'Late check-out', description: 'Keep the property for a slower morning. Subject to the next booking.', price: 45, unit: 'per stay', category: 'service', emoji: '🛎️', notes_prompt: 'What time would you like to check out?', tags: ['core'], match: ['late check-out', 'late checkout', 'late check out'], reason: reason('A later departure is one of the most requested extras.') },
    { key: 'welcome-pack', name: 'Welcome pack', description: 'A small hamper of local snacks, coffee and a note, waiting on arrival.', price: 35, unit: 'per stay', category: 'product', emoji: '🎁', notes_prompt: 'Any dietary requirements or allergies?', tags: ['core'], match: ['welcome pack', 'welcome hamper', 'hamper'], reason: reason('A simple arrival hamper is an easy first sale.') },
    { key: 'extra-clean', name: 'Extra clean', description: 'An additional clean during the stay — surfaces, bathroom, and a linen refresh.', price: 85, unit: 'per clean', category: 'service', emoji: '🧹', notes_prompt: 'Which day should we clean? Any time to avoid?', tags: ['core', 'clean'], match: ['extra clean', 'mid-stay clean', 'midstay'], reason: reason('Longer stays often add a mid-stay clean.') },
    { key: 'pet-fee', name: 'Pet fee', description: 'Bring a dog or cat. Covers extra cleaning and a pet-friendly setup.', price: 30, unit: 'per pet', category: 'service', emoji: '🐾', notes_prompt: 'What type of pet, and how many?', tags: ['pet'], match: ['pet fee', 'pet ', 'dog'], reason: reason('If the property allows pets, a clear fee avoids awkward messages.') },
    { key: 'celebration', name: 'Celebration pack', description: 'Balloons, a card and a few treats set up before arrival for a birthday or anniversary.', price: 70, unit: 'per setup', category: 'service', emoji: '🎉', notes_prompt: 'What is the occasion? Any name or message for the card?', tags: ['occasion'], match: ['celebration', 'birthday'], reason: reason('Celebrations are a high-intent add-on guests will pay for.') },
    { key: 'grocery', name: 'Grocery pre-stock', description: 'Milk, bread, eggs, coffee and a few basics in the kitchen before check-in.', price: 45, unit: 'per stay', category: 'product', emoji: '🛒', notes_prompt: 'Any dietary requirements or items you want included?', tags: ['food'], match: ['grocery', 'pre-stock', 'prestock'], reason: reason('Guests landing late often want food already in the kitchen.') },
    { key: 'beach-setup', name: 'Beach day setup', description: 'Chairs, towels and a cooler ready for a day on the sand.', price: 55, unit: 'per day', category: 'experience', emoji: '🏖️', notes_prompt: 'How many people, and which day?', tags: ['beach'], match: ['beach'], reason: reason('Beach stays are a natural fit for a day-on-the-sand pack.') },
    { key: 'firewood', name: 'Firewood bundle', description: 'A bundle of split wood ready for the fireplace or fire pit.', price: 30, unit: 'per bundle', category: 'product', emoji: '🪵', notes_prompt: 'How many bundles would you like?', tags: ['alpine'], match: ['firewood', 'fire wood'], reason: reason('Cabins and cooler locations sell firewood without much explanation.') },
    { key: 'airport', name: 'Airport transfer', description: 'A pre-booked ride between the airport and the property.', price: 70, unit: 'per trip', category: 'service', emoji: '✈️', notes_prompt: 'Pickup or drop-off? Date, time and flight number?', tags: ['city'], match: ['airport', 'transfer'], reason: reason('City and apartment stays often get asked for a simple airport ride.') }
  ];

  function norm(value) {
    return String(value || '').toLowerCase();
  }

  function already(products, item) {
    var names = (products || []).map(function (p) { return norm(p.name); });
    return names.some(function (name) {
      if (!name) return false;
      if (name.indexOf(norm(item.name)) !== -1) return true;
      return (item.match || []).some(function (needle) { return name.indexOf(needle) !== -1; });
    });
  }

  function fits(item, ctx) {
    if (item.tags.indexOf('beach') !== -1) return /beach|coast|surf|bay|ocean|island/.test(ctx.blob);
    if (item.tags.indexOf('alpine') !== -1) return /cabin|alpine|mountain|snow|chalet|farm|cottage|fireplace/.test(ctx.blob);
    if (item.tags.indexOf('city') !== -1) return /apartment|unit|flat|loft|hotel|city|cbd|airport/.test(ctx.blob);
    if (item.tags.indexOf('pet') !== -1) return ctx.type === '' || /house|home|cabin|villa|farm|cottage|beach|bungalow/.test(ctx.type);
    return true;
  }

  function toSuggestion(item) {
    return {
      action: 'add',
      key: item.key,
      name: item.name,
      description: item.description,
      price: item.price,
      unit: item.unit,
      category: item.category,
      emoji: item.emoji,
      notes_prompt: item.notes_prompt,
      reason: item.reason()
    };
  }

  function suggest(input) {
    input = input || {};
    var products = input.products || [];
    var q = norm(input.question);
    var type = norm(input.propertyType);
    var loc = norm(input.location);
    var ctx = { type: type, loc: loc, blob: type + ' ' + loc, q: q };
    var missing = CATALOG.filter(function (item) { return fits(item, ctx) && !already(products, item); });
    var edits = [];
    var replyKey = 'assistant.replyIdeas';
    var picks = missing;

    if (/pric|charge|how much|cost|fee/.test(q)) {
      replyKey = 'assistant.replyPricing';
      products.forEach(function (product) {
        var match = CATALOG.find(function (item) { return already([product], item); });
        var current = Number(product.price);
        if (!match || !product.id || !isFinite(current) || match.price <= 0) return;
        if (Math.abs(current - match.price) / match.price < 0.15) return;
        edits.push({
          action: 'edit',
          productId: product.id,
          name: product.name,
          price: match.price,
          fromPrice: current,
          unit: product.unit || match.unit,
          description: product.description || match.description,
          emoji: product.emoji || match.emoji,
          reason: 'Similar stays often list ' + match.name + ' at $' + match.price + '.'
        });
      });
      picks = missing.filter(function (item) { return item.tags.indexOf('core') !== -1; }).slice(0, 4);
    } else if (/pet|dog|cat/.test(q)) {
      replyKey = 'assistant.replyPet';
      picks = CATALOG.filter(function (item) { return item.key === 'pet-fee' && !already(products, item); });
    } else if (/early|late|check-?in|check-?out/.test(q)) {
      replyKey = 'assistant.replyTimes';
      picks = missing.filter(function (item) { return item.key === 'early-checkin' || item.key === 'late-checkout'; });
    } else if (/clean/.test(q)) {
      replyKey = 'assistant.replyClean';
      picks = missing.filter(function (item) { return item.tags.indexOf('clean') !== -1; });
    } else if (/celebrat|birthday|anniversary/.test(q)) {
      replyKey = 'assistant.replyCelebration';
      picks = missing.filter(function (item) { return item.key === 'celebration' || item.key === 'welcome-pack'; });
    } else {
      picks = missing.filter(function (item) {
        return item.tags.indexOf('core') !== -1 || item.tags.indexOf('occasion') !== -1 || item.tags.indexOf('beach') !== -1 || item.tags.indexOf('alpine') !== -1 || item.tags.indexOf('city') !== -1 || item.tags.indexOf('food') !== -1 || item.tags.indexOf('pet') !== -1;
      });
      picks.sort(function (a, b) {
        function rank(item) {
          if (item.tags.indexOf('beach') !== -1 || item.tags.indexOf('alpine') !== -1 || item.tags.indexOf('city') !== -1) return 0;
          if (item.tags.indexOf('core') !== -1) return 1;
          return 2;
        }
        return rank(a) - rank(b);
      });
      picks = picks.slice(0, 6);
    }

    if (!picks.length && !edits.length) replyKey = 'assistant.replyCovered';

    return {
      provider: 'rules',
      replyKey: replyKey,
      suggestions: edits.concat(picks.map(toSuggestion))
    };
  }

  return { CATALOG: CATALOG, suggest: suggest };
});
