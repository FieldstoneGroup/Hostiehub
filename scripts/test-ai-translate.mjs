import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker.js';
import {
  aiBackend,
  anthropicToChat,
  chatCompletionToAnthropic,
  handleAiProxy,
  isMessagesRequest,
  presentedProxyToken,
  reasoningEffortFor,
  resolveModel,
  secretsMatch,
  trustedServiceWorker,
} from '../ai-translate.js';

const weatherTool = {
  name: 'get_weather',
  description: 'Local weather',
  input_schema: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
};

function completion(message, finish, extra) {
  return Object.assign({
    id: 'chatcmpl_test',
    model: 'grok-4.3',
    choices: [{ index: 0, finish_reason: finish, message }],
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
      prompt_tokens_details: { cached_tokens: 3 },
    },
  }, extra || {});
}

function post(body, headers) {
  return new Request('https://hostie-hub-ai.example/ai', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify(body),
  });
}

async function withFetch(impl, fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = previous;
  }
}

assert.equal(aiBackend({}), 'cloudflare');
assert.equal(aiBackend({ AI_BACKEND: 'anthropic' }), 'anthropic');
assert.equal(aiBackend({ AI_BACKEND: 'cloudflare' }), 'cloudflare');
assert.equal(aiBackend({ AI_BACKEND: ' CLOUDFLARE ' }), 'cloudflare');
assert.equal(aiBackend({ AI_BACKEND: 'grok' }), 'cloudflare');

assert.equal(resolveModel('claude-sonnet-4-5', {}), 'xai/grok-4.3');
assert.equal(resolveModel('claude-sonnet-4-5-20250929', {}), 'xai/grok-4.3');
assert.equal(resolveModel('claude-opus-4-5', {}), 'xai/grok-4.3');
assert.equal(resolveModel('claude-haiku-4-5-20251001', {}), 'xai/grok-4.3');
assert.equal(resolveModel('xai/grok-4.7', {}), 'xai/grok-4.7');
assert.equal(resolveModel('', {}), 'xai/grok-4.3');
assert.equal(resolveModel('claude-haiku-4-5-20251001', { AI_MODEL_HAIKU: 'xai/grok-4.3' }), 'xai/grok-4.3');
assert.equal(resolveModel('claude-sonnet-4-5', { AI_MODEL_SONNET: 'xai/grok-4.7' }), 'xai/grok-4.7');
assert.equal(reasoningEffortFor('xai/grok-4.3', {}), 'none');
assert.equal(reasoningEffortFor('google/gemini-3-flash', {}), undefined);
assert.equal(reasoningEffortFor('xai/grok-4.20-0309-non-reasoning', {}), undefined);
assert.equal(reasoningEffortFor('xai/grok-4.3', { AI_REASONING_EFFORT: 'low' }), 'low');
assert.equal(reasoningEffortFor('xai/grok-4.3', { AI_REASONING_EFFORT: 'omit' }), undefined);

assert.equal(trustedServiceWorker('livestayguide-app', undefined), true);
assert.equal(trustedServiceWorker('LiveStayGuide-App', undefined), true);
assert.equal(trustedServiceWorker('other-worker', undefined), false);
assert.equal(trustedServiceWorker('livestayguide-app', 'other-worker'), false);
assert.equal(trustedServiceWorker('store-agent', 'livestayguide-app, store-agent'), true);
assert.equal(trustedServiceWorker('', undefined), false);
assert.equal(await secretsMatch('same-token', 'same-token'), true);
assert.equal(await secretsMatch('same-token', 'other-token'), false);
assert.equal(await secretsMatch('', 'secret'), false);

