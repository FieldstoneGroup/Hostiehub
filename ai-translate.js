// Translates Anthropic Messages requests into Cloudflare AI Gateway chat
// completions, and the reply back into an Anthropic message.
//
// Grok 4.3's catalog request format is Chat Completions only
// (developers.cloudflare.com/ai/models/xai/grok-4.3/). The Worker calls
// env.AI.run("xai/grok-4.3", input, { gateway }) — the input is the chat
// body, not wrapped in { input }. Without the binding it uses
// POST /accounts/{id}/ai/v1/chat/completions. /ai/v1/messages is Anthropic
// schema and is not the format this model documents.

const SONNET_MODEL = 'xai/grok-4.3';
// No cheaper xAI chat model is in the Cloudflare catalog (27 Nov 2026).
// grok-4.20 and grok-4.5+ cost more. grok-4.3 with reasoning_effort low
// is the production setting: "none" answered "check the card" with no card.
const HAIKU_MODEL = 'xai/grok-4.3';
const DEFAULT_MODEL = 'xai/grok-4.3';
const DEFAULT_GATEWAY = 'default';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export function envString(env, key) {
  if (!env || env[key] == null) return '';
  return String(env[key]).trim();
}

export function isMessagesRequest(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body) && Array.isArray(body.messages);
}

export function aiBackend(env) {
  const value = envString(env, 'AI_BACKEND').toLowerCase();
  // Anthropic is a temporary rollback only. Unset, "cloudflare", and anything
  // else stay on Grok. Luke is closing the Anthropic account.
  if (value === 'anthropic') return 'anthropic';
  return 'cloudflare';
}

export function resolveModel(requested, env) {
  const raw = String(requested || '').trim();
  const name = raw.toLowerCase();
  const sonnet = envString(env, 'AI_MODEL_SONNET') || SONNET_MODEL;
  const haiku = envString(env, 'AI_MODEL_HAIKU') || HAIKU_MODEL;
  const fallback = envString(env, 'AI_MODEL_DEFAULT') || DEFAULT_MODEL;
  if (!name) return fallback;
  if (name.includes('haiku')) return haiku;
  if (name.includes('sonnet') || name.includes('opus')) return sonnet;
  if (name.includes('/')) return raw;
  return fallback;
}

export function reasoningEffortFor(model, env) {
  const id = String(model || '').toLowerCase();
  if (!id.startsWith('xai/')) return undefined;
  const raw = envString(env, 'AI_REASONING_EFFORT').toLowerCase();
  if (raw === 'omit') return undefined;
  if (raw === 'none' || raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  // grok-4.3 accepts this field. grok-4.20 rejects it, so don't send a
  // default there. An explicit AI_REASONING_EFFORT still passes through.
  // Production uses low. none dropped the card from tool-using replies.
  if (id === 'xai/grok-4.3') return 'low';
  return undefined;
}

export function presentedProxyToken(request) {
  const dedicated = request.headers.get('X-Proxy-Token');
  if (dedicated && dedicated.trim()) return dedicated.trim();
  const auth = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  return match ? match[1] : '';
}

export async function secretsMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(provided ?? ''))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(expected ?? ''))),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function anthropicError(type, message) {
  return { type: 'error', error: { type: type || 'api_error', message: clip(message) } };
}

export function corsJson(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: CORS });
}

function clip(value, limit) {
  const text = String(value || '');
  const max = limit || 500;
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function systemToText(system) {
  if (typeof system === 'string') return system;
  if (!Array.isArray(system)) return '';
  return system.map((block) => {
    if (typeof block === 'string') return block;
    if (block && block.type === 'text') return String(block.text || '');
    return '';
  }).filter((part) => part).join('\n\n');
}

function imageToUrl(block) {
  const source = block && block.source ? block.source : {};
  if (source.type === 'base64' && source.data) {
    const data = String(source.data);
    if (data.startsWith('data:')) return data;
    return 'data:' + (source.media_type || 'image/jpeg') + ';base64,' + data;
  }
  if (source.type === 'url' && source.url) return String(source.url);
  if (block && typeof block.url === 'string') return block.url;
  return '';
}

function convertContentPart(block) {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'text') return { type: 'text', text: String(block.text || '') };
  if (block.type === 'image') {
    const url = imageToUrl(block);
    return url ? { type: 'image_url', image_url: { url } } : { type: 'text', text: '(image omitted)' };
  }
  if (block.type === 'tool_result' || block.type === 'tool_use') return null;
  return { type: 'text', text: '(unsupported content block: ' + (block.type || 'unknown') + ')' };
}

