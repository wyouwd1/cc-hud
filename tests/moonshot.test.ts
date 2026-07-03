import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const importMoonshot = () => import('../dist/moonshot.js');

describe('moonshot balance', () => {
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
    tmpHome = mkdtempSync(join(tmpdir(), 'ms-test-'));
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

  // ─── Isolation — non-Moonshot backends ──────────────────────

  describe('isolation — non-Moonshot backends', () => {
    it('returns null when ANTHROPIC_BASE_URL is unset', async () => {
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('returns null when ANTHROPIC_BASE_URL is Anthropic', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('returns null when ANTHROPIC_BASE_URL is DeepSeek', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('does not call fetch for non-Moonshot backends', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
      const { getMoonshotBalance } = await importMoonshot();
      await getMoonshotBalance();
      assert.equal(fetchCalls.length, 0);
    });

    it('returns null when Moonshot env set but no auth token', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.moonshot.cn/anthropic';
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });
  });

  // ─── Response parsing ───────────────────────────────────────

  describe('response parsing', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.moonshot.cn/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('extracts balance from top-level field', async () => {
      nextResponse = new Response(JSON.stringify({ balance: 66.6 }), { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), '¥66.60');
    });

    it('extracts total_balance from top-level', async () => {
      nextResponse = new Response(JSON.stringify({ total_balance: 100 }), { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), '¥100.00');
    });

    it('extracts balance from data.balance', async () => {
      nextResponse = new Response(JSON.stringify({ data: { balance: 42.5 } }), { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), '¥42.50');
    });

    it('returns null for empty response', async () => {
      nextResponse = new Response('{}', { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('handles string balance with ¥ prefix', async () => {
      nextResponse = new Response(JSON.stringify({ balance: '¥99.99' }), { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), '¥99.99');
    });
  });

  // ─── Error resilience ───────────────────────────────────────

  describe('error resilience', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.moonshot.cn/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('returns null on 401 response', async () => {
      nextResponse = new Response('unauthorized', { status: 401 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('returns null on 500 response', async () => {
      nextResponse = new Response('server error', { status: 500 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('returns null on network error', async () => {
      nextError = new Error('ECONNREFUSED');
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });

    it('returns null on malformed JSON', async () => {
      nextResponse = new Response('not json{', { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      assert.equal(await getMoonshotBalance(), null);
    });
  });

  // ─── Cache ──────────────────────────────────────────────────

  describe('cache', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.moonshot.cn/anthropic';
      process.env.ANTHROPIC_AUTH_TOKEN = 'sk-test';
    });

    it('caches successful response for 5 minutes', async () => {
      nextResponse = new Response(JSON.stringify({ balance: 50 }), { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      const r1 = await getMoonshotBalance();
      const r2 = await getMoonshotBalance();
      assert.equal(fetchCalls.length, 1, 'second call should hit cache');
      assert.equal(r1, r2);
    });

    it('falls back to stale cache on fetch failure', async () => {
      nextResponse = new Response(JSON.stringify({ balance: 25 }), { status: 200 });
      const { getMoonshotBalance } = await importMoonshot();
      const r1 = await getMoonshotBalance();
      const cachePath = join(tmpHome, '.cache', 'cc-hud', 'moonshot-balance.json');
      const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
      cached.ts = Date.now() - 10 * 60 * 1000;
      writeFileSync(cachePath, JSON.stringify(cached));
      nextError = new Error('network down');
      const r2 = await getMoonshotBalance();
      assert.equal(r2, r1, 'should return stale cache on fetch failure');
    });
  });
});