const translated = anthropicToChat({
  model: 'claude-sonnet-4-5',
  max_tokens: 1200,
  temperature: 0.2,
  top_p: 0.9,
  stop_sequences: ['END'],
  system: [
    { type: 'text', text: 'Be brief.', cache_control: { type: 'ephemeral' } },
    { type: 'text', text: 'Use tools.' },
  ],
  tool_choice: { type: 'auto', disable_parallel_tool_use: true },
  tools: [weatherTool, { name: 'guest_count', description: 'Guest count', input_schema: { type: 'object', properties: {} } }],
  messages: [
    { role: 'user', content: 'Weather in Newcastle and Sydney?' },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Checking both.' },
        { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Newcastle' } },
        { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: { city: 'Sydney' } },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: '22C' },
        { type: 'tool_result', tool_use_id: 'toolu_2', content: 'timeout', is_error: true },
        { type: 'text', text: 'Thanks.' },
      ],
    },
  ],
}, {});

assert.equal(translated.model, 'xai/grok-4.3');
assert.equal(translated.input.max_tokens, 1200);
assert.equal(translated.input.temperature, 0.2);
assert.equal(translated.input.top_p, 0.9);
assert.deepEqual(translated.input.stop, ['END']);
assert.equal(translated.input.reasoning_effort, 'none');
assert.equal(translated.input.tool_choice, 'auto');
assert.equal(translated.input.parallel_tool_calls, false);
assert.equal(translated.input.system, undefined);
assert.deepEqual(translated.input.tools[0], {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Local weather',
    parameters: weatherTool.input_schema,
  },
});
assert.deepEqual(translated.input.messages, [
  { role: 'system', content: 'Be brief.\n\nUse tools.' },
  { role: 'user', content: 'Weather in Newcastle and Sydney?' },
  {
    role: 'assistant',
    content: 'Checking both.',
    tool_calls: [
      { id: 'toolu_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Newcastle"}' } },
      { id: 'toolu_2', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Sydney"}' } },
    ],
  },
  { role: 'tool', tool_call_id: 'toolu_1', content: '22C' },
  { role: 'tool', tool_call_id: 'toolu_2', content: '[tool error] timeout' },
  { role: 'user', content: 'Thanks.' },
]);

const forced = anthropicToChat({
  model: 'claude-sonnet-4-5',
  max_tokens: 200,
  tools: [weatherTool],
  tool_choice: { type: 'tool', name: 'get_weather' },
  messages: [{ role: 'user', content: 'Newcastle?' }],
}, {});
assert.deepEqual(forced.input.tool_choice, { type: 'function', function: { name: 'get_weather' } });

const anyChoice = anthropicToChat({
  model: 'claude-sonnet-4-5',
  tools: [weatherTool],
  tool_choice: { type: 'any' },
  messages: [{ role: 'user', content: 'Go.' }],
}, {});
assert.equal(anyChoice.input.tool_choice, 'required');

const noChoice = anthropicToChat({
  model: 'claude-sonnet-4-5',
  tools: [weatherTool],
  tool_choice: { type: 'none' },
  messages: [{ role: 'user', content: 'Go.' }],
}, {});
assert.equal(noChoice.input.tool_choice, 'none');

const imageRequest = anthropicToChat({
  model: 'claude-sonnet-4-5',
  max_tokens: 100,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is this?' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
      { type: 'image', source: { type: 'url', url: 'https://example.com/room.jpg' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'abc' } },
    ],
  }],
}, {});
assert.deepEqual(imageRequest.input.messages, [{
  role: 'user',
  content: [
    { type: 'text', text: 'What is this?' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } },
    { type: 'image_url', image_url: { url: 'https://example.com/room.jpg' } },
    { type: 'text', text: '(unsupported content block: document)' },
  ],
}]);
assert.equal(imageRequest.input.reasoning_effort, 'none');

