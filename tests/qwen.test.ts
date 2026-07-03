import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const importQwen = () => import('../dist/qwen.js');

describe('qwen balance', () => {
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
    tmpHome = mkdtempSync(join(tmpdir(), 'qwen-test-'));
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

  // ─── Isolation — non-Qwen backends ────────────────────────────

  describe('isolation — non-Qwen backends', () => {
    it('returns null when ANTHROPIC_BASE_URL is unset', async () => {
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('returns null when ANTHROPIC_BASE_URL is Anthropic', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('returns null when ANTHROPIC_BASE_URL is DeepSeek', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('does not call fetch for non-Qwen backends', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
      const { getQwenBalance } = await importQwen();
      await getQwenBalance();
      assert.equal(fetchCalls.length, 0, 'should not fetch for non-Qwen');
    });

    it('returns null when Qwen env set but no auth token', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/anthropic';
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });
  });

  // ─── Response parsing ─────────────────────────────────────────

  describe('response parsing', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('extracts balance from top-level field', async () => {
      nextResponse = new Response(JSON.stringify({ balance: 88.5 }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), '¥88.50');
    });

    it('extracts balance from data.balance', async () => {
      nextResponse = new Response(JSON.stringify({ data: { balance: 12.34 } }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), '¥12.34');
    });

    it('extracts remainingBalance', async () => {
      nextResponse = new Response(JSON.stringify({ remainingBalance: 45.67 }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), '¥45.67');
    });

    it('extracts remaining_balance from data', async () => {
      nextResponse = new Response(JSON.stringify({ data: { remaining_balance: 99.99 } }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), '¥99.99');
    });

    it('returns null for empty response', async () => {
      nextResponse = new Response('{}', { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('handles string balance with ¥ prefix', async () => {
      nextResponse = new Response(JSON.stringify({ balance: '¥100.00' }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), '¥100.00');
    });

    it('handles string balance without ¥ prefix', async () => {
      nextResponse = new Response(JSON.stringify({ balance: '50.25' }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), '¥50.25');
    });
  });

  // ─── Error resilience ─────────────────────────────────────────

  describe('error resilience', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('returns null on 401 response', async () => {
      nextResponse = new Response('unauthorized', { status: 401 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('returns null on 500 response', async () => {
      nextResponse = new Response('server error', { status: 500 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('returns null on network error', async () => {
      nextError = new Error('ECONNREFUSED');
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });

    it('returns null on malformed JSON', async () => {
      nextResponse = new Response('not json{', { status: 200 });
      const { getQwenBalance } = await importQwen();
      assert.equal(await getQwenBalance(), null);
    });
  });

  // ─── Cache ────────────────────────────────────────────────────

  describe('cache', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('caches successful response for 5 minutes', async () => {
      nextResponse = new Response(JSON.stringify({ balance: 100 }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      const r1 = await getQwenBalance();
      const r2 = await getQwenBalance();
      assert.equal(fetchCalls.length, 1, 'second call should hit cache');
      assert.equal(r1, r2);
    });

    it('falls back to stale cache on fetch failure', async () => {
      // First call: succeed → write cache
      nextResponse = new Response(JSON.stringify({ balance: 50.5 }), { status: 200 });
      const { getQwenBalance } = await importQwen();
      const r1 = await getQwenBalance();
      // Make cache stale (10 min old)
      const cachePath = join(tmpHome, '.cache', 'cc-hud', 'qwen-balance.json');
      const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
      cached.ts = Date.now() - 10 * 60 * 1000;
      writeFileSync(cachePath, JSON.stringify(cached));
      // Second call: fetch fails
      nextError = new Error('network down');
      const r2 = await getQwenBalance();
      assert.equal(r2, r1, 'should return stale cache on fetch failure');
    });
  });
});
