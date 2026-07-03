import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const importGroq = () => import('../dist/groq.js');

describe('groq usage', () => {
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const originalFetch = globalThis.fetch;

  let tmpHome: string;
  let fetchCalls: { url: string; init: RequestInit | undefined }[];
  let nextResponse: Response;
  let nextError: unknown;

  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    tmpHome = mkdtempSync(join(tmpdir(), 'groq-test-'));
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    fetchCalls = [];
    nextResponse = new Response('{}', { status: 200 });
    nextError = undefined;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      if (nextError) throw nextError;
      return nextResponse;
    }) as typeof fetch;
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL;
    else process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN;
    else process.env.ANTHROPIC_AUTH_TOKEN = originalToken;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    globalThis.fetch = originalFetch;
    rmSync(tmpHome, { recursive: true, force: true });
  });

  // ─── Isolation — non-Groq backends ───────────────────────────

  describe('isolation — non-Groq backends', () => {
    it('returns null when ANTHROPIC_BASE_URL is unset', async () => {
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });

    it('returns null when ANTHROPIC_BASE_URL is Anthropic', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });

    it('returns null when ANTHROPIC_BASE_URL is DeepSeek', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });

    it('does not call fetch for non-Groq backends', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
      const { getGroqUsage } = await importGroq();
      await getGroqUsage();
      assert.equal(fetchCalls.length, 0);
    });

    it('returns null when Groq env set but no auth token', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.groq.com/anthropic';
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });
  });

  // ─── Response parsing ───────────────────────────────────────

  describe('response parsing', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.groq.com/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('extracts remaining_requests', async () => {
      nextResponse = new Response(JSON.stringify({ remaining_requests: 9500 }), { status: 200 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), '9500');
    });

    it('extracts remaining_tokens', async () => {
      nextResponse = new Response(JSON.stringify({ remaining_tokens: 500000 }), { status: 200 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), '500000');
    });

    it('extracts quota_remaining from data', async () => {
      nextResponse = new Response(JSON.stringify({ data: { quota_remaining: '80%' } }), { status: 200 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), '80%');
    });

    it('extracts usage string directly', async () => {
      nextResponse = new Response(JSON.stringify({ usage: '7200 RPM remaining' }), { status: 200 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), '7200 RPM remaining');
    });

    it('returns null for empty response', async () => {
      nextResponse = new Response('{}', { status: 200 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });
  });

  // ─── Error resilience ───────────────────────────────────────

  describe('error resilience', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.groq.com/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('returns null on 401 response', async () => {
      nextResponse = new Response('unauthorized', { status: 401 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });

    it('returns null on 500 response', async () => {
      nextResponse = new Response('server error', { status: 500 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });

    it('returns null on network error', async () => {
      nextError = new Error('ECONNREFUSED');
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });

    it('returns null on malformed JSON', async () => {
      nextResponse = new Response('not json{', { status: 200 });
      const { getGroqUsage } = await importGroq();
      assert.equal(await getGroqUsage(), null);
    });
  });

  // ─── Cache ──────────────────────────────────────────────────

  describe('cache', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.groq.com/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('caches successful response for 5 minutes', async () => {
      nextResponse = new Response(JSON.stringify({ remaining_requests: 10000 }), { status: 200 });
      const { getGroqUsage } = await importGroq();
      const r1 = await getGroqUsage();
      const r2 = await getGroqUsage();
      assert.equal(fetchCalls.length, 1, 'second call should hit cache');
      assert.equal(r1, r2);
    });

    it('falls back to stale cache on fetch failure', async () => {
      nextResponse = new Response(JSON.stringify({ remaining_requests: 8000 }), { status: 200 });
      const { getGroqUsage } = await importGroq();
      const r1 = await getGroqUsage();
      const cachePath = join(tmpHome, '.cache', 'cc-hud', 'groq-usage.json');
      const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
      cached.ts = Date.now() - 10 * 60 * 1000;
      writeFileSync(cachePath, JSON.stringify(cached));
      nextError = new Error('network down');
      const r2 = await getGroqUsage();
      assert.equal(r2, r1, 'should return stale cache on fetch failure');
    });
  });
});