const toolImage = anthropicToChat({
  model: 'claude-haiku-4-5-20251001',
  messages: [{
    role: 'user',
    content: [{
      type: 'tool_result',
      tool_use_id: 'toolu_9',
      content: [
        { type: 'text', text: 'photo attached' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } },
      ],
    }],
  }],
}, {});
assert.equal(toolImage.model, 'xai/grok-4.3');
assert.equal(toolImage.input.reasoning_effort, 'none');
assert.deepEqual(toolImage.input.messages, [
  { role: 'tool', tool_call_id: 'toolu_9', content: 'photo attached' },
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Image from tool result toolu_9' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } },
    ],
  },
]);

const primitiveResult = anthropicToChat({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 4 }] }],
}, {});
assert.deepEqual(primitiveResult.input.messages, [{ role: 'tool', tool_call_id: 't1', content: '4' }]);

const missingId = anthropicToChat({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'assistant', content: [{ type: 'tool_use', name: 'get_weather', input: { city: 'Newcastle' } }] }],
}, {});
assert.equal(missingId.input.messages[0].tool_calls[0].id, 'toolu_0');
assert.equal(missingId.input.messages[0].content, null);

const emptyTools = anthropicToChat({ model: 'claude-sonnet-4-5', messages: [] }, {});
assert.equal(emptyTools.status, 400);
assert.equal(emptyTools.error.error.type, 'invalid_request_error');
const streamed = anthropicToChat({ model: 'claude-sonnet-4-5', stream: true, messages: [{ role: 'user', content: 'Hi' }] }, {});
assert.equal(streamed.status, 400);
assert.match(streamed.error.error.message, /stream/);

const endTurn = chatCompletionToAnthropic(completion({
  role: 'assistant',
  content: 'All set.',
  reasoning_content: 'Do not show this chain of thought.',
}, 'stop'), 'xai/grok-4.3');
assert.equal(endTurn.status, 200);
assert.equal(endTurn.body.type, 'message');
assert.equal(endTurn.body.role, 'assistant');
assert.equal(endTurn.body.stop_reason, 'end_turn');
assert.equal(endTurn.body.stop_sequence, null);
assert.deepEqual(endTurn.body.content, [{ type: 'text', text: 'All set.' }]);
assert.equal(JSON.stringify(endTurn.body).includes('chain of thought'), false);
assert.deepEqual(endTurn.body.usage, { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 3 });

