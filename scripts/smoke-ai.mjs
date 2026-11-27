// Live smoke test for the Grok translation. Spends a small amount of
// Cloudflare Unified Billing credit. Does not deploy anything.
//
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/smoke-ai.mjs
//
// Optional: AI_GATEWAY_ID (default "default"), AI_MODEL (default xai/grok-4.3),
// AI_REASONING_EFFORT (default low, matching production).
//
// The token needs Account > Workers AI > Read. An AI Gateway-only token
// returns 401 with error code 10000. The account needs Unified Billing credits.

import { anthropicToChat, callCloudflareModel, chatCompletionToAnthropic } from '../ai-translate.js';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const token = process.env.CLOUDFLARE_API_TOKEN || '';
if (!accountId || !token) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, then re-run.');
  console.error('This calls the real AI Gateway chat completions endpoint and spends Unified Billing credit.');
  process.exit(2);
}

const model = process.env.AI_MODEL || 'xai/grok-4.3';
const env = {
  AI_MODEL_SONNET: model,
  AI_MODEL_HAIKU: model,
  AI_MODEL_DEFAULT: model,
  AI_REASONING_EFFORT: process.env.AI_REASONING_EFFORT || 'low',
  AI_GATEWAY_ID: process.env.AI_GATEWAY_ID || 'default',
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_API_TOKEN: token,
};

const tool = {
  name: 'guest_count',
  description: 'Returns how many guests a property can sleep.',
  input_schema: {
    type: 'object',
    properties: { property: { type: 'string', description: 'Property name' } },
    required: ['property'],
  },
};

function textOf(message) {
  return (message.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('\n');
}

async function turn(body) {
  const translated = anthropicToChat(body, env);
  if (translated.error) {
    console.error(JSON.stringify(translated.error, null, 2));
    process.exit(1);
  }
  const called = await callCloudflareModel(env, translated.model, translated.input);
  if (!called.ok) {
    console.error('HTTP ' + called.status);
    console.error(JSON.stringify(called.data, null, 2));
    process.exit(1);
  }
  const anthropic = chatCompletionToAnthropic(called.data, translated.model);
  if (anthropic.status !== 200) {
    console.error(JSON.stringify(anthropic.body, null, 2));
    process.exit(1);
  }
  return anthropic.body;
}

const firstBody = {
  model: 'claude-sonnet-4-5',
  max_tokens: 300,
  temperature: 0,
  system: 'You are a test harness. When asked how many guests a property sleeps, call guest_count. Do not guess a number before the tool returns.',
  tools: [tool],
  tool_choice: { type: 'any' },
  messages: [{ role: 'user', content: 'How many guests can stay at Beach House?' }],
};

console.log('Turn 1: ' + model + ' via gateway ' + env.AI_GATEWAY_ID);
const first = await turn(firstBody);
const toolUse = (first.content || []).find((block) => block.type === 'tool_use');
console.log(JSON.stringify({
  stop_reason: first.stop_reason,
  tool: toolUse ? { id: toolUse.id, name: toolUse.name, input: toolUse.input } : null,
  text: textOf(first),
  usage: first.usage,
}, null, 2));

if (!toolUse || first.stop_reason !== 'tool_use') {
  console.error('Expected stop_reason tool_use and a guest_count tool call.');
  process.exit(1);
}
if (toolUse.name !== 'guest_count') {
  console.error('Expected tool guest_count, got ' + toolUse.name);
  process.exit(1);
}

const second = await turn({
  model: 'claude-sonnet-4-5',
  max_tokens: 300,
  temperature: 0,
  system: firstBody.system,
  tools: [tool],
  messages: [
    firstBody.messages[0],
    { role: 'assistant', content: first.content },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: '4 guests' }] },
  ],
});
console.log('Turn 2:');
console.log(JSON.stringify({
  stop_reason: second.stop_reason,
  text: textOf(second),
  usage: second.usage,
}, null, 2));

if (second.stop_reason === 'max_tokens') {
  console.error('Second turn hit max_tokens.');
  process.exit(1);
}
if (!/\b4\b|four/i.test(textOf(second))) {
  console.error('Second turn did not mention the tool result (4 guests).');
  process.exit(1);
}
console.log('Smoke test passed.');