function flattenToolResult(block) {
  const content = block.content;
  const texts = [];
  const images = [];
  const parts = Array.isArray(content) ? content : (content == null ? [] : [content]);
  if (typeof content === 'string') {
    texts.push(content);
  } else {
    for (const part of parts) {
      if (typeof part === 'string') texts.push(part);
      else if (part && part.type === 'text') texts.push(String(part.text || ''));
      else if (part && part.type === 'image') {
        const url = imageToUrl(part);
        if (url) images.push(url);
      } else if (part != null && typeof part !== 'object') texts.push(String(part));
      else if (part && typeof part === 'object') texts.push(JSON.stringify(part));
    }
  }
  let text = texts.join('\n');
  if (block.is_error) text = text ? '[tool error] ' + text : '[tool error]';
  else if (!text) text = '(empty tool result)';
  return { text, images };
}

function convertUserMessage(message) {
  if (typeof message.content === 'string' || message.content == null) {
    return [{ role: 'user', content: message.content == null ? '' : String(message.content) }];
  }
  if (!Array.isArray(message.content)) {
    return [{ role: 'user', content: systemToText(message.content) }];
  }
  const toolMessages = [];
  const parts = [];
  for (const block of message.content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'tool_result') {
      const flat = flattenToolResult(block);
      toolMessages.push({
        role: 'tool',
        tool_call_id: String(block.tool_use_id || ''),
        content: flat.text,
      });
      if (flat.images.length) {
        parts.push({ type: 'text', text: 'Image from tool result ' + String(block.tool_use_id || '') });
        for (const url of flat.images) parts.push({ type: 'image_url', image_url: { url } });
      }
      continue;
    }
    const part = convertContentPart(block);
    if (part) parts.push(part);
  }
  const out = toolMessages.slice();
  if (parts.length) {
    const textOnly = parts.every((part) => part.type === 'text');
    out.push({
      role: 'user',
      content: textOnly ? parts.map((part) => part.text).join('') : parts,
    });
  }
  return out;
}

function convertAssistantMessage(message) {
  if (typeof message.content === 'string' || message.content == null) {
    return { role: 'assistant', content: message.content == null ? '' : String(message.content) };
  }
  if (!Array.isArray(message.content)) {
    return { role: 'assistant', content: systemToText(message.content) };
  }
  const texts = [];
  const toolCalls = [];
  for (const block of message.content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text') texts.push(String(block.text || ''));
    else if (block.type === 'tool_use') {
      const args = typeof block.input === 'string' ? block.input : JSON.stringify(block.input == null ? {} : block.input);
      toolCalls.push({
        id: String(block.id || ('toolu_' + toolCalls.length)),
        type: 'function',
        function: { name: String(block.name || ''), arguments: args },
      });
    }
  }
  const text = texts.join('');
  const msg = { role: 'assistant', content: toolCalls.length ? (text || null) : text };
  if (toolCalls.length) msg.tool_calls = toolCalls;
  return msg;
}

function convertTool(tool) {
  if (tool && tool.type === 'function' && tool.function) return tool;
  const parameters = tool && tool.input_schema && typeof tool.input_schema === 'object'
    ? tool.input_schema
    : { type: 'object', properties: {} };
  const fn = { name: String((tool && tool.name) || ''), parameters };
  if (tool && typeof tool.description === 'string') fn.description = tool.description;
  return { type: 'function', function: fn };
}

