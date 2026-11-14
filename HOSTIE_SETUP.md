# Host pricing, onboarding, and languages

This file is the checklist for Luke. The website copy is already consistent. Nothing charges a host until the two server settings below are filled in.

## The monthly price (still TBC)

Public pages read one value:

`js/pricing.js` → `HOSTIE_PRICING.MONTHLY_PRICE_AUD`

It is `null` on purpose. Every page shows **TBC** until that number is set. Do not put a guessed price in the HTML.

The sentence used everywhere:

> First month free, then a simple monthly subscription. Hosts keep 100% of their guest sales. No card needed to start.

Hostie Hub does not take a commission or a platform fee on guest sales. Stripe Connect guest checkout still sends `application_fee_amount` of 0.

Partner listings stay on their own price (`$49` per listing per month after 3 free months). That is not the host plan.

## Turn billing on (Stripe)

Checkout is created only by `api/host-subscription.js`. It refuses to call Stripe unless **both** of these Vercel (or local) environment variables are set:

| Variable | Example | Purpose |
|---|---|---|
| `HOSTIE_STRIPE_PRICE_ID` | `price_123` | Stripe Billing Price for the monthly host plan |
| `HOSTIE_MONTHLY_PRICE_AUD` | `29` | Must match `MONTHLY_PRICE_AUD` in `js/pricing.js` |
| `STRIPE_SECRET_KEY` | already used by the worker | Secret key. Never put this in the browser. |

While either host variable is empty, the Account page explains that billing is off and no card is collected.

The first month is the existing `hosts.trial_ends_at` (30 days, no card). When a host later subscribes, Checkout uses the days left on that trial (minimum 2, because Stripe requires it). `hosts.plan` stays `host`. New columns, added without changing old ones:

- `hosts.stripe_customer_id`
- `hosts.stripe_subscription_id`
- `hosts.subscription_status`

The Cloudflare worker (`worker.js`) records those fields from Stripe webhooks (`checkout.session.completed` for subscriptions, and `customer.subscription.*`). Redeploy that worker before real billing, or the Checkout Session can succeed and the dashboard will not show the subscription. Do not deploy it just to test copy.

## Store assistant

`POST /api/assistant` only returns suggestions. It never inserts products. The host presses Add or Apply.

If `HOSTIE_LLM_API_KEY` is missing, the API uses the rules in `js/suggestions.js`. That is the current behaviour.

| Variable | Purpose |
|---|---|
| `HOSTIE_LLM_API_KEY` | Turns on the model. Leave unset to keep the rules fallback. |
| `HOSTIE_LLM_PROVIDER` | `openai` (default) or `anthropic` |
| `HOSTIE_LLM_MODEL` | Optional model id |
| `HOSTIE_LLM_BASE_URL` | Optional OpenAI-compatible base URL |

## Onboarding

After signup, hosts go to `onboarding.html`: platform, illustrated help, paste link, server-side read (`POST /api/listing-preview`), confirm the property, then suggested extras with an Add button. A failed or blocked listing falls through to manual entry. Products are created only by that click.

`onboarding.html?demo=1` and `dashboard.html?assistantDemo=1` walk the screens without writing to Supabase.

## Languages

`locales/en.json` plus `es`, `fr`, `de`, `it`, `pt`, `ja`, `zh`. Add a language by copying `en.json`. The guest store follows the browser language; the marketing site, signup, onboarding, and dashboard remember the switcher. Product names hosts type are stored as typed.

## Database

`supabase/migrations/20261114120000_onboarding_billing_locale.sql` only adds columns. It does not change existing columns or RLS policies. The same migration has been applied to project `hjwkycknjiyvrxbcejet`.