const toolReply = chatCompletionToAnthropic(completion({
  role: 'assistant',
  content: null,
  tool_calls: [
    { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Newcastle"}' } },
    { id: 'call_2', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Sydney"}' } },
  ],
}, 'tool_calls'), 'xai/grok-4.3');
assert.equal(toolReply.body.stop_reason, 'tool_use');
assert.equal(toolReply.body.content[0].type, 'tool_use');
assert.deepEqual(toolReply.body.content, [
  { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Newcastle' } },
  { type: 'tool_use', id: 'call_2', name: 'get_weather', input: { city: 'Sydney' } },
]);

const truncated = chatCompletionToAnthropic(completion({
  role: 'assistant',
  content: 'partial',
  tool_calls: [
    { id: 'call_x', type: 'function', function: { name: 'get_weather', arguments: '{"city":' } },
  ],
}, 'length'), 'xai/grok-4.3');
assert.equal(truncated.body.stop_reason, 'max_tokens');
assert.equal(truncated.body.content[0].text, 'partial');
assert.deepEqual(truncated.body.content[1], {
  type: 'tool_use',
  id: 'call_x',
  name: 'get_weather',
  input: { _unparsed: '{"city":' },
});

const filtered = chatCompletionToAnthropic(completion({
  role: 'assistant',
  content: null,
  refusal: 'Cannot help with that.',
}, 'content_filter'), 'xai/grok-4.3');
assert.equal(filtered.body.stop_reason, 'end_turn');
assert.deepEqual(filtered.body.content, [{ type: 'text', text: 'Cannot help with that.' }]);

const arrayText = chatCompletionToAnthropic(completion({
  role: 'assistant',
  content: [{ type: 'text', text: 'From parts.' }],
}, 'stop'), 'xai/grok-4.3');
assert.deepEqual(arrayText.body.content, [{ type: 'text', text: 'From parts.' }]);

const wrapped = chatCompletionToAnthropic({
  success: true,
  result: completion({ role: 'assistant', content: 'Wrapped.' }, 'stop'),
}, 'xai/grok-4.3');
assert.equal(wrapped.body.content[0].text, 'Wrapped.');

const cloudflareAuth = chatCompletionToAnthropic({
  success: false,
  errors: [{ code: 10000, message: 'Authentication error' }],
}, 'xai/grok-4.3');
assert.equal(cloudflareAuth.status, 401);
assert.equal(cloudflareAuth.body.type, 'error');
assert.equal(cloudflareAuth.body.error.type, 'authentication_error');

const noChoices = chatCompletionToAnthropic({ id: 'x' }, 'xai/grok-4.3');
assert.equal(noChoices.status, 502);
assert.equal(noChoices.body.error.type, 'api_error');

let ran = null;
const aiEnv = {
  AI_BACKEND: 'cloudflare',
  AI_GATEWAY_ID: 'hostie',
  AI: {
    async run(model, input, options) {
      ran = { model, input, options };
      return completion({ role: 'assistant', content: 'Hello from Grok.' }, 'stop');
    },
  },
};
const handled = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  max_tokens: 1200,
  temperature: 0,
  system: 'Be brief.',
  messages: [{ role: 'user', content: 'Hi' }],
}), aiEnv, {
  model: 'claude-sonnet-4-5',
  max_tokens: 1200,
  temperature: 0,
  system: 'Be brief.',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(handled.status, 200);
const handledBody = await handled.json();
assert.equal(handledBody.stop_reason, 'end_turn');
assert.equal(handledBody.content[0].text, 'Hello from Grok.');
assert.equal(handled.headers.get('Access-Control-Allow-Origin'), '*');
assert.equal(ran.model, 'xai/grok-4.3');
assert.equal(ran.input.reasoning_effort, 'none');
assert.equal(ran.input.model, undefined);
assert.equal(ran.input.input, undefined);
assert.deepEqual(ran.options, { gateway: { id: 'hostie' } });
assert.deepEqual(ran.input.messages[0], { role: 'system', content: 'Be brief.' });

ran = null;
const haikuHandled = await handleAiProxy(post({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 500,
  messages: [{ role: 'user', content: 'Hi' }],
}), aiEnv, {
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 500,
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(haikuHandled.status, 200);
assert.equal(ran.model, 'xai/grok-4.3');
assert.equal(ran.input.reasoning_effort, 'none');

const thrown = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}), {
  AI_BACKEND: 'cloudflare',
  AI: { async run() { throw new Error('7003: User Input Error'); } },
}, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(thrown.status, 502);
const thrownBody = await thrown.json();
assert.equal(thrownBody.type, 'error');
assert.equal(thrownBody.error.type, 'api_error');
assert.match(thrownBody.error.message, /7003/);

const missing = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}), { AI_BACKEND: 'cloudflare' }, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(missing.status, 500);
const missingBody = await missing.json();
assert.equal(missingBody.error.type, 'api_error');
assert.match(missingBody.error.message, /AI binding/);

ran = null;
const streamBlocked = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  stream: true,
  messages: [{ role: 'user', content: 'Hi' }],
}), aiEnv, {
  model: 'claude-sonnet-4-5',
  stream: true,
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(streamBlocked.status, 400);
assert.equal(ran, null);

const locked = { AI_BACKEND: 'cloudflare', PROXY_TOKEN: 'top-secret', AI: aiEnv.AI };
const denied = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}), locked, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(denied.status, 401);
const deniedBody = await denied.json();
assert.equal(deniedBody.error.type, 'authentication_error');

const allowed = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}, { 'X-Proxy-Token': 'top-secret', Authorization: 'Bearer wrong' }), locked, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(allowed.status, 200);

