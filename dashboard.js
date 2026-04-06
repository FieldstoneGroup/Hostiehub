
  const { createClient } = supabase;
  const sb = createClient(
    'https://hjwkycknjiyvrxbcejet.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqd2t5Y2tuaml5dnJ4YmNlamV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njc3MjUsImV4cCI6MjA5MDQ0MzcyNX0.qmdp--Zw24bBlHqsXrQfFiIEv_ux0k9-1NE4RH_Ldb8'
  );

  let currentImageUrl = null;
  function previewImage(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('imagePreview').src = e.target.result;
      document.getElementById('imagePreviewWrap').style.display = 'block';
      document.getElementById('imageUploadLabel').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreviewWrap').style.display = 'none';
    document.getElementById('imageUploadLabel').style.display = 'flex';
    currentImageUrl = null;
  }

  async function uploadProductImage(file, productId) {
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${currentUser.id}/${productId}.${ext}`;
    const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) { console.error(error); return null; }
    const { data } = sb.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  }
  let selectedEmoji = '✨';

  const emojis = ['🌸','🧺','🍾','🕐','🏄','🚗','🎁','🌿','☕','🍫','🧁','🎂','🌊','🏠','🧴','🛁','🎵','🐾','🎉','🍕','🥗','🍷','🎈','🍫','🛎️','🧹'];
  const swatchColours = ['#2C6E6A','#1d4d4a','#E8A838','#e74c3c','#8e44ad','#2980b9','#27ae60','#e67e22','#1a1a1a'];
  const pageTitles = { overview:'Overview', orders:'Orders', 'order-detail':'Order Detail', store:'Store Settings', properties:'Properties', products:'Products', vouchers:'Local Vouchers', stripe:'Stripe Connect', account:'Account & Billing' };

  const PRESET_PRODUCTS = [
    // STAY SERVICES
    { name: 'Early Check-in', description: 'Arrive early and skip the wait. Subject to availability — we\'ll confirm within 24 hours of your request.', price: 40, unit: 'per stay', category: 'arrival', emoji: '🕐', notes_prompt: 'What time would you like to check in? Please also provide your reservation name.' },
    { name: 'Late Check-out', description: 'Stay a little longer and enjoy a relaxed morning. Subject to availability — we\'ll confirm within 24 hours.', price: 35, unit: 'per stay', category: 'arrival', emoji: '🛎️', notes_prompt: 'What time would you like to check out? Please also provide your reservation name.' },
    { name: 'Mid-Stay Clean', description: 'A full clean of the property during your stay — fresh linen, towels and all surfaces cleaned.', price: 80, unit: 'per clean', category: 'other', emoji: '🧹', notes_prompt: 'What date would you like the clean? (Please provide a date during your stay) What time works best?' },
    { name: 'Extra Towels & Linen Pack', description: 'Fresh towels and linen delivered to the property — perfect for longer stays or extra guests.', price: 20, unit: 'per pack', category: 'other', emoji: '🛏️', notes_prompt: 'How many sets do you need? Any specific requirements?' },
    { name: 'Daily Servicing', description: 'Hotel-style daily cleaning including linen change, towel refresh and full property clean.', price: 60, unit: 'per day', category: 'other', emoji: '✨', notes_prompt: 'What time would you prefer the daily service? (e.g. 10am–12pm)' },
    { name: 'Linen Upgrade', description: 'Upgrade to luxury 1000-thread-count sheets for the ultimate sleep experience.', price: 30, unit: 'per stay', category: 'other', emoji: '🌙', notes_prompt: 'What bed sizes need the upgrade? (e.g. queen, king, singles)' },
    { name: 'Pillow Selection Menu', description: 'Choose from our range of pillows — firm, soft, memory foam or hypoallergenic. Sleep exactly how you like.', price: 15, unit: 'per pillow', category: 'other', emoji: '😴', notes_prompt: 'Which type of pillow would you prefer? (firm / soft / memory foam / hypoallergenic) How many?' },
    { name: 'Extra Bed Setup', description: 'We\'ll set up an extra bed or rollaway before your arrival — perfect for unexpected guests.', price: 40, unit: 'per bed', category: 'other', emoji: '🛏️', notes_prompt: 'What size extra bed do you need? (single / double) How many?' },
    { name: 'Late-Night Check-in Service', description: 'Arriving late? We\'ll arrange a seamless after-hours check-in so you can get settled without any hassle.', price: 30, unit: 'per stay', category: 'arrival', emoji: '🌙', notes_prompt: 'What time do you expect to arrive? Please provide your flight or travel details if applicable.' },
    { name: 'Luggage Storage', description: 'Store your bags at the property before check-in or after check-out while you explore.', price: 15, unit: 'per day', category: 'other', emoji: '🧳', notes_prompt: 'How many bags? What date and time do you need storage?' },
    { name: 'Laundry Service', description: 'Drop your laundry and we\'ll wash, dry and fold it for you — returned within 24 hours.', price: 35, unit: 'per load', category: 'other', emoji: '👕', notes_prompt: 'How many loads? Any special requirements (delicates, cold wash etc)?' },
    { name: 'Workspace Setup', description: 'We\'ll set up a dedicated workspace with a desk, monitor and ergonomic chair — perfect for remote workers.', price: 25, unit: 'per stay', category: 'other', emoji: '💻', notes_prompt: 'Do you need a monitor? Any specific setup requirements?' },
    { name: 'Fridge Restock Mid-Stay', description: 'We\'ll restock your fridge with fresh essentials during your stay — milk, juice, basics and snacks.', price: 40, unit: 'per restock', category: 'food', emoji: '🥛', notes_prompt: 'What date would you like the restock? Any dietary requirements or specific items?' },

    // GROCERY & FOOD PREP
    { name: 'Grocery Pre-Stocking (Basic Essentials)', description: 'We\'ll stock the fridge and pantry with everyday essentials before you arrive — milk, bread, eggs, butter, coffee and more.', price: 45, unit: 'per stay', category: 'food', emoji: '🛒', notes_prompt: 'Any dietary requirements, allergies or specific items you\'d like included?' },
    { name: 'Premium Grocery Pack', description: 'Organic and health-focused groceries stocked before your arrival — fresh fruit, vegetables, organic dairy, specialty items and more.', price: 85, unit: 'per stay', category: 'food', emoji: '🥦', notes_prompt: 'Any dietary requirements, allergies or specific organic/health items you\'d like?' },
    { name: 'Coffee Pod Refill Pack', description: 'A selection of premium coffee pods to keep you fuelled throughout your stay.', price: 18, unit: 'per pack', category: 'food', emoji: '☕', notes_prompt: 'What machine do you have? (Nespresso/Dolce Gusto/Other) Any roast preference? (mild/medium/strong)' },
    { name: 'Toiletry Restock', description: 'Fresh shampoo, conditioner, body wash, soap and hand lotion replenished mid-stay.', price: 25, unit: 'per restock', category: 'other', emoji: '🧴', notes_prompt: 'Any specific products or brands you prefer? Any allergies or sensitivities?' },

    // FOOD & DRINK
    { name: 'Breakfast Hamper', description: 'A beautiful hamper of local produce — fresh pastries, artisan coffee, local honey, seasonal fruit and more waiting on arrival.', price: 65, unit: 'per hamper', category: 'food', emoji: '🧺', notes_prompt: 'How many guests? Any dietary requirements or allergies?' },
    { name: 'BBQ Pack', description: 'Everything you need for a great BBQ — premium meat selection, fresh salads, condiments and sides. Fire up the grill!', price: 75, unit: 'per pack', category: 'food', emoji: '🍖', notes_prompt: 'How many guests? Any dietary requirements? (vegetarian options available)' },
    { name: 'Wine & Cheese Platter', description: 'A curated selection of local wines paired with artisan cheeses, crackers, grapes and accompaniments.', price: 70, unit: 'per platter', category: 'food', emoji: '🧀', notes_prompt: 'Red, white or mixed wines? Any dietary requirements or cheese preferences?' },
    { name: 'Local Craft Beer Bundle', description: 'A selection of the best local craft beers — a great way to explore the region\'s brewing scene.', price: 45, unit: 'per bundle', category: 'food', emoji: '🍺', notes_prompt: 'Any style preferences? (pale ale / IPA / lager / stout) How many people?' },
    { name: 'Date Night Dinner Pack', description: 'Everything for a romantic dinner in — premium ingredients, a recipe card, candles and a bottle of wine included.', price: 95, unit: 'per pack', category: 'food', emoji: '🍽️', notes_prompt: 'Any dietary requirements or allergies? Wine preference? (red/white/sparkling)' },
    { name: 'Kids Snack Pack', description: 'A fun selection of kid-friendly snacks to keep the little ones happy — fruit pouches, crackers, treats and juice boxes.', price: 25, unit: 'per pack', category: 'food', emoji: '🍎', notes_prompt: 'Ages of children? Any allergies or dietary requirements?' },
    { name: 'Celebration Cake', description: 'A beautifully decorated celebration cake waiting for your arrival — perfect for birthdays, anniversaries or any special occasion.', price: 65, unit: 'per cake', category: 'food', emoji: '🎂', notes_prompt: 'What\'s the occasion? Any flavour preference? (chocolate/vanilla/red velvet) Name or message for the cake?' },
    { name: 'Fresh Juice & Smoothie Pack', description: 'Cold-pressed juices and smoothies made from local fresh fruit — a healthy and delicious welcome.', price: 35, unit: 'per pack', category: 'food', emoji: '🥤', notes_prompt: 'Any fruit preferences or ingredients to avoid? How many people?' },
    { name: 'Picnic Hamper', description: 'A fully packed picnic hamper for a perfect day out — cheese, crackers, fruit, drinks, a rug and everything you need.', price: 75, unit: 'per hamper', category: 'food', emoji: '🧺', notes_prompt: 'How many guests? Any dietary requirements or allergies?' },
    { name: 'Charcuterie Board Setup', description: 'A stunning charcuterie board set up and ready on arrival — cured meats, cheeses, nuts, fruit and crackers beautifully arranged.', price: 55, unit: 'per board', category: 'food', emoji: '🥩', notes_prompt: 'How many guests? Any dietary requirements or allergies?' },
    { name: 'Firewood Bundle', description: 'A generous bundle of split hardwood delivered and stacked before your arrival. Perfect for a cosy night by the fire.', price: 35, unit: 'per bundle', category: 'other', emoji: '🪵', notes_prompt: 'Would you like more than one bundle? Any delivery notes?' },

    // SPECIAL OCCASIONS & SETUPS
    { name: 'Romantic Setup', description: 'Candles, fresh flowers, rose petals and elegant décor set up before your arrival — perfect for a special occasion or romantic getaway.', price: 85, unit: 'per setup', category: 'arrival', emoji: '🌹', notes_prompt: 'Any special requests or colour preferences? Is this a surprise?' },
    { name: 'Birthday Setup', description: 'Balloons, banners, a cake and festive decorations all set up and ready — make their birthday truly special.', price: 75, unit: 'per setup', category: 'arrival', emoji: '🎉', notes_prompt: 'Name of the birthday person? Age? Colour preferences? Any theme?' },
    { name: 'Proposal Setup', description: 'A magical, romantic setup for the perfect proposal — flowers, candles, champagne and personalised touches to make it unforgettable.', price: 150, unit: 'per setup', category: 'arrival', emoji: '💍', notes_prompt: 'Tell us a bit about the moment you\'re planning — indoor or outdoor? Any specific flowers, colours or personal touches you\'d like?' },
    { name: 'Movie Night Package', description: 'Popcorn, snacks, blankets and streaming setup all sorted — just pick your movie and enjoy.', price: 45, unit: 'per package', category: 'experiences', emoji: '🎬', notes_prompt: 'Any snack preferences or dietary requirements? How many guests?' },
    { name: 'Beach Day Setup', description: 'Beach umbrella, chairs, cooler, towels and everything you need for a perfect day at the beach — all set up and waiting.', price: 55, unit: 'per setup', category: 'experiences', emoji: '🏖️', notes_prompt: 'How many people? What time would you like to head to the beach?' },
    { name: 'Firepit Night Setup', description: 'Firewood, kindling, marshmallows, skewers and seating all set up around the firepit — perfect for a magical evening outdoors.', price: 50, unit: 'per setup', category: 'experiences', emoji: '🔥', notes_prompt: 'How many guests? Would you like any extras like hot chocolate packs or snacks?' },
    { name: 'Kids Activity Pack', description: 'Games, craft supplies, colouring books, puzzles and activities to keep kids entertained throughout the stay.', price: 35, unit: 'per pack', category: 'experiences', emoji: '🎨', notes_prompt: 'Ages of children? Any activity preferences or things they love?' },
    { name: 'Welcome Pack Upgrade', description: 'An upgraded welcome experience — premium snacks, local treats, wine, a personalised note and thoughtful extras waiting on arrival.', price: 55, unit: 'per stay', category: 'arrival', emoji: '🎁', notes_prompt: 'Any dietary requirements or allergies? Any personal touches you\'d like included?' },
    { name: 'Baby Essentials Kit', description: 'Everything you need for a baby — travel cot, highchair, baby bath and basic supplies all set up before your arrival.', price: 45, unit: 'per stay', category: 'other', emoji: '👶', notes_prompt: 'Age of baby? What items do you need? (cot / highchair / baby bath / other)' },

    // EXPERIENCES & ACTIVITIES
    { name: 'In-Room Massage', description: 'A relaxing massage in the comfort of the property. A fully qualified therapist comes to you.', price: 120, unit: 'per person', category: 'experiences', emoji: '🧖', notes_prompt: 'Preferred date and time? Any injuries or areas to focus on or avoid? How many people?' },
    { name: 'Private Chef Experience', description: 'A professional chef comes to the property and prepares a full dinner experience for your group — a truly special evening.', price: 180, unit: 'per group', category: 'experiences', emoji: '👨‍🍳', notes_prompt: 'How many guests? Any dietary requirements or allergies? Any cuisine preferences?' },
    { name: 'Photography Session', description: 'A professional photographer for a holiday shoot — capture memories of your trip in the local area.', price: 150, unit: 'per session', category: 'experiences', emoji: '📸', notes_prompt: 'Preferred date and time? How many people? Any specific locations or styles you\'d like?' },
    { name: 'Surfboard Hire', description: 'Quality surfboard and leg rope delivered to the property — ready to hit the waves.', price: 45, unit: 'per day', category: 'experiences', emoji: '🏄', notes_prompt: 'What size board? (beginner/intermediate/advanced) How many days? How many boards?' },
    { name: 'Kayak / Paddleboard Hire', description: 'Explore the waterways by kayak or paddleboard. Paddles and life jackets included.', price: 55, unit: 'per day', category: 'experiences', emoji: '🚣', notes_prompt: 'Kayak or paddleboard? Single or double? How many? How many days?' },
    { name: 'Bike Hire / E-Bike Hire', description: 'Explore the area on two wheels — standard or electric bikes available. Helmets included.', price: 40, unit: 'per day', category: 'experiences', emoji: '🚲', notes_prompt: 'Standard or e-bike? How many bikes? How many days? Any size requirements?' },
    { name: 'Fishing Charter Booking', description: 'We\'ll book a local fishing charter for your group — all gear provided, just show up and catch dinner.', price: 95, unit: 'per person', category: 'experiences', emoji: '🎣', notes_prompt: 'Preferred date and time? How many people? Any experience level notes?' },
    { name: 'Wine Tour', description: 'A guided half-day wine tour visiting local wineries with a knowledgeable guide. Tastings included.', price: 120, unit: 'per person', category: 'experiences', emoji: '🍾', notes_prompt: 'Preferred date? How many guests? Any wine preferences? (red/white/sparkling)' },
    { name: 'Tour Booking', description: 'We\'ll book a local tour or experience for you — whale watching, scenic flights, cooking classes and more.', price: 20, unit: 'booking fee', category: 'experiences', emoji: '🗺️', notes_prompt: 'What type of tour or experience are you interested in? Preferred date and number of guests?' },
    { name: 'Restaurant Reservation', description: 'We\'ll secure a reservation at the best local restaurants — including hard-to-book spots.', price: 15, unit: 'booking fee', category: 'experiences', emoji: '🍽️', notes_prompt: 'Which restaurant or cuisine type? Preferred date and time? How many guests? Any dietary requirements?' },
    { name: 'Babysitting Services', description: 'A qualified and vetted babysitter so you can enjoy a night out without worry.', price: 30, unit: 'per hour', category: 'experiences', emoji: '👧', notes_prompt: 'Preferred date and hours? How many children? Ages? Any special requirements or routines?' },
    { name: 'Pet Sitting / Dog Walking', description: 'A trusted local pet sitter or dog walker to take care of your furry friend while you explore.', price: 25, unit: 'per hour', category: 'experiences', emoji: '🐾', notes_prompt: 'Type of pet? Size/breed? Preferred dates and hours? Any special requirements?' },

    // TRANSPORT
    { name: 'Airport Transfer', description: 'Door-to-door airport transfer in a comfortable vehicle — no rideshare hassle, just a smooth arrival or departure.', price: 65, unit: 'per trip', category: 'transport', emoji: '✈️', notes_prompt: 'Pickup or dropoff? Date and time? Flight number? How many passengers and bags?' },
    { name: 'Car Hire', description: 'We\'ll arrange a hire car for your stay — pick up locally or delivered to the property.', price: 20, unit: 'booking fee', category: 'transport', emoji: '🚗', notes_prompt: 'What type of car? (small/SUV/7-seater) How many days? Preferred pickup date and location?' },

    // GUIDES & DIGITAL
    { name: 'Digital Local Guidebook', description: 'A curated digital guide to the best local restaurants, experiences, hidden gems and tips — personalised for your stay.', price: 15, unit: 'per stay', category: 'other', emoji: '📱', notes_prompt: 'What are you most interested in? (food / nature / nightlife / family-friendly / all of the above)' },
    { name: 'Premium Itinerary Pack', description: 'A fully planned day-by-day itinerary for your stay, tailored to your group and interests — take the guesswork out of your trip.', price: 25, unit: 'per stay', category: 'other', emoji: '📋', notes_prompt: 'How many days? What types of activities? (adventure / relaxed / family / romantic) Any specific interests?' },
    { name: '"Hidden Gems" Local Guide', description: 'The spots the locals love but tourists miss — secret beaches, hole-in-the-wall eateries and off-the-beaten-track experiences.', price: 10, unit: 'per stay', category: 'other', emoji: '💎', notes_prompt: 'What are you most interested in? (food / beaches / nature / nightlife)' },
    { name: 'Family Activity Guide', description: 'A curated guide of the best family-friendly activities, parks, beaches and experiences in the area.', price: 10, unit: 'per stay', category: 'other', emoji: '👨‍👩‍👧', notes_prompt: 'Ages of children? Any specific interests or activity types?' },
    { name: 'Kids Holiday Challenge Pack', description: 'A fun printable activity pack to keep kids engaged — holiday challenges, scavenger hunts, nature activities and more.', price: 8, unit: 'per pack', category: 'other', emoji: '🎯', notes_prompt: 'Ages of children? Any specific themes or interests?' },
    { name: 'Wellness & Retreat Guide', description: 'Morning routines, local wellness spots, yoga guides, meditation trails and health-focused experiences for a restorative stay.', price: 12, unit: 'per stay', category: 'other', emoji: '🧘', notes_prompt: 'What wellness activities interest you most? (yoga / meditation / hiking / spa / all)' },
    { name: 'Meal Planning Guide', description: 'A full meal plan for your stay with local shopping lists, easy recipes and the best local produce suppliers.', price: 12, unit: 'per stay', category: 'other', emoji: '🥗', notes_prompt: 'How many guests? Any dietary requirements? (vegetarian / vegan / gluten-free / other)' },
    { name: 'Local Events Calendar', description: 'A personalised calendar of local events, markets, festivals and activities happening during your stay.', price: 8, unit: 'per stay', category: 'other', emoji: '📅', notes_prompt: 'What types of events interest you? (markets / music / sport / food / family)' },
  ];

  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = 'signup.html'; return; }
    currentUser = session.user;
    const { data: host } = await sb.from('hosts').select('*').eq('id', currentUser.id).single();
    if (host) { currentHost = host; populateUI(); }
    await Promise.all([loadProducts(), loadProperties(), loadOrders()]);
    loadVouchers();
    buildEmojiGrid();
    buildSwatches();

    // Handle Stripe Connect return
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'success') {
      await sb.from('hosts').update({ stripe_connected: true }).eq('id', currentUser.id);
      currentHost.stripe_connected = true;
      document.getElementById('stripeNotConnected').style.display = 'none';
      document.getElementById('stripeConnected').style.display = 'block';
      document.getElementById('stripeBadge').style.display = 'none';
      document.getElementById('stripeConnectedBadge').style.display = 'flex';
      tickCheck('checkStripe');
      showToast('✅ Stripe connected successfully!');
      window.history.replaceState({}, '', 'dashboard.html');
    } else if (params.get('stripe') === 'refresh') {
      showToast('⚠️ Stripe setup incomplete. Please try again.');
      window.history.replaceState({}, '', 'dashboard.html');
    }
  }

  function populateUI() {
    const initials = (currentHost.full_name || '?').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.getElementById('sidebarAvatar').textContent = initials;
    document.getElementById('sidebarName').textContent = currentHost.full_name || '';
    document.getElementById('sidebarUrl').textContent = 'hostiehub.com.au/store/' + (currentHost.username || '');
    document.getElementById('storeUrlDisplay').textContent = 'hostiehub.com.au/store/' + (currentHost.username || '');
    document.getElementById('viewStoreBtn').href = 'https://hostiehub.com.au/store/' + (currentHost.username || '');
    document.getElementById('accountName').value = currentHost.full_name || '';
    document.getElementById('accountEmail').value = currentHost.email || '';
    const unField = document.getElementById('newUsername');
    if (unField) {
      unField.value = currentHost.username || '';
      unField.addEventListener('input', () => {
        const val = unField.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        unField.value = val;
        const preview = document.getElementById('usernameChangePreview');
        if (val.length >= 3) {
          preview.style.display = 'block';
          preview.textContent = 'New URL: hostiehub.com.au/store/' + val;
        } else {
          preview.style.display = 'none';
        }
      });
    }
    if (currentHost.store_name) document.getElementById('storeName').value = currentHost.store_name;
    if (currentHost.store_tagline) document.getElementById('storeTagline').value = currentHost.store_tagline;
    if (currentHost.store_welcome) document.getElementById('storeWelcome').value = currentHost.store_welcome;
    if (currentHost.postcode) document.getElementById('storePostcode').value = currentHost.postcode;
    if (currentHost.brand_colour) { document.getElementById('brandColour').value = currentHost.brand_colour; updateColourPreview(currentHost.brand_colour); }
    if (currentHost.stripe_connected) {
      document.getElementById('stripeNotConnected').style.display = 'none';
      document.getElementById('stripeConnected').style.display = 'block';
      document.getElementById('stripeConnectedBadge').style.display = 'flex';
      tickCheck('checkStripe');
    } else {
      document.getElementById('stripeBadge').style.display = 'flex';
    }
    // Auto-tick store branding if already set
    if (currentHost.store_name || currentHost.store_tagline || currentHost.brand_colour) {
      tickCheck('checkStore');
    }
    // Show plan details
    const plan = currentHost.plan || 'host';
    const planNames = { host: 'Host Plan · $99/yr', pro: 'Pro Plan · $199/yr', enterprise: 'Enterprise Plan · Custom' };
    const planProps = { host: 'Up to 3 properties', pro: 'Up to 10 properties', enterprise: 'Unlimited properties' };
    if (document.getElementById('planName')) document.getElementById('planName').textContent = planNames[plan] || planNames.host;
    if (document.getElementById('planProperties')) document.getElementById('planProperties').textContent = planProps[plan] || planProps.host;

    // ── TRIAL CHECK ──
    checkTrial();
  }

  function checkTrial() {
    const trialEndsAt = currentHost.trial_ends_at ? new Date(currentHost.trial_ends_at) : null;
    const isPaid = currentHost.plan && ['host', 'pro', 'enterprise'].includes(currentHost.plan);
    const isActive = currentHost.is_active !== false;

    const now = new Date();
    const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)) : 0;
    const trialExpired = trialEndsAt && now > trialEndsAt;

    // Update billing card
    if (isPaid) {
      document.getElementById('paidStatusCard').style.display = 'block';
      document.getElementById('trialStatusCard').style.display = 'none';
      const planNames = { host: 'Host Plan · $99/yr', pro: 'Pro Plan · $199/yr', enterprise: 'Enterprise Plan · Custom' };
      const planProps = { host: 'Up to 3 properties', pro: 'Up to 10 properties', enterprise: 'Unlimited properties' };
      document.getElementById('planName').textContent = planNames[currentHost.plan] || planNames.host;
      document.getElementById('planProperties').textContent = planProps[currentHost.plan] || planProps.host;
      // Hide trial banner and overlay for paid users
      document.getElementById('trialBanner').style.display = 'none';
      document.getElementById('trialExpiredOverlay').style.display = 'none';
      return;
    }

    // On trial
    document.getElementById('trialStatusCard').style.display = 'block';
    document.getElementById('paidStatusCard').style.display = 'none';
    if (document.getElementById('trialExpiredCard')) document.getElementById('trialExpiredCard').style.display = 'none';
    if (daysLeft > 0) {
      document.getElementById('trialDaysLeft').textContent = daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' remaining';
    } else {
      document.getElementById('trialDaysLeft').textContent = 'Trial ended';
    }

    if (!trialExpired && daysLeft > 0) {
      // Trial still active — show banner
      const banner = document.getElementById('trialBanner');
      banner.style.display = 'flex';
      const text = daysLeft === 1
        ? '⚠️ Your free trial ends tomorrow — activate your plan to keep your store live'
        : daysLeft <= 7
        ? `⚠️ Your free trial ends in ${daysLeft} days — activate your plan to keep your store live`
        : `Your free trial is active — ${daysLeft} days remaining`;
      document.getElementById('trialBannerText').textContent = text;
      if (daysLeft <= 3) document.getElementById('trialBanner').style.background = 'linear-gradient(135deg,#e53e3e,#c53030)';
    } else if (trialExpired) {
      // Trial expired — show overlay + inline card
      document.getElementById('trialExpiredOverlay').style.display = 'flex';
      document.getElementById('trialStatusCard').style.display = 'none';
      if (document.getElementById('trialExpiredCard')) document.getElementById('trialExpiredCard').style.display = 'block';
      sb.from('hosts').update({ is_active: false }).eq('id', currentUser.id);
    }
  }

  function showPage(name, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (!page) return;
    page.classList.add('active');
    if (btn) btn.classList.add('active');
    document.getElementById('topbarTitle').textContent = pageTitles[name] || name;
  }

  // ── PROPERTIES ──
  async function loadProperties() {
    if (!currentUser) return;
    const { data } = await sb.from('properties').select('*').eq('host_id', currentUser.id).order('created_at');
    properties = data || [];
    renderProperties();
    document.getElementById('statProperties').textContent = properties.length;
    if (properties.length > 0) tickCheck('checkProperties');
  }

  function renderProperties() {
    const list = document.getElementById('propertiesList');
    if (!properties.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏠</div><h3>No properties yet</h3><p>Add your properties so guests can select which one they're staying at.</p></div>`;
      return;
    }
    list.innerHTML = properties.map(p => `
      <div class="prop-row">
        <span style="font-size:18px;flex-shrink:0">🏠</span>
        <div class="prop-row-name">${p.nickname}</div>
        <div class="prop-row-actions">
          <button class="btn btn-outline btn-sm" onclick="editProperty('${p.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProperty('${p.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function openPropertyModal(id) {
    editingPropertyId = null;
    document.getElementById('propertyModalTitle').textContent = 'Add property';
    document.getElementById('propNickname').value = '';
    document.getElementById('propAddress').value = '';
    document.getElementById('propPostcode').value = '';
    document.getElementById('propertyModal').classList.add('open');
  }

  function editProperty(id) {
    const p = properties.find(x => x.id === id);
    if (!p) return;
    editingPropertyId = id;
    document.getElementById('propertyModalTitle').textContent = 'Edit property';
    document.getElementById('propNickname').value = p.nickname || '';
    document.getElementById('propAddress').value = p.address || '';
    document.getElementById('propPostcode').value = p.postcode || '';
    document.getElementById('propertyModal').classList.add('open');
  }

  function closePropertyModal() { document.getElementById('propertyModal').classList.remove('open'); }

  async function saveProperty() {
    const nickname = document.getElementById('propNickname').value.trim();
    if (!nickname) { showToast('⚠️ Property nickname is required'); return; }

    // Check property limits based on plan
    if (!editingPropertyId) {
      const plan = currentHost.plan || 'host';
      const limit = plan === 'pro' ? 10 : plan === 'enterprise' ? Infinity : 3;
      if (properties.length >= limit) {
        closePropertyModal();
        const planName = plan === 'pro' ? 'Pro' : 'Host';
        document.getElementById('upgradeModalTitle').textContent = `Property limit reached`;
        document.getElementById('upgradeModalText').textContent = `You've reached the ${limit} property limit on your ${planName} plan. Upgrade your subscription to add more properties.`;
        document.getElementById('upgradeModal').classList.add('open');
        return;
      }
    }

    const data = { host_id: currentUser.id, nickname, address: document.getElementById('propAddress').value.trim(), postcode: document.getElementById('propPostcode').value.trim() };
    if (editingPropertyId) {
      await sb.from('properties').update(data).eq('id', editingPropertyId);
      showToast('✅ Property updated');
    } else {
      await sb.from('properties').insert(data);
      showToast('✅ Property added');
    }
    closePropertyModal();
    loadProperties();
  }

  async function deleteProperty(id) {
    if (!confirm('Delete this property?')) return;
    await sb.from('properties').delete().eq('id', id);
    showToast('🗑 Property deleted');
    loadProperties();
  }

  // ── PRODUCTS ──
  async function loadProducts() {
    if (!currentUser) return;
    const { data } = await sb.from('products').select('*').eq('host_id', currentUser.id).order('created_at');
    products = data || [];
    renderProducts();
    document.getElementById('statProducts').textContent = products.length;
    if (products.length > 0) tickCheck('checkProducts');
  }

  function renderProducts() {
    const list = document.getElementById('productsList');
    if (!products.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h3>No products yet</h3><p>Add your first product or click "Add presets" to get started quickly.</p></div>`;
      return;
    }
    list.innerHTML = products.map(p => `
      <div class="product-row">
        <div class="product-emoji" style="${p.image_url ? 'padding:0;overflow:hidden;' : ''}">
          ${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">` : (p.emoji || '✨')}
        </div>
        <div class="product-info">
          <div class="product-name">${p.name} ${p.active === false ? '<span style="font-size:11px;color:var(--muted);font-weight:400">(inactive)</span>' : ''}</div>
          <div class="product-meta">${p.category || ''} · $${p.price}${p.unit ? ' / ' + p.unit : ''}${p.notes_prompt ? ' · 📝 Has guest prompt' : ''}</div>
        </div>
        <label class="toggle" title="${p.active !== false ? 'Active' : 'Inactive'}">
          <input type="checkbox" ${p.active !== false ? 'checked' : ''} onchange="toggleProduct('${p.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <div class="product-actions">
          <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function buildPropertyChecks() {
    const container = document.getElementById('propertyChecks');
    container.innerHTML = properties.map(p => `
      <label class="property-check">
        <input type="checkbox" class="prop-check" value="${p.id}" checked>
        <span class="property-check-label">🏠 ${p.nickname}</span>
      </label>
    `).join('');
  }

  function toggleAllProperties(cb) {
    document.getElementById('propertyChecks').style.display = cb.checked ? 'none' : 'flex';
  }

  function buildEmojiGrid() {
    const el = document.getElementById('emojiGrid');
    if (!el) return;
    el.innerHTML = emojis.map(e => `
      <button class="emoji-opt ${e === selectedEmoji ? 'selected' : ''}" onclick="selectEmoji('${e}', this)">${e}</button>
    `).join('');
  }

  function selectEmoji(emoji, btn) {
    selectedEmoji = emoji;
    document.querySelectorAll('.emoji-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  function openProductModal() {
    editingProductId = null;
    document.getElementById('productModalTitle').textContent = 'Add product';
    document.getElementById('pName').value = '';
    document.getElementById('pDesc').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pUnit').value = '';
    document.getElementById('pNotesPrompt').value = '';
    document.getElementById('pCategory').value = 'arrival';
    document.getElementById('pAllProperties').checked = true;
    document.getElementById('propertyChecks').style.display = 'none';
    selectedEmoji = '✨';
    currentImageUrl = null;
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreviewWrap').style.display = 'none';
    document.getElementById('imageUploadLabel').style.display = 'flex';
    buildEmojiGrid();
    buildPropertyChecks();
    document.getElementById('productModal').classList.add('open');
  }

  function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    editingProductId = id;
    document.getElementById('productModalTitle').textContent = 'Edit product';
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pPrice').value = p.price || '';
    document.getElementById('pUnit').value = p.unit || '';
    document.getElementById('pNotesPrompt').value = p.notes_prompt || '';
    document.getElementById('pCategory').value = p.category || 'arrival';
    selectedEmoji = p.emoji || '✨';
    currentImageUrl = p.image_url || null;
    if (p.image_url) {
      document.getElementById('imagePreview').src = p.image_url;
      document.getElementById('imagePreviewWrap').style.display = 'block';
      document.getElementById('imageUploadLabel').style.display = 'none';
    } else {
      document.getElementById('imagePreview').src = '';
      document.getElementById('imagePreviewWrap').style.display = 'none';
      document.getElementById('imageUploadLabel').style.display = 'flex';
    }
    const allProps = p.available_all_properties !== false;
    document.getElementById('pAllProperties').checked = allProps;
    document.getElementById('propertyChecks').style.display = allProps ? 'none' : 'flex';
    buildEmojiGrid();
    buildPropertyChecks();
    if (!allProps && p.property_ids) {
      const ids = Array.isArray(p.property_ids) ? p.property_ids : JSON.parse(p.property_ids || '[]');
      document.querySelectorAll('.prop-check').forEach(cb => { cb.checked = ids.includes(cb.value); });
    }
    document.getElementById('productModal').classList.add('open');
  }

  function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }

  async function saveProduct() {
    const name = document.getElementById('pName').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    if (!name || !price) { showToast('⚠️ Name and price are required'); return; }
    const allProps = document.getElementById('pAllProperties').checked;
    const selectedProps = allProps ? [] : [...document.querySelectorAll('.prop-check:checked')].map(cb => cb.value);

    // Handle image upload
    const imageFile = document.getElementById('productImage').files[0];
    let imageUrl = currentImageUrl;

    const data = {
      host_id: currentUser.id, name, price,
      description: document.getElementById('pDesc').value.trim(),
      unit: document.getElementById('pUnit').value.trim(),
      notes_prompt: document.getElementById('pNotesPrompt').value.trim(),
      category: document.getElementById('pCategory').value,
      emoji: selectedEmoji,
      available_all_properties: allProps,
      property_ids: selectedProps,
      active: true,
    };

    if (editingProductId) {
      if (imageFile) {
        showToast('⏳ Uploading image...');
        imageUrl = await uploadProductImage(imageFile, editingProductId);
      }
      data.image_url = imageUrl;
      await sb.from('products').update(data).eq('id', editingProductId);
      showToast('✅ Product updated');
    } else {
      const { data: inserted, error } = await sb.from('products').insert(data).select().single();
      if (error) { showToast('⚠️ Error saving product'); return; }
      if (imageFile) {
        showToast('⏳ Uploading image...');
        imageUrl = await uploadProductImage(imageFile, inserted.id);
        if (imageUrl) await sb.from('products').update({ image_url: imageUrl }).eq('id', inserted.id);
      }
      showToast('✅ Product added');
    }

    closeProductModal();
    loadProducts();
  }

  async function toggleProduct(id, active) {
    await sb.from('products').update({ active }).eq('id', id);
    showToast(active ? '✅ Product activated' : '⏸ Product deactivated');
    loadProducts();
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    await sb.from('products').delete().eq('id', id);
    showToast('🗑 Product deleted');
    loadProducts();
  }

  function openPresetModal() {
    const list = document.getElementById('presetList');
    list.innerHTML = PRESET_PRODUCTS.map((p, i) => `
      <label style="display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg);border-radius:10px;border:1.5px solid var(--border);cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--brand)'" onmouseout="this.style.borderColor='var(--border)'">
        <input type="checkbox" class="preset-check" value="${i}" style="width:18px;height:18px;accent-color:var(--brand);flex-shrink:0">
        <div style="font-size:24px;flex-shrink:0">${p.emoji}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;margin-bottom:2px">${p.name}</div>
          <div style="font-size:12px;color:var(--muted)">$${p.price} / ${p.unit} · ${p.category}</div>
        </div>
      </label>
    `).join('');
    document.getElementById('presetModal').classList.add('open');
  }

  function closePresetModal() { document.getElementById('presetModal').classList.remove('open'); }

  async function addSelectedPresets() {
    const selected = [...document.querySelectorAll('.preset-check:checked')].map(cb => parseInt(cb.value));
    if (selected.length === 0) { showToast('⚠️ Please select at least one product'); return; }
    const inserts = selected.map(i => ({ ...PRESET_PRODUCTS[i], host_id: currentUser.id, available_all_properties: true, active: true }));
    const { error } = await sb.from('products').insert(inserts);
    if (error) { showToast('⚠️ Error adding presets'); console.error(error); return; }
    showToast(`✅ ${selected.length} product${selected.length > 1 ? 's' : ''} added!`);
    closePresetModal();
    loadProducts();
  }

  // ── ORDERS ──
  async function loadOrders() {
    if (!currentUser) return;
    const { data } = await sb.from('orders').select('*').eq('host_id', currentUser.id).order('created_at', { ascending: false });
    orders = data || [];
    renderOrders();
    const total = orders.reduce((s, o) => s + (o.total || 0), 0);
    document.getElementById('statRevenue').textContent = '$' + total;
    document.getElementById('statOrders').textContent = orders.length;
  }

  function filterOrders() {
    const q = (document.getElementById('ordersSearch')?.value || '').toLowerCase();
    const filtered = orders.filter(o =>
      (o.guest_name || '').toLowerCase().includes(q) ||
      (o.property_name || '').toLowerCase().includes(q)
    );
    renderOrders(filtered);
  }

  function renderOrders(list) {
    const data = list !== undefined ? list : orders;
    const wrap = document.getElementById('ordersListWrap');
    if (!data.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No orders yet</h3><p>Orders will appear here when guests purchase from your store.</p></div>`;
      return;
    }
    // Sort by check-in date descending
    const sorted = [...data].sort((a, b) => new Date(b.checkin_date || b.created_at) - new Date(a.checkin_date || a.created_at));
    wrap.innerHTML = sorted.map(o => {
      const initials = (o.guest_name || 'G').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
      const checkin = o.checkin_date ? o.checkin_date.slice(0,10) : '';
      const checkout = o.checkout_date ? o.checkout_date.slice(0,10) : '';
      const statusDot = o.status === 'fulfilled' ? '🟢' : o.status === 'paid' ? '🔵' : '🟡';
      return `
        <div class="order-row" onclick="openOrderDetail('${o.id}')">
          <div class="order-row-left">
            <div class="order-row-avatar">${initials}</div>
            <div>
              <div class="order-row-name">${o.guest_name || 'Guest'}</div>
              <div class="order-row-dates">${checkin}${checkout ? ' → ' + checkout : ''}${o.property_name ? ' · ' + o.property_name : ''}</div>
            </div>
          </div>
          <div class="order-row-right">
            <span title="${o.status || 'pending'}">${statusDot}</span>
            <span class="order-row-amount">$${o.total || 0}</span>
            <span class="order-row-chevron">›</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function openOrderDetail(id) {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
    const notes = o.product_notes ? (typeof o.product_notes === 'string' ? JSON.parse(o.product_notes) : o.product_notes) : {};
    const noteEntries = Object.entries(notes).filter(([,v]) => v);
    const statusClass = o.status === 'fulfilled' ? 'status-fulfilled' : o.status === 'paid' ? 'status-paid' : 'status-pending';
    document.getElementById('orderDetailContent').innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;margin-bottom:4px">${o.guest_name || 'Guest'}</div>
          <div style="font-size:13px;color:var(--muted)">📅 ${o.checkin_date || ''} → ${o.checkout_date || ''}</div>
          ${o.property_name ? `<div style="font-size:13px;color:var(--brand);font-weight:500;margin-top:2px">🏠 ${o.property_name}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--brand)">$${o.total || 0}</div>
          <div class="order-status ${statusClass}" style="margin-top:4px;display:inline-flex">● ${o.status || 'pending'}</div>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:8px">Items ordered</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${items.map(i => `<span class="order-item-tag">${i.name} · $${i.price}</span>`).join('')}</div>
      </div>
      ${o.notes ? `<div class="order-notes" style="margin-bottom:12px">💬 "${o.notes}"</div>` : ''}
      ${noteEntries.length ? `<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:8px">Guest notes</div>${noteEntries.map(([k,v]) => `<div class="order-notes" style="margin-bottom:6px"><strong>${k}:</strong> ${v}</div>`).join('')}</div>` : ''}
      <div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:1.5px solid var(--border)">
        ${o.status !== 'fulfilled' ? `<button class="btn btn-success btn-sm" onclick="fulfillOrder('${o.id}')">✓ Mark as fulfilled</button>` : '<span style="font-size:13px;color:var(--brand);font-weight:500">✓ Fulfilled</span>'}
      </div>
    `;
    // Navigate to detail page without resetting nav active state
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-order-detail').classList.add('active');
    document.getElementById('topbarTitle').textContent = 'Order Detail';
  }

  async function fulfillOrder(id) {
    await sb.from('orders').update({ status: 'fulfilled' }).eq('id', id);
    showToast('✅ Order marked as fulfilled');
    await loadOrders();
    openOrderDetail(id);
  }

  // ── VOUCHERS ──
  async function loadVouchers() {
    const postcode = currentHost?.postcode;
    if (!postcode) return;
    const { data } = await sb.from('vouchers').select('*, partners(business_name)').eq('active', true);
    const relevant = (data || []).filter(v => {
      const codes = Array.isArray(v.postcodes) ? v.postcodes : JSON.parse(v.postcodes || '[]');
      return codes.includes(postcode);
    });
    renderVouchers(relevant);
  }

  function renderVouchers(vouchers) {
    const list = document.getElementById('vouchersList');
    if (!vouchers.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎟️</div><h3>No vouchers in your area yet</h3><p>Local businesses will appear here once they sign up.<br>Make sure your postcode is set in Store Settings.</p></div>`;
      return;
    }
    list.innerHTML = vouchers.map(v => `
      <div class="product-row">
        <div class="product-emoji" style="background:var(--accent-light)">🎟️</div>
        <div class="product-info">
          <div class="product-name">${v.title}</div>
          <div class="product-meta">${v.partners?.business_name || ''} · ${v.value || ''} · Expires ${v.expiry_date || 'N/A'}</div>
          ${v.description ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${v.description}</div>` : ''}
        </div>
        <div class="product-actions">
          <button class="btn btn-accent btn-sm" onclick="addVoucherToStore('${v.id}', '${v.title}')">Add to store</button>
        </div>
      </div>
    `).join('');
  }

  async function addVoucherToStore(voucherId, title) {
    const { error } = await sb.from('products').insert({
      host_id: currentUser.id, name: title,
      description: 'Local partner voucher', price: 0,
      category: 'other', emoji: '🎟️',
      is_voucher: true, available_all_properties: true, active: true,
    });
    if (error) { showToast('⚠️ Error adding voucher'); return; }
    showToast('✅ Voucher added to your store!');
    loadProducts();
  }

  // ── STORE SETTINGS ──
  // ── LOGO ──
  let currentLogoUrl = null;

  function previewLogo(input) { }
  function removeLogo() { currentLogoUrl = null; }
  async function uploadLogo(file) { return null; }

  async function saveStoreSettings() {
    const updates = {
      store_name: document.getElementById('storeName').value.trim(),
      store_tagline: document.getElementById('storeTagline').value.trim(),
      store_welcome: document.getElementById('storeWelcome').value.trim(),
      brand_colour: document.getElementById('brandColour').value,
      postcode: document.getElementById('storePostcode').value.trim(),
    };
    await sb.from('hosts').update(updates).eq('id', currentUser.id);
    Object.assign(currentHost, updates);
    showToast('✅ Store settings saved');
    tickCheck('checkStore');
    loadVouchers();
  }

  // ── COLOUR ──
  function buildSwatches() {
    document.getElementById('swatches').innerHTML = swatchColours.map(c =>
      '<div class="swatch" style="background:' + c + '" onclick="document.getElementById(\'brandColour\').value=\'' + c + '\';updateColourPreview(\'' + c + '\')"></div>'
    ).join('');
  }

  function updateColourPreview(val) { document.getElementById('colourPreview').style.background = val; }

  function copyStoreUrl() {
    navigator.clipboard.writeText('https://hostiehub.com.au/store/' + (currentHost?.username || '')).then(() => showToast('📋 Link copied!'));
  }

  // ── STRIPE ──
  async function connectStripe() {
    showToast('⏳ Setting up Stripe Connect...');
    try {
      // Create a Stripe Connect Express account for this host
      const createRes = await fetch('https://hostie-hub-ai.still-feather-9559.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Service': 'stripe-create-account' },
        body: JSON.stringify({ email: currentHost.email })
      });
      const account = await createRes.json();
      console.log('Stripe account response:', JSON.stringify(account));
      if (!account.id) { showToast('⚠️ Stripe error: ' + (account.error?.message || JSON.stringify(account))); return; }

      // Save account ID to database
      await sb.from('hosts').update({ stripe_account_id: account.id }).eq('id', currentUser.id);

      // Get onboarding URL
      const linkRes = await fetch('https://hostie-hub-ai.still-feather-9559.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Service': 'stripe-connect-url' },
        body: JSON.stringify({
          account_id: account.id,
          return_url: 'https://hostiehub.com.au/dashboard.html?stripe=success',
          refresh_url: 'https://hostiehub.com.au/dashboard.html?stripe=refresh',
        })
      });
      const link = await linkRes.json();
      if (!link.url) { showToast('⚠️ Error getting Stripe link. Please try again.'); return; }

      // Redirect host to Stripe onboarding
      window.location.href = link.url;

    } catch (err) {
      console.error(err);
      showToast('⚠️ Something went wrong. Please try again.');
    }
  }

  // ── PROFILE ──
  async function saveProfile() {
    const name = document.getElementById('accountName').value.trim();
    await sb.from('hosts').update({ full_name: name }).eq('id', currentUser.id);
    document.getElementById('sidebarName').textContent = name;
    showToast('✅ Profile saved');
  }

  async function changeUsername() {
    const newUsername = document.getElementById('newUsername').value.trim();
    if (!newUsername || !/^[a-z0-9-]{3,30}$/.test(newUsername)) {
      showToast('⚠️ Username must be 3–30 lowercase letters, numbers or hyphens');
      return;
    }
    if (newUsername === currentHost.username) {
      showToast('⚠️ That\'s already your current username');
      return;
    }
    if (!confirm('Are you sure?\n\nYour store URL will change to:\nhostiehub.com.au/store/' + newUsername + '\n\nYour old URL (hostiehub.com.au/store/' + currentHost.username + ') will stop working immediately.')) return;

    // Check if taken
    const { data: existing } = await sb.from('hosts').select('username').eq('username', newUsername).single();
    if (existing) { showToast('⚠️ That username is already taken'); return; }

    await sb.from('hosts').update({ username: newUsername }).eq('id', currentUser.id);
    currentHost.username = newUsername;
    document.getElementById('sidebarUrl').textContent = 'hostiehub.com.au/store/' + newUsername;
    document.getElementById('storeUrlDisplay').textContent = 'hostiehub.com.au/store/' + newUsername;
    document.getElementById('viewStoreBtn').href = 'https://hostiehub.com.au/store/' + newUsername;
    showToast('✅ Store URL updated to hostiehub.com.au/store/' + newUsername);
  }

  async function requestUpgradeContact() {
    const btn = document.getElementById('upgradeContactBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Sending...';
    try {
      await fetch('https://hostie-hub-ai.still-feather-9559.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Service': 'resend' },
        body: JSON.stringify({
          from: 'Hostie Hub <hello@hostiehub.com.au>',
          to: 'hello@hostiehub.com.au',
          subject: `Upgrade request from ${currentHost.full_name || currentHost.username}`,
          html: `<p><strong>${currentHost.full_name || currentHost.username}</strong> (${currentHost.email}) has hit their property limit and would like to be contacted about upgrading their plan.</p><p>Current plan: ${currentHost.plan || 'trial'}</p><p>Properties: ${properties.length}</p>`
        })
      });
      btn.textContent = '✅ Request sent!';
      showToast('✅ We\'ll be in touch shortly about upgrading your plan!');
      setTimeout(() => { document.getElementById('upgradeModal').classList.remove('open'); }, 2000);
    } catch (err) {
      btn.textContent = '✉️ Yes, contact me about upgrading';
      btn.disabled = false;
      showToast('⚠️ Something went wrong. Please email hello@hostiehub.com.au');
    }
  }

  async function handleLogout() { await sb.auth.signOut(); window.location.href = 'signup.html'; }

  // ── HELPERS ──
  function tickCheck(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.check-circle').className = 'check-circle check-done';
    el.querySelector('.check-circle').textContent = '✓';
    // Hide the checklist card if all steps are complete
    const allDone = ['checkStore','checkProperties','checkProducts','checkStripe'].every(cid => {
      const item = document.getElementById(cid);
      return item && item.querySelector('.check-circle.check-done');
    });
    if (allDone) {
      const card = document.querySelector('.setup-checklist')?.closest('.card');
      if (card) card.style.display = 'none';
    }
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.style.display = 'flex';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
  }

  // Expose all functions used in inline onclick attributes as globals
  window.showPage = showPage;
  window.openPropertyModal = openPropertyModal;
  window.closePropertyModal = closePropertyModal;
  window.saveProperty = saveProperty;
  window.editProperty = editProperty;
  window.deleteProperty = deleteProperty;
  window.openProductModal = openProductModal;
  window.closeProductModal = closeProductModal;
  window.saveProduct = saveProduct;
  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;
  window.toggleProduct = toggleProduct;
  window.openPresetModal = openPresetModal;
  window.closePresetModal = closePresetModal;
  window.addSelectedPresets = addSelectedPresets;
  window.openOrderDetail = openOrderDetail;
  window.fulfillOrder = fulfillOrder;
  window.filterOrders = filterOrders;
  window.addVoucherToStore = addVoucherToStore;
  window.connectStripe = connectStripe;
  window.saveProfile = saveProfile;
  window.changeUsername = changeUsername;
  window.saveStoreSettings = saveStoreSettings;
  window.copyStoreUrl = copyStoreUrl;
  window.updateColourPreview = updateColourPreview;
  window.selectEmoji = selectEmoji;
  window.toggleAllProperties = toggleAllProperties;
  window.removeImage = removeImage;
  window.previewImage = previewImage;
  window.requestUpgradeContact = requestUpgradeContact;
  window.handleLogout = handleLogout;

  init();
