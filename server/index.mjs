import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const port = Number(env.PORT || 8788);

function trustedOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '') ? origin : 'http://localhost:5173';
}

function send(request, response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': trustedOrigin(request.headers.origin),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  response.end(JSON.stringify(body));
}

function getRequestBody(request) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('请求体过大'));
    });
    request.on('end', () => {
      try { resolveBody(JSON.parse(raw || '{}')); } catch { reject(new Error('请求不是有效 JSON')); }
    });
    request.on('error', reject);
  });
}

function normalizeBaseUrl(value) {
  const baseUrl = (value || '').trim().replace(/\/+$/, '');
  const parsed = new URL(baseUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Base URL 必须以 http:// 或 https:// 开头');
  return baseUrl;
}

function parsePlan(content) {
  const text = String(content || '').trim().replace(/^```json\s*|^```|```$/gm, '').trim();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('模型未返回 JSON 对象');
  return parsed;
}

function buildPrompt(brief, template) {
  return `你是 AI 轻应用产品经理。基于以下直播互动 Brief 设计一个可实现、可评测的浏览器微应用方案。

主题：${brief?.theme || ''}
目标：${brief?.objective || ''}
观众：${brief?.audience || ''}
时长：${brief?.duration || ''}
资源与边界：${brief?.constraints || ''}
推荐模板：${template?.name || ''}
模板规则：${(template?.rules || []).join('；')}

严格要求：不暗示接入任何真实直播平台，不编造用户研究、线上指标或测试结果；遵守边界；方案必须可在浏览器中演示。
只输出 JSON，不要 Markdown：
{"title":"","summary":"","rules":[""],"hostScript":"","visualPrompt":"","riskNotes":[""],"codeBrief":""}`;
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(request, response, 204, {});
  if (request.method === 'GET' && request.url === '/api/health') {
    return send(request, response, 200, { ok: true, service: 'liveplay-local-api', configured: Boolean(env.LLM_API_KEY || env.OPENAI_API_KEY) });
  }
  if (request.method !== 'POST' || request.url !== '/api/generate') return send(request, response, 404, { error: '未找到该接口' });
  try {
    const input = await getRequestBody(request);
    const baseUrl = normalizeBaseUrl(input.config?.baseUrl || env.LLM_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
    const apiKey = String(input.config?.apiKey || env.LLM_API_KEY || env.OPENAI_API_KEY || '').trim();
    const model = String(input.config?.model || env.LLM_MODEL || 'gpt-4.1-mini').trim();
    if (!apiKey) return send(request, response, 400, { error: '未配置 API Key。可在界面本次会话填写，或复制 .env.example 为 .env。' });

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你输出严格 JSON。不要声称已经完成真实访谈、平台接入、用户测试或数据验证。' },
          { role: 'user', content: buildPrompt(input.brief, input.template) },
        ],
      }),
    });
    const responseData = await upstream.json();
    if (!upstream.ok) return send(request, response, upstream.status, { error: responseData?.error?.message || '上游模型请求失败' });
    const plan = parsePlan(responseData?.choices?.[0]?.message?.content);
    return send(request, response, 200, { plan });
  } catch (error) {
    return send(request, response, 500, { error: error instanceof Error ? error.message : '本机服务异常' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`LivePlay Lab model proxy listening on http://127.0.0.1:${port}`));