const bearer = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}, { Authorization: 'Bearer top-secret' }), locked, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(bearer.status, 200);

const bound = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}, { 'CF-Worker': 'livestayguide-app' }), locked, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(bound.status, 200);

const stranger = await handleAiProxy(post({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
}, { 'CF-Worker': 'someone-else' }), locked, {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hi' }],
});
assert.equal(stranger.status, 401);

await withFetch(async (url, init) => {
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.headers['x-api-key'], 'sk-ant-test');
  assert.equal(init.headers['anthropic-version'], '2023-06-01');
  const sent = JSON.parse(init.body);
  assert.equal(sent.model, 'claude-sonnet-4-5');
  assert.equal(sent.stream, true);
  assert.deepEqual(sent.messages, [{ role: 'user', content: 'Hi' }]);
  return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}, async () => {
  const response = await handleAiProxy(post({
    model: 'claude-sonnet-4-5',
    stream: true,
    messages: [{ role: 'user', content: 'Hi' }],
  }), { AI_BACKEND: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test' }, {
    model: 'claude-sonnet-4-5',
    stream: true,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.error.type, 'authentication_error');
});

await withFetch(async (url, init) => {
  assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1/chat/completions');
  assert.equal(init.headers.Authorization, 'Bearer cf-token');
  assert.equal(init.headers['cf-aig-gateway-id'], 'default');
  const sent = JSON.parse(init.body);
  assert.equal(sent.model, 'xai/grok-4.3');
  assert.equal(sent.reasoning_effort, 'none');
  assert.equal(sent.input, undefined);
  return new Response(JSON.stringify({
    error: { message: 'slow down', type: 'rate_limit_error' },
  }), { status: 429, headers: { 'content-type': 'application/json' } });
}, async () => {
  const response = await handleAiProxy(post({
    model: 'claude-sonnet-4-5',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Hi' }],
  }), {
    AI_BACKEND: 'cloudflare',
    CLOUDFLARE_ACCOUNT_ID: 'acct123',
    CLOUDFLARE_API_TOKEN: 'cf-token',
  }, {
    model: 'claude-sonnet-4-5',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.type, 'error');
  assert.equal(body.error.type, 'rate_limit_error');
  assert.equal(body.error.message, 'slow down');
});

const tokenRequest = post({ model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'Hi' }] }, { 'X-Proxy-Token': 'top-secret' });
assert.equal(presentedProxyToken(tokenRequest), 'top-secret');
assert.equal(isMessagesRequest({ messages: [{ role: 'user', content: 'Hi' }] }), true);
assert.equal(isMessagesRequest({ account_id: 'acct_1' }), false);

const options = await worker.fetch(new Request('https://hostie-hub-ai.example/', { method: 'OPTIONS' }), {});
assert.equal(options.status, 200);
assert.match(options.headers.get('Access-Control-Allow-Headers'), /X-Proxy-Token/);
assert.match(options.headers.get('Access-Control-Allow-Headers'), /X-Service/);

await withFetch(async (url) => {
  assert.equal(url, 'https://api.resend.com/emails');
  return new Response(JSON.stringify({ id: 'email_1' }), { status: 200, headers: { 'content-type': 'application/json' } });
}, async () => {
  const response = await worker.fetch(new Request('https://hostie-hub-ai.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service': 'resend' },
    body: JSON.stringify({ to: 'a@example.com' }),
  }), { RESEND_API_KEY: 're_test', PROXY_TOKEN: 'top-secret', AI_BACKEND: 'cloudflare' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.id, 'email_1');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

await withFetch(async () => {
  throw new Error('non-message bodies must not call a provider');
}, async () => {
  const response = await worker.fetch(new Request('https://hostie-hub-ai.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service': 'stripe-account-status' },
    body: JSON.stringify({ account_id: 'acct_1' }),
  }), {
    ANTHROPIC_API_KEY: 'sk-ant-test',
    PROXY_TOKEN: 'top-secret',
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.type, 'invalid_request_error');
});

