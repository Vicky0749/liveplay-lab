// Pure helpers for the local model proxy. Kept free of side effects (no listen,
// no env access) so they can be unit-tested.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** True when the origin is a local dev page (any port on localhost / 127.0.0.1). */
export function isTrustedOrigin(origin) {
  return LOCAL_ORIGIN.test(origin || '');
}

/** Origin to echo back in CORS headers; falls back to the default Vite address. */
export function corsOrigin(origin) {
  return isTrustedOrigin(origin) ? origin : 'http://localhost:5173';
}

/**
 * Browsers always attach an Origin header to cross-site POSTs. A page on any
 * other origin must not be able to trigger a generation (which spends the
 * API key stored in .env), so a present-but-untrusted Origin is rejected.
 * Requests without an Origin (curl, server-to-server) are allowed.
 */
export function assertAllowedRequest(headers) {
  const origin = headers.origin;
  if (origin !== undefined && !isTrustedOrigin(origin)) {
    throw new HttpError(403, '不允许的请求来源');
  }
}

export function assertJsonContentType(headers) {
  const type = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, '请求必须使用 Content-Type: application/json');
}

/** Read and parse a JSON body, enforcing a byte limit while streaming. */
export function readJsonBody(request, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const fail = (error) => {
      if (done) return;
      done = true;
      reject(error);
    };
    request.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limitBytes) {
        // Stop buffering; the caller sends the 413 and then closes the connection.
        fail(new HttpError(413, '请求体过大'));
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (done) return;
      done = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        const parsed = JSON.parse(raw || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        resolve(parsed);
      } catch {
        reject(new HttpError(400, '请求不是有效 JSON 对象'));
      }
    });
    request.on('error', (error) => fail(error));
  });
}

export function normalizeBaseUrl(value) {
  const baseUrl = String(value || '').trim().replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new HttpError(400, 'Base URL 不是有效的网址');
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new HttpError(400, 'Base URL 必须以 http:// 或 https:// 开头');
  return baseUrl;
}

/** Extract a JSON object from model output, tolerating Markdown code fences. */
export function parsePlan(content) {
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, '模型返回的内容不是有效 JSON，请换用支持 JSON 输出的模型');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(502, '模型未返回 JSON 对象');
  return parsed;
}

/** Some OpenAI-compatible endpoints reject response_format; detect that case. */
export function shouldRetryWithoutJsonMode(status, message) {
  return (status === 400 || status === 422) && /response_format|json_object|json mode|json_schema/i.test(String(message || ''));
}

export function parsePort(value, fallback = 8788) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

export function parseTimeout(value, fallback = 60_000) {
  const ms = Number(value);
  return Number.isFinite(ms) && ms >= 1_000 ? ms : fallback;
}

export function buildPrompt(brief, template) {
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
