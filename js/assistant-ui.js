/* Store assistant panel. Proposals render with Add / Apply.
 * This file never writes to Supabase. window.hhApplySuggestion does, on click.
 */
(function () {
  var last = null;

  function text(key, fallback) {
    if (window.hhT) {
      var value = window.hhT(key);
      if (value && value !== key) return value;
    }
    return fallback;
  }

  function context() {
    if (typeof window.hhAssistantContext === 'function') return window.hhAssistantContext();
    return { propertyType: '', location: '', products: [] };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function replyText(result) {
    if (result.provider && result.provider !== 'rules' && result.reply) return result.reply;
    return text(result.replyKey || 'assistant.replyIdeas', 'Here are a few ideas. Nothing is added until you press Add.');
  }

  function card(suggestion, index) {
    var edit = suggestion.action === 'edit';
    var price = edit && suggestion.fromPrice != null
      ? '$' + suggestion.fromPrice + ' → $' + suggestion.price
      : '$' + suggestion.price + (suggestion.unit ? ' ' + suggestion.unit : '');
    var label = edit ? text('assistant.apply', 'Apply') : text('assistant.add', 'Add');
    return ''
      + '<article class="hh-suggest">'
      + '<div class="hh-suggest-emoji">' + escapeHtml(suggestion.emoji || '✨') + '</div>'
      + '<div class="hh-suggest-copy"><strong>' + escapeHtml(suggestion.name) + '</strong>'
      + '<p>' + escapeHtml(suggestion.description || suggestion.reason || '') + '</p>'
      + '<div class="hh-suggest-price">' + escapeHtml(price) + '</div></div>'
      + '<button type="button" class="hh-suggest-btn" data-suggest="' + index + '">' + escapeHtml(label) + '</button>'
      + '</article>';
  }

  function renderResult(result) {
    var box = document.getElementById('hhAssistantResult');
    if (!box) return;
    last = result;
    var cards = (result.suggestions || []).map(card).join('');
    var note = result.provider === 'rules'
      ? '<p class="hh-assistant-note">' + escapeHtml(text('assistant.rulesHint', 'Built-in suggestions for this property. Nothing changes until you press Add or Apply.')) + '</p>'
      : '';
    box.innerHTML = '<p class="hh-assistant-reply">' + escapeHtml(replyText(result)) + '</p>' + note
      + (cards || '<p class="hh-assistant-note">' + escapeHtml(text('assistant.empty', 'Nothing new to suggest right now.')) + '</p>');
  }

  async function ask(question) {
    var status = document.getElementById('hhAssistantStatus');
    if (status) status.textContent = text('assistant.thinking', 'Thinking…');
    var ctx = context();
    var payload = {
      question: question,
      propertyType: ctx.propertyType,
      location: ctx.location,
      products: ctx.products || [],
      locale: window.hhLocale ? window.hhLocale() : 'en'
    };
    var result;
    try {
      var response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json();
      if (!result || !result.suggestions) throw new Error('bad');
    } catch (err) {
      result = window.HHSuggestions
        ? window.HHSuggestions.suggest(payload)
        : { replyKey: 'assistant.replyIdeas', suggestions: [], provider: 'rules' };
    }
    if (status) status.textContent = '';
    renderResult(result);
  }

  function mount() {
    var root = document.getElementById('storeAssistant');
    if (!root || root.getAttribute('data-ready') === '1') {
      if (root && last) renderResult(last);
      return;
    }
    root.setAttribute('data-ready', '1');
    if (!document.getElementById('hh-assistant-style')) {
      var style = document.createElement('style');
      style.id = 'hh-assistant-style';
      style.textContent = ''
        + '#storeAssistant{font-family:"DM Sans",sans-serif}'
        + '.hh-assistant-lead{color:#6b7280;font-size:14px;line-height:1.55;margin:0 0 14px}'
        + '.hh-assistant-prompts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}'
        + '.hh-assistant-prompts button,.hh-suggest-btn{border:1.5px solid #2C6E6A;background:#fff;color:#1d4d4a;border-radius:999px;padding:8px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}'
        + '.hh-suggest-btn{background:#2C6E6A;color:#fff;white-space:nowrap}'
        + '.hh-assistant-form{display:flex;gap:8px;margin-bottom:14px}'
        + '.hh-assistant-form input{flex:1;border:1.5px solid #e8e4df;border-radius:12px;padding:12px 14px;font:inherit;font-size:14px}'
        + '.hh-assistant-form button{background:#2C6E6A;color:#fff;border:0;border-radius:12px;padding:0 16px;font:inherit;font-weight:700;cursor:pointer}'
        + '.hh-assistant-reply{font-size:15px;line-height:1.5;margin:0 0 12px}'
        + '.hh-assistant-note{font-size:12px;color:#6b7280;margin:0 0 10px}'
        + '.hh-suggest{display:flex;gap:12px;align-items:center;border:1.5px solid #e8e4df;border-radius:14px;padding:12px;margin-bottom:8px;background:#fff}'
        + '.hh-suggest-emoji{font-size:26px;width:42px;text-align:center}'
        + '.hh-suggest-copy{flex:1} .hh-suggest-copy p{margin:2px 0 0;color:#6b7280;font-size:13px}'
        + '.hh-suggest-price{font-size:13px;font-weight:700;color:#1d4d4a;margin-top:4px}'
        + '.hh-suggest-btn[disabled]{opacity:.6;cursor:default}';
      document.head.appendChild(style);
    }
    root.innerHTML = ''
      + '<p class="hh-assistant-lead" data-i18n="assistant.lead"></p>'
      + '<div class="hh-assistant-prompts">'
      + '<button type="button" data-ask="what">' + text('assistant.askWhat', 'What should I add?') + '</button>'
      + '<button type="button" data-ask="price">' + text('assistant.askPrice', 'Pricing ideas') + '</button>'
      + '</div>'
      + '<form class="hh-assistant-form" id="hhAssistantForm">'
      + '<input id="hhAssistantInput" data-i18n-placeholder="assistant.placeholder" placeholder="Ask what to add, or for a price">'
      + '<button type="submit" data-i18n="assistant.send">Ask</button></form>'
      + '<div id="hhAssistantStatus" class="hh-assistant-note"></div>'
      + '<div id="hhAssistantResult"></div>';
    if (window.hhApplyI18n) window.hhApplyI18n(root);
    root.querySelectorAll('[data-ask]').forEach(function (button) {
      button.addEventListener('click', function () {
        ask(button.getAttribute('data-ask') === 'price' ? 'pricing ideas' : 'what should I add');
      });
    });
    root.querySelector('#hhAssistantForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var value = root.querySelector('#hhAssistantInput').value.trim();
      ask(value || 'what should I add');
    });
    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-suggest]');
      if (!button || !last) return;
      var suggestion = last.suggestions[Number(button.getAttribute('data-suggest'))];
      if (!suggestion || typeof window.hhApplySuggestion !== 'function') return;
      button.disabled = true;
      Promise.resolve(window.hhApplySuggestion(suggestion)).then(function (ok) {
        if (ok === false) { button.disabled = false; return; }
        button.textContent = text('assistant.done', 'Done');
      }).catch(function () { button.disabled = false; });
    });
  }

  window.hhMountAssistant = mount;
  document.addEventListener('hh-locale', function () {
    var root = document.getElementById('storeAssistant');
    if (root) root.removeAttribute('data-ready');
    mount();
    if (last) renderResult(last);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