let bindingCalls = 0;
await withFetch(async () => {
  throw new Error('fetch should not run when the AI binding handles a messages request');
}, async () => {
  const response = await worker.fetch(post({
    model: 'claude-sonnet-4-5',
    max_tokens: 20,
    messages: [{ role: 'user', content: 'Hi' }],
  }), {
    AI: {
      async run() {
        bindingCalls += 1;
        return completion({ role: 'assistant', content: 'ok' }, 'stop');
      },
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.content[0].text, 'ok');
  assert.equal(body.stop_reason, 'end_turn');
});
assert.equal(bindingCalls, 1);

const src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const aiBranch = src.indexOf('isMessagesRequest(body)');
assert.ok(aiBranch > src.indexOf("service === 'resend'"));
assert.ok(aiBranch > src.indexOf("service === 'stripe-checkout'"));
assert.ok(aiBranch > src.indexOf("service === 'process-refund'"));
assert.ok(aiBranch > src.indexOf("service === 'stripe-host-quantity'"));
assert.equal(src.includes("service === 'partner-request-notify'"), true);
assert.equal(src.includes('https://api.anthropic.com/v1/messages'), false);
const translateSrc = fs.readFileSync(new URL('../ai-translate.js', import.meta.url), 'utf8');
assert.equal(translateSrc.includes("if (value === 'anthropic') return 'anthropic'"), true);
assert.equal(translateSrc.includes('https://api.anthropic.com/v1/messages'), true);
const widgetSrc = fs.readFileSync(new URL('../support-widget.js', import.meta.url), 'utf8');
assert.equal(/claude/i.test(widgetSrc), false);
assert.equal(widgetSrc.includes('xai/grok-4.3'), true);
const assistantSrc = fs.readFileSync(new URL('../api/assistant.js', import.meta.url), 'utf8');
assert.equal(assistantSrc.includes('api.anthropic.com'), false);
assert.equal(assistantSrc.includes('claude-haiku'), false);
assert.equal(assistantSrc.includes('xai/grok-4.3'), true);

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const assistant = require('../api/assistant.js');
const previousProvider = process.env.HOSTIE_LLM_PROVIDER;
const previousKey = process.env.HOSTIE_LLM_API_KEY;
const previousModel = process.env.HOSTIE_LLM_MODEL;
process.env.HOSTIE_LLM_API_KEY = 'feature-flag';
process.env.HOSTIE_LLM_PROVIDER = 'anthropic';
process.env.HOSTIE_LLM_MODEL = 'claude-haiku-4-5-20251001';
await withFetch(async (url, init) => {
  assert.equal(url, 'https://hostie-hub-ai.still-feather-9559.workers.dev');
  assert.equal(String(url).includes('api.anthropic.com'), false);
  const sent = JSON.parse(init.body);
  assert.equal(sent.model, 'xai/grok-4.3');
  assert.equal(sent.max_tokens, 800);
  assert.equal(sent.messages[0].role, 'user');
  return new Response(JSON.stringify({
    content: [{ type: 'text', text: '{"reply":"Try early check-in.","suggestions":[]}' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}, async () => {
  const res = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
  await assistant({ method: 'POST', body: { question: 'early check-in', products: [] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.provider, 'grok');
  assert.match(res.body.reply, /early check-in/i);
});
if (previousProvider == null) delete process.env.HOSTIE_LLM_PROVIDER;
else process.env.HOSTIE_LLM_PROVIDER = previousProvider;
if (previousKey == null) delete process.env.HOSTIE_LLM_API_KEY;
else process.env.HOSTIE_LLM_API_KEY = previousKey;
if (previousModel == null) delete process.env.HOSTIE_LLM_MODEL;
else process.env.HOSTIE_LLM_MODEL = previousModel;

console.log('ai translate checks ok');
