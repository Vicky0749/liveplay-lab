import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HttpError,
  assertAllowedRequest,
  assertJsonContentType,
  buildPrompt,
  corsOrigin,
  normalizeBaseUrl,
  parsePlan,
  parsePort,
  parseTimeout,
  readJsonBody,
  shouldRetryWithoutJsonMode,
} from './lib.mjs';

const root = resolve(import.meta.dirname, '..');

function loadEnv() {
  const file = resolve(root, '.env');
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const divider = line.indexOf('=');
      return [line.slice(0, divider).trim(), line.slice(divider + 1).trim().replace(/^['"]|['"]$/g, '')];
    }));
}

const env = { ...loadEnv(), ...process.env };
const port = parsePort(env.PORT);
const upstreamTimeoutMs = parseTimeout(env.LLM_TIMEOUT_MS);

function send(request, response, status, body) {
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(request.headers.origin),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
  if (status === 204) {
    response.writeHead(status, headers);
    response.end();
    return;
  }
  if (status === 413) {
    // The client may still be streaming a huge body: answer, then drop the connection.
    headers.Connection = 'close';
    response.once('finish', () => request.destroy());
  }
  response.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function callModel({ baseUrl, apiKey, model, brief, template, jsonMode }) {
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(upstreamTimeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.35,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: '你输出严格 JSON。不要声称已经完成真实访谈、平台接入、用户测试或数据验证。' },
        { role: 'user', content: buildPrompt(brief, template) },
      ],
    }),
  });
  let data;
  try {
    data = await upstream.json();
  } catch {
    throw new HttpError(502, `上游模型服务返回了非 JSON 响应（HTTP ${upstream.status}）`);
  }
  const message = typeof data?.error?.message === 'string' ? data.error.message : '';
  return { ok: upstream.ok, status: upstream.status, data, message };
}

async function handleGenerate(request, response) {
  assertAllowedRequest(request.headers);
  assertJsonContentType(request.headers);
  const input = await readJsonBody(request);
  const baseUrl = normalizeBaseUrl(input.config?.baseUrl || env.LLM_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
  const apiKey = String(input.config?.apiKey || env.LLM_API_KEY || env.OPENAI_API_KEY || '').trim();
  const model = String(input.config?.model || env.LLM_MODEL || 'gpt-4.1-mini').trim();
  if (!apiKey) return send(request, response, 400, { error: '未配置 API Key。可在界面本次会话填写，或复制 .env.example 为 .env。' });

  const args = { baseUrl, apiKey, model, brief: input.brief, template: input.template };
  let result = await callModel({ ...args, jsonMode: true });
  if (!result.ok && shouldRetryWithoutJsonMode(result.status, result.message)) {
    result = await callModel({ ...args, jsonMode: false });
  }
  if (!result.ok) return send(request, response, result.status, { error: result.message || '上游模型请求失败' });
  const plan = parsePlan(result.data?.choices?.[0]?.message?.content);
  return send(request, response, 200, { plan });
}

const server = createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url || '/', 'http://localhost');
    if (request.method === 'OPTIONS') return send(request, response, 204);
    if (request.method === 'GET' && pathname === '/api/health') {
      return send(request, response, 200, { ok: true, service: 'liveplay-local-api', configured: Boolean(env.LLM_API_KEY || env.OPENAI_API_KEY) });
    }
    if (request.method === 'POST' && pathname === '/api/generate') return await handleGenerate(request, response);
    return send(request, response, 404, { error: '未找到该接口' });
  } catch (error) {
    if (error instanceof HttpError) return send(request, response, error.status, { error: error.message });
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return send(request, response, 504, { error: `上游模型服务超过 ${Math.round(upstreamTimeoutMs / 1000)} 秒未响应` });
    }
    return send(request, response, 500, { error: error instanceof Error ? error.message : '本机服务异常' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`LivePlay Lab model proxy listening on http://127.0.0.1:${port}`));
