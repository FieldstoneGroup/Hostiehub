/* Locale loader. Add a language by dropping locales/<code>.json next to en.json.
 * Guest stores (html[data-i18n-mode="guest"]) follow the browser language.
 * Marketing, signup, onboarding and the host dashboard remember hh_locale.
 * Host-entered product names are never passed through this dictionary.
 */
(function () {
  var SUPPORTED = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'];
  var NAMES = {
    en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
    it: 'Italiano', pt: 'Português', ja: '日本語', zh: '中文'
  };
  var mode = document.documentElement.getAttribute('data-i18n-mode') === 'guest' ? 'guest' : 'host';
  var storageKey = mode === 'guest' ? 'hh_guest_locale' : 'hh_locale';
  var dict = {};
  var english = {};
  var locale = 'en';

  function normalize(lang) {
    var value = String(lang || '').toLowerCase();
    if (value.indexOf('zh') === 0) return 'zh';
    var base = value.split('-')[0];
    return SUPPORTED.indexOf(base) !== -1 ? base : 'en';
  }

  function lookup(table, key) {
    return String(key || '').split('.').reduce(function (node, part) {
      return node && node[part] != null ? node[part] : null;
    }, table);
  }

  function t(key, vars) {
    var value = lookup(dict, key);
    if (value == null) value = lookup(english, key);
    if (value == null) value = key;
    var text = String(value);
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        text = text.split('{' + name + '}').join(String(vars[name]));
      });
    }
    return text;
  }

  function apply(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = t(el.getAttribute('data-i18n'));
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
      else el.textContent = value;
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
    document.querySelectorAll('[data-lang-current]').forEach(function (el) {
      el.textContent = locale.toUpperCase();
    });
    ensureCjkFont();
  }

  function ensureCjkFont() {
    if (locale !== 'ja' && locale !== 'zh') return;
    if (document.getElementById('hh-cjk-font')) return;
    var link = document.createElement('link');
    link.id = 'hh-cjk-font';
    link.rel = 'stylesheet';
    link.href = locale === 'ja'
      ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap'
      : 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap';
    document.head.appendChild(link);
    document.documentElement.style.setProperty('--hh-cjk', locale === 'ja' ? '"Noto Sans JP"' : '"Noto Sans SC"');
    document.body.style.fontFamily = 'var(--hh-cjk), "DM Sans", sans-serif';
  }

  function ensureStyle() {
    if (document.getElementById('hh-lang-style')) return;
    var style = document.createElement('style');
    style.id = 'hh-lang-style';
    style.textContent = ''
      + '#hhLangSwitcher{position:relative;font-family:"DM Sans",sans-serif}'
      + '#hhLangSwitcher.hh-lang-fixed{position:fixed;top:14px;right:14px;z-index:1000}'
      + '.hh-lang-btn{background:#fff;border:1.5px solid #e8e4df;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;color:#1d4d4a;cursor:pointer}'
      + '.hh-lang-menu{position:absolute;top:calc(100% + 6px);right:0;background:#fff;border:1.5px solid #e8e4df;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.12);min-width:160px;padding:6px;z-index:1001}'
      + '.hh-lang-menu button{display:block;width:100%;text-align:left;background:none;border:0;padding:8px 10px;border-radius:8px;font:inherit;font-size:14px;cursor:pointer;color:#1a1a1a}'
      + '.hh-lang-menu button[aria-selected="true"]{background:#e6f2f1;color:#1d4d4a;font-weight:700}'
      + '.hh-lang-menu button:hover{background:#faf9f7}';
    document.head.appendChild(style);
  }

  function mountSwitcher() {
    if (document.getElementById('hhLangSwitcher')) return;
    ensureStyle();
    var slot = document.querySelector('[data-lang-slot]');
    var wrap = document.createElement('div');
    wrap.id = 'hhLangSwitcher';
    wrap.className = slot ? '' : 'hh-lang-fixed';
    wrap.innerHTML = '<button type="button" class="hh-lang-btn" aria-haspopup="listbox" data-i18n-aria="lang.label" aria-label="Language"><span data-lang-current>' + locale.toUpperCase() + '</span></button><div class="hh-lang-menu" role="listbox" hidden></div>';
    var menu = wrap.querySelector('.hh-lang-menu');
    SUPPORTED.forEach(function (code) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = NAMES[code];
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', code === locale ? 'true' : 'false');
      button.addEventListener('click', function () { setLocale(code); menu.hidden = true; });
      menu.appendChild(button);
    });
    wrap.querySelector('.hh-lang-btn').addEventListener('click', function (event) {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', function () { menu.hidden = true; });
    (slot || document.body).appendChild(wrap);
  }

  async function load(code) {
    var response = await fetch('/locales/' + code + '.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('locale');
    return response.json();
  }

  async function setLocale(code) {
    locale = normalize(code);
    try { localStorage.setItem(storageKey, locale); } catch (err) { /* private mode */ }
    dict = locale === 'en' ? english : await load(locale).catch(function () { return english; });
    document.querySelectorAll('.hh-lang-menu button').forEach(function (button) {
      button.setAttribute('aria-selected', button.textContent === NAMES[locale] ? 'true' : 'false');
    });
    apply(document);
    document.dispatchEvent(new CustomEvent('hh-locale', { detail: { locale: locale } }));
  }

  function initialLocale() {
    var query = new URLSearchParams(location.search).get('lang');
    if (query) return normalize(query);
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved) return normalize(saved);
    } catch (err) { /* ignore */ }
    if (mode === 'guest') return normalize(navigator.language || navigator.userLanguage);
    return 'en';
  }

  async function boot() {
    locale = initialLocale();
    try { english = await load('en'); }
    catch (err) { english = {}; }
    dict = english;
    if (locale !== 'en') {
      dict = await load(locale).catch(function () { locale = 'en'; return english; });
    }
    mountSwitcher();
    apply(document);
    document.dispatchEvent(new CustomEvent('hh-locale-ready', { detail: { locale: locale } }));
  }

  window.hhT = t;
  window.hhSetLocale = setLocale;
  window.hhLocale = function () { return locale; };
  window.hhApplyI18n = apply;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
