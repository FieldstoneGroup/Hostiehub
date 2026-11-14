# Host pricing, onboarding, and languages

This file is the checklist for Luke. The website copy is already consistent. Nothing charges a host until the two server settings below are filled in.

## Host price (per property, volume tiers)

Public pages read `js/pricing.js`. The subscription is **per property per month**. Every property is billed at the rate of the tier the host reaches:

| Properties | Each per month |
|---|---|
| 1–2 | $10 AUD |
| 3–10 | $8 AUD |
| 11+ | $6 AUD |

Shown as **From $6 per property per month**. The first month is free. No card is required to start. Hosts keep 100% of guest sales. Hostie Hub takes no commission and no platform fee. Stripe Connect guest checkout still sends `application_fee_amount` of 0.

Partner listings stay on their own price (`$49` per listing per month after 3 free months). That is not the host plan.

## Stripe account and price

Use the Hostie Hub account **`acct_1TH1K4FGh2TNwWGY`** only.

| | |
|---|---|
| Product | `prod_VcosxU73288ZLQ` (Hostie Hub Host Plan) |
| Price | `price_1UbZFJFGh2TNwWGYsQhTzePk` |
| Currency / interval | AUD, monthly, licensed |
| Tiers | `tiers_mode=volume`: up to 2 = $10/unit, up to 10 = $8/unit, inf = $6/unit |

Do **not** use `prod_Vcoq2mnFXsp5ij`. That product is on the wrong Stripe account.

Set this on Vercel and on the Cloudflare worker:

```
HOSTIE_STRIPE_PRICE_ID=price_1UbZFJFGh2TNwWGYsQhTzePk
```

The code uses that value when the env var is unset. `STRIPE_SECRET_KEY` must be a secret key for `acct_1TH1K4FGh2TNwWGY`. Checked on 14 Nov 2026: the Vercel project `hostiehub` has **no** `STRIPE_SECRET_KEY` in any environment, so the preview cannot confirm the key and cannot create a Checkout Session until the key is added.

Checkout (`api/host-subscription.js`) sets:

- `line_items[0][price]` = `HOSTIE_STRIPE_PRICE_ID`
- `line_items[0][quantity]` = the host's property count (at least 1)
- `subscription_data[trial_period_days]` = `30`
- `payment_method_collection` = `if_required` (no card to start)

Adding or removing a property calls `POST /api/host-subscription` with `{ "action": "sync-quantity" }`, which updates the Stripe subscription item quantity. The same update is in `worker.js` as `X-Service: stripe-host-quantity` (redeploy the worker before relying on that URL). `hosts.plan` stays `host`. New columns, added without changing old ones:

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