function convertToolChoice(choice) {
  if (!choice) return {};
  const parallel = choice && choice.disable_parallel_tool_use === true ? { parallel_tool_calls: false } : {};
  if (typeof choice === 'string') {
    if (choice === 'auto' || choice === 'none' || choice === 'required') return Object.assign({ tool_choice: choice }, parallel);
    return parallel;
  }
  if (choice.type === 'any') return Object.assign({ tool_choice: 'required' }, parallel);
  if (choice.type === 'none') return Object.assign({ tool_choice: 'none' }, parallel);
  if (choice.type === 'tool' && choice.name) {
    return Object.assign({ tool_choice: { type: 'function', function: { name: choice.name } } }, parallel);
  }
  if (choice.type === 'auto') return Object.assign({ tool_choice: 'auto' }, parallel);
  return parallel;
}

export function anthropicToChat(body, env) {
  if (!isMessagesRequest(body)) {
    return { status: 400, error: anthropicError('invalid_request_error', 'messages must be a non-empty array.') };
  }
  if (!body.messages.length) {
    return { status: 400, error: anthropicError('invalid_request_error', 'messages must be a non-empty array.') };
  }
  if (body.stream === true || body.stream === 'true') {
    return {
      status: 400,
      error: anthropicError('invalid_request_error', 'stream: true is not supported on the Cloudflare backend. No caller in this repo streams.'),
    };
  }

  const model = resolveModel(body.model, env);
  const systemTexts = [];
  const system = systemToText(body.system);
  if (system) systemTexts.push(system);
  const messages = [];

  for (let i = 0; i < body.messages.length; i++) {
    const message = body.messages[i];
    if (!message || typeof message !== 'object') {
      return { status: 400, error: anthropicError('invalid_request_error', 'Message ' + i + ' is not an object.') };
    }
    if (message.role === 'system') {
      const text = typeof message.content === 'string' ? message.content : systemToText(message.content);
      if (text) systemTexts.push(text);
      continue;
    }
    if (message.role === 'assistant') {
      messages.push(convertAssistantMessage(message));
      continue;
    }
    if (message.role === 'user') {
      const converted = convertUserMessage(message);
      for (const item of converted) messages.push(item);
      continue;
    }
    return { status: 400, error: anthropicError('invalid_request_error', 'Unsupported message role "' + message.role + '".') };
  }

  if (systemTexts.length) messages.unshift({ role: 'system', content: systemTexts.join('\n\n') });
  if (!messages.some((message) => message.role !== 'system')) {
    return { status: 400, error: anthropicError('invalid_request_error', 'The conversation has no user or assistant messages.') };
  }

  const input = { messages };
  if (typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)) input.max_tokens = body.max_tokens;
  if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) input.temperature = body.temperature;
  if (typeof body.top_p === 'number' && Number.isFinite(body.top_p)) input.top_p = body.top_p;
  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length) input.stop = body.stop_sequences;
  if (Array.isArray(body.tools) && body.tools.length) {
    input.tools = body.tools.map(convertTool);
    const choice = convertToolChoice(body.tool_choice);
    if (choice.tool_choice !== undefined) input.tool_choice = choice.tool_choice;
    if (choice.parallel_tool_calls !== undefined) input.parallel_tool_calls = choice.parallel_tool_calls;
  }
  const effort = reasoningEffortFor(model, env);
  if (effort) input.reasoning_effort = effort;
  return { model, input };
}

function parseToolArguments(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return { value: parsed };
  } catch (err) {
    return { _unparsed: raw };
  }
}

export function unknownModelFailure(status, message) {
  const text = String(message || '');
  if (status === 404) return true;
  return /model not found|unknown model|unrecognized model|no such model|invalid model/i.test(text);
}

function asClientFailure(status, type, message) {
  if (unknownModelFailure(status, message)) {
    return { status: 400, type: 'invalid_request_error', message };
  }
  return { status, type, message };
}

function mapErrorType(status, upstreamType) {
  const known = ['invalid_request_error', 'authentication_error', 'permission_error', 'not_found_error', 'rate_limit_error', 'api_error', 'overloaded_error'];
  if (known.indexOf(upstreamType) !== -1) return upstreamType;
  if (status === 400 || status === 404 || status === 413 || status === 422) return 'invalid_request_error';
  if (status === 401 || status === 403) return 'authentication_error';
  if (status === 429) return 'rate_limit_error';
  if (status === 503 || status === 529) return 'overloaded_error';
  return 'api_error';
}

