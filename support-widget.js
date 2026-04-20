(function() {
  // ── STYLES ──
  const style = document.createElement('style');
  style.textContent = `
    #hw-bubble { position:fixed; bottom:24px; right:24px; width:52px; height:52px; border-radius:50%; background:#2C6E6A; color:white; font-size:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 16px rgba(44,110,106,0.4); z-index:999999; border:none; transition:transform 0.2s, box-shadow 0.2s; }
    #hw-bubble:hover { transform:scale(1.08); box-shadow:0 6px 20px rgba(44,110,106,0.5); }
    @media (max-width:600px) { #hw-bubble { bottom:80px !important; right:16px !important; z-index:999999 !important; } #hw-widget { bottom:144px !important; right:16px !important; max-width:calc(100vw - 32px) !important; z-index:999998 !important; } }
    #hw-widget { position:fixed; bottom:88px; right:24px; width:360px; max-width:calc(100vw - 48px); background:white; border-radius:20px; box-shadow:0 12px 48px rgba(0,0,0,0.18); z-index:999998; display:none; flex-direction:column; overflow:hidden; font-family:'DM Sans',sans-serif; max-height:520px; }
    #hw-widget.open { display:flex; animation:hwFadeIn 0.2s ease; }
    @keyframes hwFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    #hw-header { background:#1d4d4a; padding:16px 18px; display:flex; align-items:center; justify-content:space-between; }
    #hw-header-left { display:flex; align-items:center; gap:10px; }
    #hw-avatar { width:36px; height:36px; background:#E8A838; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
    #hw-header-title { font-size:14px; font-weight:600; color:white; line-height:1.3; }
    #hw-header-sub { font-size:11px; color:rgba(255,255,255,0.6); margin-top:1px; }
    #hw-close { background:none; border:none; color:rgba(255,255,255,0.7); font-size:18px; cursor:pointer; padding:4px; line-height:1; }
    #hw-close:hover { color:white; }
    #hw-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; min-height:200px; }
    .hw-msg { max-width:85%; padding:10px 14px; border-radius:14px; font-size:13px; line-height:1.5; }
    .hw-msg-bot { background:#f4f6f5; color:#1a1a1a; border-bottom-left-radius:4px; align-self:flex-start; }
    .hw-msg-user { background:#2C6E6A; color:white; border-bottom-right-radius:4px; align-self:flex-end; }
    .hw-msg-typing { background:#f4f6f5; border-bottom-left-radius:4px; align-self:flex-start; padding:12px 16px; }
    .hw-dots { display:flex; gap:4px; }
    .hw-dots span { width:7px; height:7px; background:#9ca3af; border-radius:50%; animation:hwBounce 1.2s infinite; }
    .hw-dots span:nth-child(2) { animation-delay:0.2s; }
    .hw-dots span:nth-child(3) { animation-delay:0.4s; }
    @keyframes hwBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-6px); } }
    #hw-input-wrap { border-top:1.5px solid #e8e4df; padding:12px 14px; display:flex; gap:8px; align-items:flex-end; }
    #hw-input { flex:1; border:1.5px solid #e8e4df; border-radius:10px; padding:9px 12px; font-family:'DM Sans',sans-serif; font-size:13px; color:#1a1a1a; outline:none; resize:none; min-height:38px; max-height:100px; line-height:1.4; transition:border-color 0.2s; }
    #hw-input:focus { border-color:#2C6E6A; }
    #hw-send { width:36px; height:36px; border-radius:10px; background:#2C6E6A; color:white; border:none; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.2s; }
    #hw-send:hover { background:#1d4d4a; }
    #hw-send:disabled { background:#9ca3af; cursor:not-allowed; }
  `;
  document.head.appendChild(style);

  // ── HTML ──
  document.body.insertAdjacentHTML('beforeend', `
    <button id="hw-bubble" title="Chat with Hostie Hub Support">💬</button>
    <div id="hw-widget">
      <div id="hw-header">
        <div id="hw-header-left">
          <div id="hw-avatar">🏠</div>
          <div>
            <div id="hw-header-title">Hostie Hub Support</div>
            <div id="hw-header-sub">Powered by AI · Usually replies instantly</div>
          </div>
        </div>
        <button id="hw-close">✕</button>
      </div>
      <div id="hw-messages"></div>
      <div id="hw-input-wrap">
        <textarea id="hw-input" placeholder="Ask anything about your store..." rows="1"></textarea>
        <button id="hw-send">➤</button>
      </div>
    </div>
  `);

  // ── STATE ──
  const WORKER_URL = 'https://hostie-hub-ai.still-feather-9559.workers.dev';
  let messages = [];
  let isOpen = false;
  let isLoading = false;
  let greeted = false;

  const bubble = document.getElementById('hw-bubble');
  const widget = document.getElementById('hw-widget');
  const closeBtn = document.getElementById('hw-close');
  const input = document.getElementById('hw-input');
  const sendBtn = document.getElementById('hw-send');
  const messagesEl = document.getElementById('hw-messages');

  // ── OPEN / CLOSE ──
  function openWidget() {
    isOpen = true;
    widget.classList.add('open');
    bubble.innerHTML = '✕';
    if (!greeted) {
      greeted = true;
      addMessage('bot', "Hi! 👋 I'm your Hostie Hub assistant. I can help with setting up your store, managing products, connecting Stripe, understanding your analytics, or anything else. What do you need help with?");
    }
    setTimeout(() => input.focus(), 200);
  }

  function closeWidget() {
    isOpen = false;
    widget.classList.remove('open');
    bubble.innerHTML = '💬';
  }

  bubble.addEventListener('click', () => isOpen ? closeWidget() : openWidget());
  closeBtn.addEventListener('click', closeWidget);

  // ── MESSAGES ──
  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'hw-msg hw-msg-' + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'hw-msg hw-msg-typing';
    div.id = 'hw-typing';
    div.innerHTML = '<div class="hw-dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('hw-typing');
    if (el) el.remove();
  }

  // ── SEND ──
  async function send() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    input.style.height = 'auto';
    isLoading = true;
    sendBtn.disabled = true;

    addMessage('user', text);
    messages.push({ role: 'user', content: text });
    showTyping();

    try {
      const res = await fetch('https://hostie-hub-ai.still-feather-9559.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: "You are a friendly and knowledgeable support assistant for Hostie Hub (hostiehub.com.au) — an Australian SaaS platform for short-term rental hosts and local partner businesses. Here is everything you need to know:\n\nHOST DASHBOARD (dashboard.html):\n- Hosts create a guest store where guests can browse and purchase add-ons, experiences and local partner products before their stay\n- Pages: Overview, Orders, Store Settings, Properties, Products, Local Products, Analytics, Stripe Connect, Account & Billing, Users & Calendar\n- Products: hosts add their own products (flowers, hampers, early check-in etc) with price, category, emoji/photo, notes prompt for guests, and which properties it applies to. They can also browse preset products.\n- Products can be single-price, have variants (size/quantity options with different prices), or be multi-product listings (a bundle where guests pick from sub-products).\n- Local Products: two sections — (1) 'Your Suppliers' where hosts add products from their own local vendors with wholesale/RRP pricing and a vendor email, and (2) Partner listings from businesses that signed up to Hostie Hub directly. For supplier products, when a guest buys one, the vendor automatically gets an email with the order details, 'Ready by [check-in date]' and the host's contact info — vendor only sees wholesale prices, not RRP.\n- Partner listings show as booking-link cards in the guest store with a green border if they have a voucher attached\n- Sort order: hosts can drag products to reorder them — this order is reflected in the guest store\n- Analytics: store opens, product clicks, orders, revenue, most-clicked products with conversion rate, revenue chart, financial report with CSV export\n- Store Settings: store name, tagline, welcome message, brand colour, postcode (used to match local partner products)\n- Properties: hosts add their rental properties so guests can select which one they're staying at. Each property can have an address used on vendor emails when 'share address with vendor' is enabled on a supplier product.\n- Stripe Connect: hosts connect their Stripe account to receive guest payments directly\n- Users & Calendar: add cleaners/co-hosts to receive order notifications; subscribe to iCal feed for Google/Apple/Outlook calendar sync\n- Account & Billing: hosts add their mobile phone number here (used on vendor order emails so suppliers can reach them directly).\n\nHOST PRICING:\n- Free: $0 forever, no card needed. Local guide only — hosts get a store URL with auto-populated partner listings, but cannot add their own products or accept payments.\n- Host: $99/year, covers 1 property. Adds own products, custom branding, Stripe payments (100% to host, no commission), order dashboard, analytics.\n- Pro: $199/year, covers 2–10 properties. Adds revenue-by-property reporting, bulk management, priority support, early access to new features.\n- Enterprise: custom pricing for 11+ properties. White label, dedicated onboarding, custom integrations.\n- All paid plans have a 3-month free trial. No commissions on sales, ever — the subscription is all Hostie Hub charges. Only fees are Stripe's standard payment processing (~1.7% + 30¢).\n\nPARTNER DASHBOARD (partner-dashboard.html):\n- For local businesses (restaurants, tour operators, experience providers etc) to list their offerings in nearby host stores\n- Partners create 'Listings' which are either Physical products (with wholesale price that hosts mark up) or Booking links (free to guests, drives bookings)\n- Listing fields: name, description, category (Product/Service/Reservation/Experience), notes (the 'hook' shown to guests), type, booking URL, VOUCHER (PDF or image upload), voucher title, product photo, suburb/postcode radius picker\n- VOUCHERS: partners upload a PDF or image voucher in their listing. When a guest clicks 'Book now' in the guest store, a modal asks for their email and the voucher is emailed to them automatically via Resend. The voucher title becomes the email subject: 'Hostie Hub Voucher — [title]'\n- Voucher redemptions are tracked in Analytics — partner can see every guest email that claimed a voucher and export as CSV\n- Analytics: views, clicks, CTR, purchases per listing, period selector (30/60/90/all time), email report button, voucher redemptions table\n\nPARTNER PRICING: Hostie Hub is FREE for partner businesses. Partners don't pay anything to list — Hostie Hub earns only from host subscriptions.\n\nGUEST STORE (guest-store.html):\n- Guests access via hostiehub.com.au/store/[username] or [username].hostiehub.com.au\n- Guests browse products by category, add to cart, enter their name/email/dates/property at checkout, pay via Stripe\n- Multi-product listings open a mini-store modal where guests pick quantities of each sub-product, then click Done\n- Booking link listings show a green-bordered card with the partner notes as a bold green hook, and a 'Book now' button\n- If a voucher is attached to a booking link, guests enter their email and receive the voucher by email before being sent to the booking page\n- Store tracks opens, product clicks and purchases for host analytics\n\nTECH STACK: Supabase (database/auth/storage), Cloudflare Worker (API proxy for Claude/Resend/Stripe), Vercel (hosting), Stripe Connect, Resend (email)\n\nBe concise, warm and accurate. Never say a feature doesn't exist without being certain — when in doubt, describe what you do know. The support email is hello@hostiehub.com.au.",
          messages: messages
        })
      });

      const data = await res.json();
      removeTyping();

      const reply = data.content && data.content[0] && data.content[0].text
        ? data.content[0].text
        : "Sorry, I couldn't get a response right now. Please try again or email hello@hostiehub.com.au";

      messages.push({ role: 'assistant', content: reply });
      addMessage('bot', reply);

    } catch(e) {
      removeTyping();
      addMessage('bot', "Sorry, something went wrong. Please email hello@hostiehub.com.au for help.");
      console.error('Support widget error:', e);
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', send);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

})();
