// Hostie Hub host dashboard: floating store agent (chat + store tools with confirm cards).
// Backend: Supabase Edge Function "store-agent" (same tools as the Live Stay Guide agent).
// The agent only PROPOSES store changes. Products change only when the host taps Confirm on a card,
// using their own signed-in session. Replaces support-widget.js on dashboard.html (it also answers support questions).
(function () {
  if (window.__hhAgent) return; window.__hhAgent = true;
  const css = `
#hha-fab{position:fixed;right:24px;bottom:24px;z-index:99990;display:flex;align-items:center;gap:8px;height:52px;padding:0 18px 0 14px;border:none;border-radius:26px;background:#1d4d4a;color:#fff;font:600 14px 'DM Sans',system-ui,sans-serif;box-shadow:0 6px 20px rgba(29,77,74,.35);cursor:pointer}
#hha-fab .ic{width:28px;height:28px;border-radius:50%;background:#E8A838;display:grid;place-items:center;font-size:15px}
#hha-fab[hidden]{display:none}
#hha-panel{position:fixed;right:24px;bottom:24px;z-index:99991;width:400px;max-width:calc(100vw - 32px);height:min(640px,calc(100vh - 48px));background:#fff;border-radius:20px;box-shadow:0 16px 60px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;color:#1a1a1a}
#hha-panel[hidden]{display:none}
#hha-head{background:#1d4d4a;color:#fff;padding:14px 14px 14px 16px;display:flex;align-items:center;gap:10px}
#hha-head .av{width:36px;height:36px;border-radius:50%;background:#E8A838;display:grid;place-items:center;font-size:18px;flex-shrink:0}
#hha-head .tt{flex:1;min-width:0}#hha-head b{display:block;font-size:15px}#hha-head small{display:block;font-size:11.5px;opacity:.75;line-height:1.3}
#hha-head button{background:rgba(255,255,255,.12);border:none;color:#fff;width:36px;height:36px;border-radius:10px;font-size:16px;cursor:pointer;flex-shrink:0}
#hha-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f7f5f2;overscroll-behavior:contain}
.hha-m{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.hha-m p{margin:0 0 6px}.hha-m p:last-child{margin:0}.hha-m ul{margin:4px 0;padding-left:18px}
.hha-u{align-self:flex-end;background:#2C6E6A;color:#fff;border-bottom-right-radius:4px}
.hha-a{align-self:flex-start;background:#fff;border:1px solid #ebe6df;border-bottom-left-radius:4px}
.hha-a.err{background:#fff4f2;border-color:#f3c7bf}
.hha-dots{display:flex;gap:4px;padding:4px 2px}.hha-dots i{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:hhaB 1.2s infinite}.hha-dots i:nth-child(2){animation-delay:.2s}.hha-dots i:nth-child(3){animation-delay:.4s}
@keyframes hhaB{0%,80%,100%{transform:none}40%{transform:translateY(-5px)}}
.hha-empty{padding:6px 2px;font-size:14px;color:#444}.hha-empty b{display:block;font-size:17px;margin-bottom:4px;color:#1a1a1a}
.hha-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.hha-chips button{border:1.5px solid #2C6E6A;background:#fff;color:#1d4d4a;border-radius:20px;padding:8px 12px;font:600 13px 'DM Sans',system-ui,sans-serif;cursor:pointer;text-align:left}
.hha-card{align-self:stretch;background:#fff;border:1px solid #e5e0d9;border-left:4px solid #2C6E6A;border-radius:14px;padding:13px 13px 11px;box-shadow:0 2px 10px rgba(0,0,0,.05);overflow-wrap:anywhere}
.hha-card.danger{border-left-color:#c0392b;background:#fff8f7}
.hha-card .k{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6b7280}
.hha-card .t{font-weight:700;font-size:15.5px;margin:3px 0 8px}
.hha-card dl{margin:0;display:grid;gap:6px}.hha-card dl div{display:grid;grid-template-columns:minmax(78px,32%) 1fr;gap:10px;font-size:13.5px}.hha-card dt{color:#6b7280}.hha-card dd{margin:0;min-width:0}
.hha-card .note{font-size:13px;background:#fdf3e1;border-radius:10px;padding:8px 10px;margin:10px 0 0}
.hha-card .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.hha-card .acts button{flex:1 1 130px;min-height:44px;border-radius:12px;font:700 14px 'DM Sans',system-ui,sans-serif;cursor:pointer;border:1.5px solid #2C6E6A}
.hha-card .ok{background:#2C6E6A;color:#fff}.hha-card.danger .ok{background:#c0392b;border-color:#c0392b}
.hha-card .no{background:#fff;color:#1d4d4a;border-color:#d8d2ca!important}
.hha-card button:disabled{opacity:.55;cursor:wait}
.hha-card .foot{font-size:12px;color:#6b7280;margin:8px 0 0}
.hha-card .done{margin-top:10px;font-weight:700;font-size:14px;color:#6b7280}.hha-card .done.applied{color:#2C6E6A}
#hha-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #ebe6df;background:#fff}
#hha-in{flex:1;min-width:0;border:1.5px solid #e2ddd6;border-radius:12px;padding:10px 12px;font:15px 'DM Sans',system-ui,sans-serif;resize:none;min-height:44px;max-height:120px;outline:none}
#hha-in:focus{border-color:#2C6E6A}
#hha-send{height:44px;padding:0 16px;border:none;border-radius:12px;background:#2C6E6A;color:#fff;font:700 14px 'DM Sans',system-ui,sans-serif;cursor:pointer;flex-shrink:0}
#hha-send:disabled{background:#9ca3af}
#hha-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1d4d4a;color:#fff;padding:10px 16px;border-radius:12px;font:600 14px 'DM Sans',system-ui,sans-serif;z-index:99999;max-width:calc(100vw - 32px);display:none}
@media (max-width:768px){
 #hha-fab{right:16px;bottom:84px;height:48px;padding:0 14px 0 10px}
 #hha-panel{left:0;right:0;bottom:0;width:auto;max-width:none;height:min(86vh,calc(100dvh - 40px));border-radius:20px 20px 0 0}
 body.hha-open{overflow:hidden}
}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.body.insertAdjacentHTML('beforeend', `
<button id="hha-fab" type="button" hidden aria-label="Open your store agent"><span class="ic" aria-hidden="true">✨</span><span>Store agent</span></button>
<section id="hha-panel" role="dialog" aria-modal="false" aria-labelledby="hha-title" hidden>
 <header id="hha-head"><div class="av" aria-hidden="true">🏠</div><div class="tt"><b id="hha-title">Your store agent</b><small>Adds, edits or removes products only when you tap Confirm</small></div><button type="button" id="hha-clear" title="Clear chat" aria-label="Clear chat">🗑</button><button type="button" id="hha-close" aria-label="Close">✕</button></header>
 <div id="hha-msgs" aria-live="polite"></div>
 <form id="hha-form"><textarea id="hha-in" rows="1" placeholder="Ask, or tell me what to change…" aria-label="Message your store agent"></textarea><button id="hha-send" type="submit">Send</button></form>
</section><div id="hha-toast" role="status"></div>`);
  const $ = (id) => document.getElementById(id);
  const fab = $('hha-fab'), panel = $('hha-panel'), msgsEl = $('hha-msgs'), input = $('hha-in'), sendBtn = $('hha-send');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = (t) => { let out = '', list = false; for (const l of esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n')) { const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/); if (m) { if (!list) { out += '<ul>'; list = true } out += '<li>' + m[1] + '</li>' } else { if (list) { out += '</ul>'; list = false } if (l.trim()) out += '<p>' + l.replace(/^#+\s*/, '') + '</p>' } } return out + (list ? '</ul>' : '') };
  const client = () => (typeof sb !== 'undefined' && sb && sb.functions) ? sb : (window.sb || null);
  const curHost = () => (typeof currentHost !== 'undefined' && currentHost) || window.currentHost || null;
  const hostId = () => (curHost() && curHost().id) || null;
  let items = null, busy = false, keyFor = null;
  const KEY = () => 'hha-chat-' + hostId();
  const save = () => { try { sessionStorage.setItem(KEY(), JSON.stringify(items.filter(i => !i.card).slice(-40))) } catch (_) {} };
  function toast(t) { const el = $('hha-toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', 4000) }
  async function call(body) {
    const c = client(); if (!c) throw Error('Please sign in again.');
    const r = await c.functions.invoke('store-agent', { body: { source: 'hostiehub', ...body } });
    if (r.error) { let m = r.error.message; try { const j = await r.error.context.json(); m = j.error || m } catch (_) {} throw Error(m) }
    return r.data;
  }
  const DONE = { add: 'Added to your store', edit: 'Change saved', hide: 'Hidden from guests', unhide: 'Showing to guests again', delete: 'Deleted' };
  function cardHtml(c) {
    const s = c.status, exp = s === 'proposed' && new Date(c.expires_at) < new Date();
    const done = s === 'applied' ? ((c.result && c.result.hidden_instead) || (c.op === 'delete' && c.effective_op === 'hide') ? 'Hidden from guests (kept for order history)' : DONE[c.op]) : s === 'cancelled' ? 'Cancelled' : 'Failed';
    return `<div class="hha-card${c.danger ? ' danger' : ''}" data-card="${esc(c.id)}"><div class="k">${c.danger ? '⚠️ ' : ''}Store change · needs your OK</div><div class="t">${esc(c.title)}</div><dl>${(c.rows || []).map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl>${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}${s === 'proposed' && !exp ? `<div class="acts"><button type="button" class="ok" data-act="apply" data-id="${esc(c.id)}" data-danger="${c.danger ? 1 : 0}" data-label="${esc(c.confirm_label)}">${esc(c.confirm_label)}</button><button type="button" class="no" data-act="cancel" data-id="${esc(c.id)}">Cancel</button></div><p class="foot">Nothing changes until you tap ${c.danger ? 'twice to confirm' : 'Confirm'}.</p>` : `<div class="done ${s}">${s === 'applied' ? '✓ ' : ''}${exp ? 'Expired. Ask your agent again.' : esc(done)}</div>`}</div>`;
  }
  function render(extra = '') {
    const first = ((curHost() && curHost().full_name) || '').split(' ')[0];
    msgsEl.innerHTML = (items.length ? items.map(i => i.card ? cardHtml(i.card) : i.role === 'user' ? `<div class="hha-m hha-u">${esc(i.content)}</div>` : `<div class="hha-m hha-a">${md(i.content)}</div>`).join('') :
      `<div class="hha-empty"><b>Hi${first ? ' ' + esc(first) : ''}, how can I help?</b>I can answer questions about Hostie Hub and add, edit, hide or remove products in your store. Nothing changes until you tap Confirm.<div class="hha-chips">${['Suggest 3 products for my guests', 'Add late checkout for $40', 'Show me my products', 'How do I connect Stripe?'].map(x => `<button type="button" data-ask="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`) + extra;
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  async function open() {
    panel.hidden = false; fab.hidden = true; document.body.classList.add('hha-open');
    if (!items || keyFor !== hostId()) {
      keyFor = hostId();
      try { items = JSON.parse(sessionStorage.getItem(KEY()) || '[]') } catch (_) { items = [] }
      render('<div class="hha-m hha-a"><div class="hha-dots"><i></i><i></i><i></i></div></div>');
      try { const d = await call({ action: 'pending' }); const pend = (d.cards || []).filter(c => c.status === 'proposed' && new Date(c.expires_at) > new Date()); for (const c of pend) items.push({ card: c }) } catch (_) {}
    }
    render(); setTimeout(() => input.focus(), 60);
  }
  function close() { panel.hidden = true; fab.hidden = !hostId(); document.body.classList.remove('hha-open') }
  async function send(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    busy = true; sendBtn.disabled = true; items.push({ role: 'user', content: text }); input.value = ''; input.style.height = '';
    render('<div class="hha-m hha-a hha-typing" aria-label="Your agent is typing"><div class="hha-dots"><i></i><i></i><i></i></div></div>');
    try {
      const history = items.filter(i => !i.card && !i.err).slice(-16).map(i => ({ role: i.role, content: i.content }));
      const d = await call({ action: 'chat', messages: history });
      items.push({ role: 'assistant', content: d.reply }); for (const c of d.cards || []) items.push({ card: c });
      save(); render();
    } catch (e) { items.pop(); input.value = text; render(`<div class="hha-m hha-a err">${esc(e.message || 'Something went wrong.')} Tap Send to try again.</div>`) }
    finally { busy = false; sendBtn.disabled = false }
  }
  async function act(b) {
    const id = b.dataset.id, a = b.dataset.act; if (b.disabled) return;
    if (a === 'apply' && b.dataset.danger === '1' && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to confirm'; clearTimeout(b._t); b._t = setTimeout(() => { delete b.dataset.armed; b.textContent = b.dataset.label }, 5000); return }
    const box = b.closest('.hha-card'); box.querySelectorAll('button').forEach(x => x.disabled = true);
    try {
      const d = await call({ action: a, id }); const it = items.find(i => i.card && i.card.id === id); if (it) it.card = d.card; box.outerHTML = cardHtml(d.card);
      if (a === 'apply') { toast(d.card.result && d.card.result.hidden_instead ? 'Hidden (kept for order history)' : DONE[d.card.op]); try { if (typeof loadProducts === 'function') await loadProducts() } catch (_) {} }
    } catch (e) { box.querySelectorAll('button').forEach(x => x.disabled = false); toast(e.message || 'Something went wrong') }
  }
  fab.onclick = open; $('hha-close').onclick = close;
  $('hha-clear').onclick = () => { if (!confirm('Clear this chat? Your store is not changed.')) return; items = []; save(); render() };
  $('hha-form').addEventListener('submit', (e) => { e.preventDefault(); send(input.value) });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); send(input.value) } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px' });
  msgsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) return act(b); const q = e.target.closest('[data-ask]'); if (q) send(q.dataset.ask) });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close() });
  // Show the button only to a signed-in host, on every dashboard screen.
  const tick = () => { const on = !!hostId(); if (panel.hidden) fab.hidden = !on; if (!on && !panel.hidden) close() };
  tick(); setInterval(tick, 1500);
})();