function unwrapCompletion(data) {
  if (data && data.choices) return data;
  if (data && data.result && data.result.choices) return data.result;
  return data;
}

export function providerFailure(data, httpStatus) {
  const status = httpStatus || 0;
  if (!data || typeof data !== 'object') {
    return { status: status >= 400 ? status : 502, type: 'api_error', message: 'The model returned an empty response.' };
  }
  if (data.choices || (data.result && data.result.choices)) return null;
  if (data.error) {
    const message = typeof data.error === 'string' ? data.error : (data.error.message || 'Model request failed.');
    const type = mapErrorType(status, data.error.type);
    return asClientFailure(status >= 400 ? status : 502, type, message);
  }
  if (data.success === false || (Array.isArray(data.errors) && data.errors.length)) {
    const first = (data.errors && data.errors[0]) || {};
    const message = first.message || 'Cloudflare AI request failed.';
    let mapped = status >= 400 ? status : 502;
    if (Number(first.code) === 10000) mapped = 401;
    return asClientFailure(mapped, mapErrorType(mapped), message);
  }
  if (status >= 400) {
    const message = data.message || 'Model request failed.';
    return asClientFailure(status, mapErrorType(status), message);
  }
  return { status: 502, type: 'api_error', message: 'The model response had no choices.' };
}

export function chatCompletionToAnthropic(completion, requestedModel) {
  const data = unwrapCompletion(completion);
  const failure = providerFailure(data, 200);
  if (failure && !(data && data.choices)) {
    return { status: failure.status, body: anthropicError(failure.type, failure.message) };
  }
  const choice = data.choices[0];
  if (!choice) return { status: 502, body: anthropicError('api_error', 'The model response had no choices.') };
  const message = choice.message || {};
  const content = [];
  if (typeof message.content === 'string') {
    if (message.content) content.push({ type: 'text', text: message.content });
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (typeof part === 'string') {
        if (part) content.push({ type: 'text', text: part });
      } else if (part && part.type === 'text' && part.text) {
        content.push({ type: 'text', text: String(part.text) });
      }
    }
  }
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i] || {};
    const fn = call.function || {};
    content.push({
      type: 'tool_use',
      id: call.id ? String(call.id) : 'toolu_' + i,
      name: String(fn.name || ''),
      input: parseToolArguments(fn.arguments),
    });
  }
  if (!content.length) content.push({ type: 'text', text: message.refusal ? String(message.refusal) : '' });

  let stopReason = 'end_turn';
  if (choice.finish_reason === 'length') stopReason = 'max_tokens';
  else if (choice.finish_reason === 'tool_calls' || toolCalls.length) stopReason = 'tool_use';

  const usageIn = data.usage || {};
  const usage = {
    input_tokens: Number.isFinite(Number(usageIn.prompt_tokens)) ? Number(usageIn.prompt_tokens) : 0,
    output_tokens: Number.isFinite(Number(usageIn.completion_tokens)) ? Number(usageIn.completion_tokens) : 0,
  };
  const cached = usageIn.prompt_tokens_details && usageIn.prompt_tokens_details.cached_tokens;
  if (Number.isFinite(Number(cached))) usage.cache_read_input_tokens = Number(cached);

  return {
    status: 200,
    body: {
      id: data.id || ('msg_' + crypto.randomUUID()),
      type: 'message',
      role: 'assistant',
      model: data.model || requestedModel || '',
      content,
      stop_reason: stopReason,
      stop_sequence: null,
      usage,
    },
  };
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (err) { return { message: clip(text, 300) }; }
}

