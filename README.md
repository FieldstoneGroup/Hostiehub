# Hostie Hub

The marketing site, host dashboard, and guest store. Pricing and onboarding notes are in [HOSTIE_SETUP.md](HOSTIE_SETUP.md).

## AI proxy (Grok via Cloudflare)

`worker.js` is the Cloudflare Worker `hostie-hub-ai`. Callers outside this repo still send an [Anthropic Messages](https://docs.anthropic.com/) body and read an Anthropic message back (`content[]` text and `tool_use` blocks, `stop_reason`, `usage`). The Worker translates that into Grok. Those callers are not edited here:

- `livestayguide-app`, through the `AI_PROXY` service binding (sends `claude-sonnet-4-5`)
- the Supabase edge function `store-agent` (sends Anthropic Messages)

Inside this repo, Claude model ids and `api.anthropic.com` are gone except the temporary rollback below. `support-widget.js` asks for `xai/grok-4.3`. Stripe, Resend, refunds, and the other known `X-Service` handlers are untouched.

Grok is the default. `AI_BACKEND=anthropic` is the only rollback, and it lasts only while the Anthropic account still accepts `claude-sonnet-4-5` (retired 30 Nov 2026). Unset means Grok.

Checked against Cloudflare's docs on 27 Nov 2026:

- Catalog id `xai/grok-4.3`. Its request format is **Chat Completions**, not Anthropic Messages. [Grok 4.3](https://developers.cloudflare.com/ai/models/xai/grok-4.3/)
- From a Worker, the binding call is `env.AI.run("xai/grok-4.3", input, { gateway: { id } })`. `input` is the chat body (`messages`, `tools`, `max_tokens`, …). Do not wrap it in `{ input }`. [Workers bindings](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)
- Without the binding, the same body goes to `POST https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/v1/chat/completions` with `Authorization: Bearer $CLOUDFLARE_API_TOKEN` and `cf-aig-gateway-id`. [REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
- `/ai/v1/messages` is Anthropic's schema. Grok 4.3 is not documented for it, so this proxy translates instead of forwarding the Anthropic body there.
- Third-party models bill through [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/). No xAI API key. Grok 4.3 is $1.25 / 1M input tokens, $2.50 / 1M output tokens, $0.20 / 1M cached input.
- The REST token needs **Account → Workers AI → Read**. A token with only an AI Gateway permission returns `401` and error code `10000`.

The Worker prefers the `AI` binding. It uses the REST call only when `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set and the binding is absent (that is also what `scripts/smoke-ai.mjs` uses).

### What Luke sets

| Name | Required when | Purpose |
|---|---|---|
| `AI_BACKEND` | Only to roll back | Unset, `cloudflare`, or any other value calls Grok. The single rollback value is `anthropic`. |
| `ANTHROPIC_API_KEY` | Only while rolling back | Leave it until the Anthropic account is closed. Grok does not read it. |
| AI binding `AI` | Yes, before the Worker deploy | In `wrangler.jsonc`. Uses the account's Unified Billing credits. No API token inside the Worker. |
| `AI_GATEWAY_ID` | No | Gateway name. Unset uses `default`, which Cloudflare creates on first use. |
| `AI_MODEL_SONNET` | No | Target for model names containing `sonnet` or `opus`. Default `xai/grok-4.3`. |
| `AI_MODEL_HAIKU` | No | Target for names containing `haiku`. Default `xai/grok-4.3`. The catalog has no cheaper xAI chat model (grok-4.20 and grok-4.5+ are $2 / $6 per 1M). |
| `AI_MODEL_DEFAULT` | No | Anything else, including an empty model. Default `xai/grok-4.3`. A caller that already sends a catalog id (`author/model`) is used as-is. |
| `AI_REASONING_EFFORT` | No | For `xai/grok-4.3`, unset sends `none`. Also `low`, `medium`, `high`, or `omit`. `none` keeps `max_tokens` for the visible answer. Grok's own default is `low`, which spends extra reasoning tokens. Other xAI ids do not get a default, because grok-4.20 rejects the field. |
| `PROXY_TOKEN` | No | Shared secret. **Off when unset**, so current callers keep working. When set, a messages request must send `X-Proxy-Token: <secret>` or `Authorization: Bearer <secret>`. |
| `PROXY_TRUST_WORKERS` | No | Comma-separated Worker names that skip the secret. Default `livestayguide-app`. Cloudflare sets `CF-Worker` on service-binding calls; a browser cannot set that header. |
| `CLOUDFLARE_ACCOUNT_ID` | Only without the AI binding | Account id (`wrangler whoami`). |
| `CLOUDFLARE_API_TOKEN` | Only without the AI binding | Workers AI Read token. Prefer the binding so this token is not stored on the Worker. |

`PROXY_TOKEN` does not apply to `X-Service` routes. Those stay open, as they are today.

These are not secrets except `PROXY_TOKEN`, `CLOUDFLARE_API_TOKEN`, and the existing provider keys. Set plain values in the Worker dashboard (Settings → Variables) or with `npx wrangler secret put <NAME>`. `wrangler secret put` deploys a new version immediately.

### Cloudflare account setup

1. In the Cloudflare account that owns `hostie-hub-ai` (subdomain `still-feather-9559`), open **AI → AI Gateway** and note the gateway name. `default` is created automatically if you do not have one. Logs, caching, and rate limits for that gateway apply to these calls.
2. Load [Unified Billing credits](https://developers.cloudflare.com/ai-gateway/features/unified-billing/). Grok calls fail without credits. A stored xAI key is not required. The text models in the catalog on 27 Nov 2026 are grok-4.3 ($1.25 / $2.50 per 1M), grok-4.20 ($2 / $6), and grok-4.5, 4.6, and 4.7 ($2 / $6 under 200k). The support widget and old haiku names use grok-4.3.
3. Deploy the Worker with the `AI` binding in `wrangler.jsonc` (steps below). That is the production path.
4. Optional smoke test from a laptop, before or after cutover. Create an API token with **Account → Workers AI → Read** (not AI Gateway alone):

```bash
CLOUDFLARE_ACCOUNT_ID="your-account-id" \
CLOUDFLARE_API_TOKEN="your-token" \
node scripts/smoke-ai.mjs
```

The script sends one forced tool call and one tool result, then checks the reply mentions the tool output. It spends a small amount of credit. `AI_GATEWAY_ID` and `AI_MODEL` are optional.

### Deploy

Do not deploy until the credits and the binding are ready. Shipping this code with `AI_BACKEND` unset does not change which model answers. It does change the Worker config if you use Wrangler, because this repo had no Wrangler file and the live Worker was configured in the dashboard.

Before the first `wrangler deploy`:

1. Open the existing Worker and write down its **cron trigger**, **routes**, **compatibility date**, and **variables**. The trial-reminder `scheduled` handler depends on that cron. This repo does not know the cron expression. If `wrangler.jsonc` has no `triggers.crons` entry, deploy deletes the dashboard cron.
2. Paste the real cron into `wrangler.jsonc`, for example `"triggers": { "crons": ["<the expression from the dashboard>"] }`.
3. Compare the dashboard compatibility date with `2026-11-27` in `wrangler.jsonc`. Moving the date forward is intentional for this change; read the compatibility notes if the dashboard date is much older, because it applies to the Stripe and Resend routes too.
4. Deploy with vars preserved, from this repo:

```bash
npx wrangler@4 deploy --keep-vars
```

`--keep-vars` keeps dashboard plain variables and secrets that are not listed in `wrangler.jsonc`. The deploy adds the `AI` binding and turns on Workers logs and traces. With `AI_BACKEND` unset, that deploy is the cutover: the next messages request uses Grok.

5. Run `node scripts/smoke-ai.mjs` with a Workers AI Read token before relying on production.
6. Deploy this Worker before the website. `support-widget.js` and `api/assistant.js` send `xai/grok-4.3` to the worker. The worker that is live today would forward that id to Anthropic, which rejects it.
7. Send one support-widget message and one known agent tool round (dashboard agent or `store-agent`) and confirm `stop_reason` is `end_turn` or `tool_use`, and that a tool result round finishes.

`X-Service: resend`, `stripe-checkout`, `stripe-host-quantity`, `process-refund`, the webhook, and the partner/host notification routes are the same code as before.

### Rollback

Set `AI_BACKEND=anthropic` on the Worker. Deleting the variable does not roll back; unset stays on Grok. The messages route then forwards the body to `https://api.anthropic.com/v1/messages` with `ANTHROPIC_API_KEY`. Callers stay as they are. That relay still answers HTTP 200 and passes Anthropic's JSON through, including Anthropic's own error JSON. This is temporary. After the account is closed, or after 30 Nov 2026 for `claude-sonnet-4-5`, the rollback stops working.

If the deploy itself misbehaves (cron gone, a Stripe route failing), roll the Worker version back from **Workers → hostie-hub-ai → Deployments**. Rolling the version back does not put credits or gateway settings back, and it will not restore a cron that the new version deleted unless that cron was on the previous version. Copy the cron into `wrangler.jsonc` before deploying so it does not get deleted. A version rollback also returns the messages route to the old Anthropic forward, which dies with the account.

### Optional proxy secret

Leave `PROXY_TOKEN` unset until you mean to lock the messages route. The check runs on both backends, so setting it before callers send the header also blocks the Anthropic rollback.

- `livestayguide-app` is allowed without the secret when its Worker name matches `PROXY_TRUST_WORKERS` (default `livestayguide-app`). Confirm the script name in the dashboard. A rejected call logs `cf_worker` and not the token.
- `store-agent` calls over HTTP. It needs `X-Proxy-Token` once the secret is on, which means editing that function. This repo does not change it.
- `support-widget.js` is public browser JavaScript. A token in that file is not a secret. Turning `PROXY_TOKEN` on blocks the widget until it sends the header, and anyone who can load the script can read the header.

### Tests

```bash
node scripts/test-ai-translate.mjs
node scripts/test-refund.mjs
```

The translation tests cover multi-turn tool use, parallel tool calls, `tool_result` with `is_error`, base64 and URL images, `end_turn`, `tool_use`, `max_tokens` (including a truncated tool argument), Grok as the default backend, the Anthropic rollback switch, the optional secret, the service-binding exemption, the support widget and store assistant no longer naming Claude, and that `X-Service: resend` still reaches Resend while a non-message body such as `stripe-account-status` calls no provider.

### Behaviour the callers rely on

- `system` (string or text blocks) becomes a leading system message. `cache_control` is dropped. xAI may still cache prompt tokens on its own; that shows up as `usage.cache_read_input_tokens` when the provider reports it.
- `tools[].input_schema` becomes a chat-completions function `parameters`. `tool_choice` `auto` / `any` / `tool` / `none` becomes `auto` / `required` / `{ type: "function", function: { name } }` / `none`. `disable_parallel_tool_use: true` sets `parallel_tool_calls: false`.
- Assistant `tool_use` blocks become `tool_calls`. The id is preserved, so the following `tool_result.tool_use_id` still matches. `input` is JSON. A `tool_result` with `is_error: true` is prefixed with `[tool error]`.
- Base64 images become `data:<media_type>;base64,...` image parts. URL images pass through. PDF `document` blocks are replaced with a short note that the block was omitted.
- Reply `finish_reason` `stop` → `end_turn`, `tool_calls` → `tool_use`, `length` → `max_tokens`. `content_filter` becomes `end_turn` and the refusal text is a text block. Reasoning text from Grok is not copied into `content`, so the support widget's `content[0].text` stays the visible answer.
- `usage.input_tokens` is `prompt_tokens`. `usage.output_tokens` is `completion_tokens`.
- On the Cloudflare path, failures are an Anthropic error object and the HTTP status (`401`, `429`, `400`, `502`, …), for example `{ "type": "error", "error": { "type": "rate_limit_error", "message": "..." } }`. The Worker catches provider exceptions instead of crashing.
- `stream: true` is rejected with HTTP 400 on the Cloudflare path. Nothing in this repo sets it. The Anthropic path still forwards `stream` unchanged.

### Risks

- Tool-calling quality on a ~30-tool agent will differ from Claude. That is the risk accepted by moving straight to Grok. `reasoning_effort` defaults to `none` so a `max_tokens` of 1200 is available for the visible answer and tool calls. `low` or higher spends reasoning tokens on top of that cap (xAI's `max_tokens` limits the visible output; reasoning is extra and billed). Chat completions does not replay a reasoning trace on the next turn. With `none`, there is no trace to lose. If you raise the effort, multi-turn tool quality can drop because Grok's thinking is discarded between calls. xAI's own guidance prefers their Responses API for that; Cloudflare's Grok 4.3 catalog entry is chat completions, which is what this proxy uses.
- If `finish_reason` is `length` and the reply also contains a tool call, `stop_reason` is `max_tokens` and the tool block is still included. A truncated argument is `{ "_unparsed": "<raw>" }`. Callers should not execute tools when `stop_reason` is `max_tokens`.
- Haiku names, the support widget, and the store assistant's Grok path all use `xai/grok-4.3`. The Cloudflare catalog has no cheaper xAI chat model. `reasoning_effort` `none` is what keeps that call fast.
- Vision calls up to about 5 MB are parsed in the Worker and sent again as a data URL. That fits a normal request, and it is a second copy of the image in memory (128 MB Worker limit). Much larger images can fail the Worker or the provider.
- The messages route returns real HTTP error statuses. The old relay returned HTTP 200 even when Anthropic returned an error. A caller that treats any non-200 as a transport failure will take its error path. The error body is still Anthropic-shaped.
- `PROXY_TOKEN` breaks the public support widget and `store-agent` until they send it. Service-binding exemption depends on the platform `CF-Worker` header matching the script name.
- Several dashboard `X-Service` names have no handler in `worker.js`: `stripe-account-status`, `stripe-order-complete`, `send-invite-accepted`, `send-linked-user-invite`. They do not send `messages`. They used to fall through to Anthropic. They now get HTTP 400 and are not sent to Grok or Anthropic. Stripe Connect "is the account ready?" in the dashboard depends on `stripe-account-status`, which this Worker does not implement.
- `api/assistant.js` defaults to OpenAI when `HOSTIE_LLM_PROVIDER` is unset. `grok`, `cloudflare`, and a leftover `anthropic` call the worker with `xai/grok-4.3`. The Anthropic key is no longer sent. The call still waits for `HOSTIE_LLM_API_KEY` to be set; without it the assistant stays on the rules list. Deploy the Worker before this Vercel function.

### Calls moved off Claude

| Place | Before | Now |
|---|---|---|
| `support-widget.js` | `claude-haiku-4-5-20251001` to the worker | `xai/grok-4.3`. The reply is still read from `content[0].text`. |
| `api/assistant.js` | `POST https://api.anthropic.com/v1/messages` when `HOSTIE_LLM_PROVIDER=anthropic`, model `claude-haiku-4-5-20251001` | Same provider name calls the worker with `xai/grok-4.3`. A Claude id in `HOSTIE_LLM_MODEL` is rewritten. No `api.anthropic.com`. |
| `worker.js` messages route | Forwarded the body to `api.anthropic.com` | Grok via the AI binding, unless `AI_BACKEND=anthropic`. |
| `worker.js` unknown `X-Service` | Also forwarded to `api.anthropic.com` | HTTP 400. Known Stripe, Resend, refund, and notification routes are unchanged. |
| `ai-translate.js` | New | `api.anthropic.com` exists only inside the `AI_BACKEND=anthropic` rollback. |
| `HOSTIE_SETUP.md` | Documented provider `anthropic` | Documents that value as a Grok alias. |

`livestayguide-app` and `store-agent` are not in this repo. They still send Claude model names. The worker maps `haiku`, `sonnet`, and `opus` to `xai/grok-4.3`.
- No caller in this repo streams. A caller added later with `stream: true` gets a 400 on the Grok path rather than a silent non-streaming reply.
