/* Store assistant. Returns suggestions only. It never inserts or updates products.
 *
 * Optional LLM (falls back to rules when unset or when the call fails):
 *   HOSTIE_LLM_API_KEY     required to leave the rules fallback
 *   HOSTIE_LLM_PROVIDER    openai (default) or anthropic
 *   HOSTIE_LLM_MODEL       optional model id
 *   HOSTIE_LLM_BASE_URL    optional, OpenAI-compatible base URL
 */
const { suggest } = require('../js/suggestions');

function sanitize(list, knownIds) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 8).map(function (item) {
    var action = item && item.action === 'edit' ? 'edit' : 'add';
    var price = Number(item && item.price);
    var name = String(item && item.name || '').trim();
    if (!name || !isFinite(price) || price < 0 || price > 5000) return null;
    var productId = String(item.productId || '');
    if (action === 'edit' && !knownIds[productId]) return null;
    var category = ['service', 'product', 'experience'].indexOf(item.category) !== -1 ? item.category : 'service';
    return {
      action: action,
      key: String(item.key || '').slice(0, 40),
      productId: action === 'edit' ? productId : undefined,
      name: name.slice(0, 80),
      description: String(item.description || '').slice(0, 400),
      price: Math.round(price),
      fromPrice: item.fromPrice != null && isFinite(Number(item.fromPrice)) ? Number(item.fromPrice) : undefined,
      unit: String(item.unit || 'per stay').slice(0, 40),
      category: category,
      emoji: String(item.emoji || '✨').slice(0, 8),
      notes_prompt: String(item.notes_prompt || '').slice(0, 200),
      reason: String(item.reason || '').slice(0, 240)
    };
  }).filter(Boolean);
}

async function callLlm(input, rules) {
  var provider = (process.env.HOSTIE_LLM_PROVIDER || 'openai').toLowerCase();
  var model = process.env.HOSTIE_LLM_MODEL || (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini');
  var locale = String(input.locale || 'en').slice(0, 12);
  var system = [
    'You suggest extras for a short-stay host store.',
    'Return JSON only: {"reply":"...","suggestions":[...]}.',
    'Each suggestion is {action:"add"|"edit", name, description, price, unit, category, emoji, reason, notes_prompt, productId (edit only), fromPrice (edit only)}.',
    'Never say you added or changed anything. The host must press a button.',
    'Write reply in locale ' + locale + '. Keep product names in English.',
    'Prices are AUD whole dollars. Use only productId values from the existing products list for edits.'
  ].join(' ');
  var user = JSON.stringify({
    question: String(input.question || '').slice(0, 500),
    propertyType: input.propertyType || '',
    location: input.location || '',
    products: (input.products || []).slice(0, 40),
    rulesFallback: rules.suggestions
  });

  if (provider === 'anthropic') {
    var anthropic = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.HOSTIE_LLM_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 800,
        system: system,
        messages: [{ role: 'user', content: user }]
      })
    });
    var anthropicBody = await anthropic.json();
    if (!anthropic.ok) throw new Error('anthropic');
    var text = (anthropicBody.content || []).map(function (block) { return block.text || ''; }).join('\n');
    return JSON.parse(text.replace(/^```json\s*|```$/g, ''));
  }

  var base = (process.env.HOSTIE_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  var openai = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + process.env.HOSTIE_LLM_API_KEY
    },
    body: JSON.stringify({
      model: model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  var openaiBody = await openai.json();
  if (!openai.ok) throw new Error('openai');
  return JSON.parse(openaiBody.choices[0].message.content);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  var input = req.body || {};
  var rules = suggest({
    question: input.question,
    propertyType: input.propertyType,
    location: input.location,
    products: input.products
  });
  var knownIds = {};
  (input.products || []).forEach(function (product) { if (product && product.id) knownIds[product.id] = true; });

  if (!process.env.HOSTIE_LLM_API_KEY) {
    res.status(200).json(Object.assign({}, rules, {
      note: 'HOSTIE_LLM_API_KEY is not set. Using the rules fallback.'
    }));
    return;
  }

  try {
    var llm = await callLlm(input, rules);
    var suggestions = sanitize(llm.suggestions, knownIds);
    res.status(200).json({
      provider: (process.env.HOSTIE_LLM_PROVIDER || 'openai').toLowerCase(),
      reply: String(llm.reply || '').slice(0, 600),
      replyKey: rules.replyKey,
      suggestions: suggestions.length ? suggestions : rules.suggestions
    });
  } catch (err) {
    res.status(200).json(Object.assign({}, rules, {
      note: 'LLM call failed. Using the rules fallback.'
    }));
  }
};