export async function callCloudflareModel(env, model, input) {
  const gatewayId = envString(env, 'AI_GATEWAY_ID') || DEFAULT_GATEWAY;
  if (env && env.AI && typeof env.AI.run === 'function') {
    const result = await env.AI.run(model, input, { gateway: { id: gatewayId } });
    if (result && typeof result.json === 'function' && typeof result.status === 'number' && typeof result.ok === 'boolean') {
      const data = await result.json().catch(() => null);
      return { ok: result.ok, status: result.status, data };
    }
    return { ok: true, status: 200, data: result };
  }
  const accountId = envString(env, 'CLOUDFLARE_ACCOUNT_ID');
  const token = envString(env, 'CLOUDFLARE_API_TOKEN');
  if (!accountId || !token) {
    return {
      ok: false,
      status: 500,
      data: anthropicError('api_error', 'Cloudflare AI is not configured. Add an AI binding named AI, or set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.'),
    };
  }
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId) + '/ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'cf-aig-gateway-id': gatewayId,
    },
    body: JSON.stringify(Object.assign({ model }, input)),
  });
  const data = await readJson(res);
  return { ok: res.ok, status: res.status, data };
}

async function authorizeProxy(request, env) {
  const secret = envString(env, 'PROXY_TOKEN');
  if (!secret) return { ok: true };
  // Service bindings from livestayguide-app do not set CF-Worker, so a
  // worker-name allow list cannot exempt them. When the secret is set,
  // every caller sends X-Proxy-Token. Leave PROXY_TOKEN unset until they do.
  const presented = presentedProxyToken(request);
  if (presented && await secretsMatch(presented, secret)) return { ok: true };
  return { ok: false };
}

function logProxy(fields) {
  console.log(JSON.stringify(Object.assign({ msg: 'ai_proxy' }, fields)));
}

async function forwardAnthropic(env, body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = anthropicError('api_error', 'Anthropic returned a non-JSON response.');
  }
  // The previous relay always answered HTTP 200 and let the Anthropic JSON
  // through, including error bodies. Keep that so rollback matches.
  return corsJson(data, 200);
}

export async function handleAiProxy(request, env, body) {
  try {
    const backend = aiBackend(env);
    const auth = await authorizeProxy(request, env);
    if (!auth.ok) {
      logProxy({ backend, auth: 'rejected' });
      return corsJson(anthropicError('authentication_error', 'Proxy token missing or incorrect.'), 401);
    }
    if (backend !== 'cloudflare') {
      const response = await forwardAnthropic(env, body);
      logProxy({ backend: 'anthropic', requested_model: body && body.model, status: 200 });
      return response;
    }

    const translated = anthropicToChat(body, env || {});
    if (translated.error) return corsJson(translated.error, translated.status || 400);
    let called;
    try {
      called = await callCloudflareModel(env, translated.model, translated.input);
    } catch (err) {
      const message = err && err.message ? err.message : 'The model request failed.';
      const unknown = unknownModelFailure(0, message);
      logProxy({ backend: 'cloudflare', model: translated.model, status: unknown ? 400 : 502, error: clip(message) });
      return corsJson(
        anthropicError(unknown ? 'invalid_request_error' : 'api_error', message),
        unknown ? 400 : 502
      );
    }
    if (!called.ok) {
      if (called.data && called.data.type === 'error' && called.data.error) {
        logProxy({ backend: 'cloudflare', model: translated.model, status: called.status || 500, error: clip(called.data.error.message) });
        return corsJson(called.data, called.status || 500);
      }
      const failure = providerFailure(called.data, called.status) || {
        status: called.status || 502,
        type: 'api_error',
        message: 'The model request failed.',
      };
      logProxy({ backend: 'cloudflare', model: translated.model, status: failure.status, error: clip(failure.message) });
      return corsJson(anthropicError(failure.type, failure.message), failure.status);
    }
    const anthropic = chatCompletionToAnthropic(called.data, translated.model);
    const usage = anthropic.body && anthropic.body.usage;
    logProxy({
      backend: 'cloudflare',
      requested_model: body && body.model,
      model: translated.model,
      status: anthropic.status,
      stop_reason: anthropic.body && anthropic.body.stop_reason,
      input_tokens: usage && usage.input_tokens,
      output_tokens: usage && usage.output_tokens,
    });
    return corsJson(anthropic.body, anthropic.status);
  } catch (err) {
    console.error(JSON.stringify({ msg: 'ai_proxy_crash', error: clip(err && err.message) }));
    return corsJson(anthropicError('api_error', 'The AI proxy failed before it could complete the request.'), 500);
  }
}
