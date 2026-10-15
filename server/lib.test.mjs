import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  HttpError,
  assertAllowedRequest,
  assertJsonContentType,
  buildPrompt,
  corsOrigin,
  isTrustedOrigin,
  normalizeBaseUrl,
  parsePlan,
  parsePort,
  parseTimeout,
  readJsonBody,
  shouldRetryWithoutJsonMode,
} from './lib.mjs';

const stream = (...parts) => Readable.from(parts.map((part) => Buffer.from(part)));

describe('origin and request guards', () => {
  it('trusts only local development origins', () => {
    expect(isTrustedOrigin('http://localhost:5173')).toBe(true);
    expect(isTrustedOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(isTrustedOrigin('https://evil.example')).toBe(false);
    expect(isTrustedOrigin('http://localhost.evil.example:5173')).toBe(false);
    expect(isTrustedOrigin('http://localhost')).toBe(false);
    expect(isTrustedOrigin(undefined)).toBe(false);
  });

  it('echoes a trusted origin and falls back to the Vite default otherwise', () => {
    expect(corsOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(corsOrigin('https://evil.example')).toBe('http://localhost:5173');
  });

  it('rejects cross-site browser requests but allows requests without an Origin', () => {
    expect(() => assertAllowedRequest({ origin: 'https://evil.example' })).toThrow(HttpError);
    expect(() => assertAllowedRequest({ origin: 'null' })).toThrow(HttpError);
    expect(() => assertAllowedRequest({ origin: 'http://localhost:5173' })).not.toThrow();
    expect(() => assertAllowedRequest({})).not.toThrow();
  });

  it('requires a JSON content type so simple cross-site POSTs are refused', () => {
    expect(() => assertJsonContentType({ 'content-type': 'application/json; charset=utf-8' })).not.toThrow();
    expect(() => assertJsonContentType({ 'content-type': 'text/plain' })).toThrow(HttpError);
    expect(() => assertJsonContentType({})).toThrow(HttpError);
  });
});

describe('readJsonBody', () => {
  it('parses a JSON object split across chunks', async () => {
    await expect(readJsonBody(stream('{"a":', '1}'))).resolves.toEqual({ a: 1 });
  });

  it('treats an empty body as an empty object', async () => {
    await expect(readJsonBody(stream())).resolves.toEqual({});
  });

  it('rejects invalid JSON and non-object JSON with 400', async () => {
    await expect(readJsonBody(stream('{oops'))).rejects.toMatchObject({ status: 400 });
    await expect(readJsonBody(stream('[1,2]'))).rejects.toMatchObject({ status: 400 });
    await expect(readJsonBody(stream('"text"'))).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an oversized body with 413 based on bytes, not characters', async () => {
    await expect(readJsonBody(stream('{"a":"', 'x'.repeat(50), '"}'), 20)).rejects.toMatchObject({ status: 413 });
    // 10 CJK characters are 30 bytes in UTF-8.
    await expect(readJsonBody(stream('{"a":"', '汉字汉字汉字汉字汉字', '"}'), 30)).rejects.toMatchObject({ status: 413 });
  });
});

describe('normalizeBaseUrl', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl(' https://api.example.com/v1/// ')).toBe('https://api.example.com/v1');
  });

  it('reports invalid and non-http URLs as 400 instead of crashing', () => {
    expect(() => normalizeBaseUrl('not a url')).toThrow(HttpError);
    expect(() => normalizeBaseUrl('')).toThrow(HttpError);
    expect(() => normalizeBaseUrl('ftp://example.com')).toThrow(HttpError);
  });
});

describe('parsePlan', () => {
  it('parses plain JSON', () => {
    expect(parsePlan('{"title":"A"}')).toEqual({ title: 'A' });
  });

  it('strips Markdown code fences, with or without a language tag', () => {
    expect(parsePlan('```json\n{"title":"A"}\n```')).toEqual({ title: 'A' });
    expect(parsePlan('```\n{"title":"A"}\n```')).toEqual({ title: 'A' });
    expect(parsePlan('```JSON {"title":"A"} ```')).toEqual({ title: 'A' });
  });

  it('turns unusable model output into a readable 502', () => {
    expect(() => parsePlan('抱歉，我无法完成')).toThrow(HttpError);
    expect(() => parsePlan('')).toThrow(HttpError);
    expect(() => parsePlan('[1]')).toThrow(HttpError);
    expect(() => parsePlan('null')).toThrow(HttpError);
  });
});

describe('shouldRetryWithoutJsonMode', () => {
  it('retries only for 400/422 responses that complain about JSON mode', () => {
    expect(shouldRetryWithoutJsonMode(400, "Unknown parameter: 'response_format'")).toBe(true);
    expect(shouldRetryWithoutJsonMode(422, 'json_object is not supported')).toBe(true);
    expect(shouldRetryWithoutJsonMode(400, 'model not found')).toBe(false);
    expect(shouldRetryWithoutJsonMode(401, 'response_format')).toBe(false);
    expect(shouldRetryWithoutJsonMode(400, undefined)).toBe(false);
  });
});

describe('config parsing', () => {
  it('falls back to defaults for invalid ports and timeouts', () => {
    expect(parsePort('9000')).toBe(9000);
    expect(parsePort('abc')).toBe(8788);
    expect(parsePort('70000')).toBe(8788);
    expect(parsePort(undefined)).toBe(8788);
    expect(parseTimeout('5000')).toBe(5000);
    expect(parseTimeout('10')).toBe(60_000);
    expect(parseTimeout(undefined)).toBe(60_000);
  });
});

describe('buildPrompt', () => {
  it('includes the brief and template rules and survives missing input', () => {
    const prompt = buildPrompt({ theme: '迎新夜', objective: '破冰' }, { name: '任务接力赛', rules: ['规则一', '规则二'] });
    expect(prompt).toContain('主题：迎新夜');
    expect(prompt).toContain('规则一；规则二');
    expect(() => buildPrompt(undefined, undefined)).not.toThrow();
  });
});
