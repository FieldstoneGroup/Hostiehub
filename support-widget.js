(function() {
  // ── HOSTIE HUB SUPPORT WIDGET ──
  const SYSTEM_PROMPT = `You are Hubs, the friendly AI support assistant for Hostie Hub — an Australian SaaS platform for short-term accommodation hosts.

Your job is to help hosts with questions about using Hostie Hub. You are knowledgeable, friendly, concise and helpful. You speak in a warm, Australian-friendly tone.

Here is everything you need to know about Hostie Hub:

WHAT IS HOSTIE HUB?
Hostie Hub is a platform that gives short-term rental hosts their own branded online extras store. Guests can browse and purchase add-ons (early check-in, flowers, wine, experiences etc.) before they arrive. All payments go directly to the host via Stripe — Hostie Hub charges a flat yearly subscription fee only, with no commissions.

PRICING:
- Host Plan: $99/yr — 1 to 3 properties, full feature set
- Pro Plan: $199/yr — 4 to 10 properties, plus analytics and priority support  
- Enterprise: Custom pricing — 11+ properties, white label option, dedicated support
- All plans include a 30-day free trial, no credit card required
- All prices include GST
- After trial, the store pauses until the host activates a plan

KEY FEATURES:
- Branded guest store at yourname.hostiehub.com.au
- Unlimited products with photos, descriptions, pricing and custom guest prompts
- Property selector — guests choose which property they're staying at
- Order dashboard with fulfillment tracking
- Email notifications for every order
- Stripe Connect — 100% of guest payments go to the host
- Local partner vouchers — businesses can list vouchers for nearby guests
- Custom branding — store name, colours, welcome message
- 30 day free trial, no credit card needed

HOW TO SET UP A STORE:
1. Sign up at hostiehub.com.au/signup.html
2. Add store name, tagline and brand colour in Store Settings
3. Add properties (the places guests stay)
4. Add products — use Browse Presets for quick setup or add custom products
5. Connect Stripe account to receive payments
6. Share your store link with guests

PRODUCTS:
- Add products via the Products section in the dashboard
- Each product has a name, description, price, unit (per stay/per person etc), category, emoji and optional photo
- Guest notes prompt — a question that appears when guests add the product to cart (e.g. "Red or white wine?")
- Products can be assigned to all properties or specific ones
- Browse Presets gives quick access to popular products like early check-in, flowers, wine etc
- Categories: Arrival, Food & Drink, Experiences, Transport, Other

PROPERTIES:
- Add properties in the Properties section
- Each property has a nickname, address and postcode
- Host plan allows up to 3 properties, Pro allows up to 10
- Guests select their property at checkout

ORDERS:
- View all orders in the Orders section
- Each order shows guest name, stay dates, property, items ordered, notes and total
- Mark orders as fulfilled once completed
- Email notification sent to host for every new order

STRIPE:
- Connect Stripe in the Stripe Connect section
- Guests pay through the host's own Stripe account — money goes directly to the host
- Hostie Hub never touches guest payments
- Host needs their own Stripe account (free to create at stripe.com)

STORE URL:
- Default URL is yourname.hostiehub.com.au
- Can be changed in Account & Billing → Store URL section
- Minimum 3 characters, lowercase letters, numbers and hyphens only
- Warning: old URL stops working immediately when changed

LOCAL VOUCHERS:
- Partner businesses can sign up and add vouchers for guests in their area
- Hosts add vouchers to their store via the Local Vouchers section
- Postcodes must match between host and partner for vouchers to appear
- Free vouchers show a FREE badge
- Paid vouchers go through the cart and checkout

TRIAL & BILLING:
- 30 day free trial starts automatically on signup
- No credit card required for trial
- Dashboard shows trial countdown banner
- After trial ends, store pauses — guests see "temporarily unavailable"
- Host can reactivate by choosing a plan in Account & Billing
- Plans page at hostiehub.com.au/plans.html

CONTACT & SUPPORT:
- Email: hello@hostiehub.com.au
- Contact form: hostiehub.com.au/contact.html
- Built by Luke and Stacey in Newcastle, NSW, Australia

COMMON ISSUES:
- Store not loading: Check that Stripe is connected and trial hasn't expired
- Products not showing: Make sure products are set to Active
- Can't add more properties: Check plan limits (Host = 3, Pro = 10)
- Forgot password: Use the forgot password link on the login page
- Want to change store URL: Go to Account & Billing → Store URL

If you don't know the answer to something, say so honestly and suggest the host emails hello@hostiehub.com.au for further help. Keep responses concise — 2-4 sentences max unless the question requires more detail. Never make up features that don't exist.`;

  // ── STYLES ──
  const styles = `
    #hh-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #2C6E6A, #1d4d4a);
      border-radius: 50%;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(44,110,106,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      z-index: 9999;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #hh-widget-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(44,110,106,0.5);
    }
    #hh-widget-btn .hh-close-icon { display: none; font-size: 20px; }
    #hh-widget-btn.open .hh-open-icon { display: none; }
    #hh-widget-btn.open .hh-close-icon { display: block; }

    #hh-widget-window {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 360px;
      height: 500px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.97);
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      font-family: 'DM Sans', -apple-system, sans-serif;
    }
    #hh-widget-window.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0) scale(1);
    }

    .hh-header {
      background: linear-gradient(135deg, #2C6E6A, #1d4d4a);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .hh-avatar {
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .hh-header-info { flex: 1; }
    .hh-header-name { font-size: 14px; font-weight: 700; color: white; }
    .hh-header-sub { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 1px; }
    .hh-online-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; margin-right: 4px; }

    .hh-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #faf9f7;
    }
    .hh-messages::-webkit-scrollbar { width: 4px; }
    .hh-messages::-webkit-scrollbar-track { background: transparent; }
    .hh-messages::-webkit-scrollbar-thumb { background: #e8e4df; border-radius: 4px; }

    .hh-msg {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .hh-msg.user { flex-direction: row-reverse; }
    .hh-msg-avatar {
      width: 28px;
      height: 28px;
      background: #e6f2f1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .hh-msg.user .hh-msg-avatar { background: #2C6E6A; }
    .hh-bubble {
      max-width: 240px;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1.5px solid #e8e4df;
    }
    .hh-msg.user .hh-bubble {
      background: #2C6E6A;
      color: white;
      border-color: transparent;
    }
    .hh-typing {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
      background: white;
      border-radius: 16px;
      border: 1.5px solid #e8e4df;
      width: fit-content;
    }
    .hh-dot {
      width: 6px;
      height: 6px;
      background: #6b7280;
      border-radius: 50%;
      animation: hhBounce 1.2s infinite;
    }
    .hh-dot:nth-child(2) { animation-delay: 0.2s; }
    .hh-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes hhBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .hh-suggestions {
      padding: 0 16px 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      background: #faf9f7;
    }
    .hh-suggestion {
      background: white;
      border: 1.5px solid #e8e4df;
      border-radius: 50px;
      padding: 5px 12px;
      font-size: 12px;
      color: #2C6E6A;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      font-weight: 500;
    }
    .hh-suggestion:hover { background: #e6f2f1; border-color: #2C6E6A; }

    .hh-input-area {
      padding: 12px 16px;
      border-top: 1.5px solid #e8e4df;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      background: white;
    }
    .hh-input {
      flex: 1;
      border: 1.5px solid #e8e4df;
      border-radius: 12px;
      padding: 10px 14px;
      font-family: inherit;
      font-size: 13px;
      color: #1a1a1a;
      outline: none;
      resize: none;
      max-height: 80px;
      line-height: 1.4;
      background: #faf9f7;
      transition: border-color 0.2s;
    }
    .hh-input:focus { border-color: #2C6E6A; background: white; }
    .hh-send {
      width: 36px;
      height: 36px;
      background: #2C6E6A;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .hh-send:hover { background: #1d4d4a; }
    .hh-send svg { width: 16px; height: 16px; fill: white; }
    .hh-send:disabled { background: #e8e4df; cursor: not-allowed; }

    @media (max-width: 420px) {
      #hh-widget-window { width: calc(100vw - 32px); right: 16px; bottom: 80px; }
      #hh-widget-btn { right: 16px; bottom: 16px; }
    }
  `;

  // ── INIT ──
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // Button
  const btn = document.createElement('button');
  btn.id = 'hh-widget-btn';
  btn.innerHTML = `<span class="hh-open-icon">💬</span><span class="hh-close-icon">✕</span>`;
  btn.onclick = toggleWidget;
  document.body.appendChild(btn);

  // Window
  const win = document.createElement('div');
  win.id = 'hh-widget-window';
  win.innerHTML = `
    <div class="hh-header">
      <div class="hh-avatar">🤖</div>
      <div class="hh-header-info">
        <div class="hh-header-name">Hubs — Hostie Hub Support</div>
        <div class="hh-header-sub"><span class="hh-online-dot"></span>Online now · Powered by AI</div>
      </div>
    </div>
    <div class="hh-messages" id="hh-messages"></div>
    <div class="hh-suggestions" id="hh-suggestions">
      <button class="hh-suggestion" onclick="hhSuggest('How do I add products?')">Add products</button>
      <button class="hh-suggestion" onclick="hhSuggest('How do I connect Stripe?')">Connect Stripe</button>
      <button class="hh-suggestion" onclick="hhSuggest('How does the free trial work?')">Free trial</button>
      <button class="hh-suggestion" onclick="hhSuggest('How do I share my store?')">Share store</button>
    </div>
    <div class="hh-input-area">
      <textarea class="hh-input" id="hh-input" placeholder="Ask anything about Hostie Hub..." rows="1" onkeydown="hhKeyDown(event)" oninput="hhAutoResize(this)"></textarea>
      <button class="hh-send" id="hh-send" onclick="hhSend()">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(win);

  // Conversation history
  let messages = [];
  let isOpen = false;
  let isLoading = false;

  // Add welcome message
  setTimeout(() => {
    addMessage('bot', "G'day! I'm Hubs, your Hostie Hub support assistant 👋\n\nI can help you set up your store, add products, connect Stripe, or answer any questions about the platform. What can I help you with?");
  }, 300);

  function toggleWidget() {
    isOpen = !isOpen;
    btn.classList.toggle('open', isOpen);
    win.classList.toggle('open', isOpen);
    if (isOpen) {
      setTimeout(() => document.getElementById('hh-input').focus(), 300);
    }
  }

  function addMessage(role, text) {
    const messagesEl = document.getElementById('hh-messages');
    const msgEl = document.createElement('div');
    msgEl.className = `hh-msg ${role === 'user' ? 'user' : ''}`;
    const avatar = role === 'user' ? '👤' : '🤖';
    msgEl.innerHTML = `
      <div class="hh-msg-avatar">${avatar}</div>
      <div class="hh-bubble">${text.replace(/\n/g, '<br>')}</div>
    `;
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const messagesEl = document.getElementById('hh-messages');
    const typingEl = document.createElement('div');
    typingEl.className = 'hh-msg';
    typingEl.id = 'hh-typing';
    typingEl.innerHTML = `
      <div class="hh-msg-avatar">🤖</div>
      <div class="hh-typing">
        <div class="hh-dot"></div>
        <div class="hh-dot"></div>
        <div class="hh-dot"></div>
      </div>
    `;
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('hh-typing');
    if (el) el.remove();
  }

  async function hhSend() {
    const input = document.getElementById('hh-input');
    const text = input.value.trim();
    if (!text || isLoading) return;

    // Hide suggestions after first message
    document.getElementById('hh-suggestions').style.display = 'none';

    input.value = '';
    input.style.height = 'auto';
    addMessage('user', text);
    messages.push({ role: 'user', content: text });

    isLoading = true;
    document.getElementById('hh-send').disabled = true;
    showTyping();

    try {
      const response = await fetch('https://hostie-hub-ai.still-feather-9559.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: messages
        })
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't get a response. Please try again or email hello@hostiehub.com.au";

      hideTyping();
      addMessage('bot', reply);
      messages.push({ role: 'assistant', content: reply });

    } catch (err) {
      hideTyping();
      addMessage('bot', "Sorry, something went wrong. Please email us at hello@hostiehub.com.au and we'll help you out!");
    }

    isLoading = false;
    document.getElementById('hh-send').disabled = false;
  }

  function hhSuggest(text) {
    document.getElementById('hh-input').value = text;
    hhSend();
  }

  function hhKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      hhSend();
    }
  }

  function hhAutoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }

  // Make functions global
  window.hhSuggest = hhSuggest;
  window.hhKeyDown = hhKeyDown;
  window.hhAutoResize = hhAutoResize;

})();
