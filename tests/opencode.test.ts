import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const importOc = () => import('../dist/opencode.js');

// Realistic HTML snippet matching the OpenCode workspace page structure.
// Each dimension is embedded as an inline JS assignment:
//   rollingUsage:$R[N]={status:"ok",resetInSec:<num>,usagePercent:<num>}
const HTML_OK = (rp: number, wp: number, mp: number, rs: number, ws: number, ms: number) =>
  `<!DOCTYPE html><html><head><script>
    var e=1,rollingUsage:$R[30]={status:"ok",resetInSec:${rs},usagePercent:${rp}};
    var f=2,weeklyUsage:$R[31]={status:"ok",resetInSec:${ws},usagePercent:${wp}};
    var g=3,monthlyUsage:$R[32]={status:"ok",resetInSec:${ms},usagePercent:${mp}};
  </script></head><body></body></html>`;

describe('opencode quota', () => {
  const origAuth = process.env.OPENCODE_AUTH;
  const origWs = process.env.OPENCODE_WS;
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  const origFetch = globalThis.fetch;

  let tmpHome: string;
  let fetchCalls: { url: string; init: RequestInit | undefined }[];
  let nextResponse: Response;
  let nextError: unknown;

  beforeEach(() => {
    delete process.env.OPENCODE_AUTH;
    delete process.env.OPENCODE_WS;
    tmpHome = mkdtempSync(join(tmpdir(), 'oc-test-'));
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    fetchCalls = [];
    nextResponse = new Response('', { status: 200 });
    nextError = undefined;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      if (nextError) throw nextError;
      return nextResponse;
    }) as typeof fetch;
  });

  afterEach(() => {
    if (origAuth === undefined) delete process.env.OPENCODE_AUTH;
    else process.env.OPENCODE_AUTH = origAuth;
    if (origWs === undefined) delete process.env.OPENCODE_WS;
    else process.env.OPENCODE_WS = origWs;
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    if (origUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = origUserProfile;
    globalThis.fetch = origFetch;
    rmSync(tmpHome, { recursive: true, force: true });
  });

  // ─── Isolation — non-OpenCode environments ─────────────────────

  describe('isolation — non-OpenCode environments', () => {
    it('returns null when OPENCODE_AUTH is unset', async () => {
      const { getOpenCodeQuota } = await importOc();
      assert.equal(await getOpenCodeQuota(), null);
    });

    it('does not call fetch when OPENCODE_AUTH is unset', async () => {
      const { getOpenCodeQuota } = await importOc();
      await getOpenCodeQuota();
      assert.equal(fetchCalls.length, 0, 'should not fetch without auth');
    });
  });

  // ─── HTML parsing ──────────────────────────────────────────────

  describe('HTML parsing', () => {
    beforeEach(() => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
    });

    it('parses typical workspace page', async () => {
      const now = Date.now();
      nextResponse = new Response(
        HTML_OK(7, 25, 98, 5647, 245174, 597495),
        { status: 200 },
      );
      const { getOpenCodeQuota } = await importOc();
      const r = await getOpenCodeQuota();
      assert.ok(r);
      assert.equal(r!.rollingPercent, 7);
      assert.equal(r!.weeklyPercent, 25);
      assert.equal(r!.monthlyPercent, 98);
      // resetsAt = now + resetInSec * 1000
      assert.ok(Math.abs(r!.rollingResetsAt - (now + 5647_000)) < 2000);
      assert.ok(Math.abs(r!.weeklyResetsAt - (now + 245_174_000)) < 2000);
      assert.ok(Math.abs(r!.monthlyResetsAt - (now + 597_495_000)) < 2000);
    });

    it('handles fully unused (0% usage)', async () => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
      nextResponse = new Response(
        HTML_OK(0, 0, 0, 86400, 604800, 2592000),
        { status: 200 },
      );
      const { getOpenCodeQuota } = await importOc();
      const r = await getOpenCodeQuota();
      assert.ok(r);
      assert.equal(r!.rollingPercent, 0);
      assert.equal(r!.weeklyPercent, 0);
      assert.equal(r!.monthlyPercent, 0);
    });

    it('skips monthlyUsage:null and returns null for failed dimension', async () => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
      // Only rollingUsage and weeklyUsage have values; monthlyUsage is null
      const html = `<!DOCTYPE html><script>
        rollingUsage:$R[30]={status:"ok",resetInSec:1000,usagePercent:10};
        weeklyUsage:$R[31]={status:"ok",resetInSec:2000,usagePercent:20};
        monthlyUsage:null;
        var x=1;
      </script></html>`;
      nextResponse = new Response(html, { status: 200 });
      const { getOpenCodeQuota } = await importOc();
      const r = await getOpenCodeQuota();
      assert.equal(r, null, 'should return null when a dimension is missing');
    });

    it('ignores unrelated inline JS assignments', async () => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
      const html = `<!DOCTYPE html><script>
        var a = {resetInSec:1,usagePercent:99};
        rollingUsage:$R[30]={status:"ok",resetInSec:100,usagePercent:5};
        weeklyUsage:$R[31]={status:"ok",resetInSec:200,usagePercent:10};
        monthlyUsage:$R[32]={status:"ok",resetInSec:300,usagePercent:15};
        function foo(){return {status:"ok",resetInSec:0,usagePercent:0}}
      </script></html>`;
      nextResponse = new Response(html, { status: 200 });
      const { getOpenCodeQuota } = await importOc();
      const r = await getOpenCodeQuota();
      assert.ok(r);
      assert.equal(r!.rollingPercent, 5);
      assert.equal(r!.weeklyPercent, 10);
      assert.equal(r!.monthlyPercent, 15);
    });
  });

  // ─── Error resilience ──────────────────────────────────────────

  describe('error resilience', () => {
    beforeEach(() => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
    });

    it('returns null on 401 response', async () => {
      nextResponse = new Response('unauthorized', { status: 401 });
      const { getOpenCodeQuota } = await importOc();
      assert.equal(await getOpenCodeQuota(), null);
    });

    it('returns null on 500 response', async () => {
      nextResponse = new Response('server error', { status: 500 });
      const { getOpenCodeQuota } = await importOc();
      assert.equal(await getOpenCodeQuota(), null);
    });

    it('returns null on network error', async () => {
      nextError = new Error('ECONNREFUSED');
      const { getOpenCodeQuota } = await importOc();
      assert.equal(await getOpenCodeQuota(), null);
    });

    it('returns null on unparseable HTML', async () => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
      nextResponse = new Response('<html>no usage data here</html>', { status: 200 });
      const { getOpenCodeQuota } = await importOc();
      assert.equal(await getOpenCodeQuota(), null);
    });

    it('returns null on partial HTML (missing weeklyUsage)', async () => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
      const html = `<script>
        rollingUsage=$R[0]={status:"ok",resetInSec:100,usagePercent:5};
        monthlyUsage=$R[2]={status:"ok",resetInSec:300,usagePercent:15};
      </script>`;
      nextResponse = new Response(html, { status: 200 });
      const { getOpenCodeQuota } = await importOc();
      assert.equal(await getOpenCodeQuota(), null);
    });
  });

  // ─── Cache ─────────────────────────────────────────────────────

  describe('cache', () => {
    beforeEach(() => {
      process.env.OPENCODE_AUTH = 'test-auth-token';
    });

    it('caches successful response for 5 minutes', async () => {
      nextResponse = new Response(
        HTML_OK(10, 20, 30, 1000, 2000, 3000),
        { status: 200 },
      );
      const { getOpenCodeQuota } = await importOc();
      const r1 = await getOpenCodeQuota();
      const r2 = await getOpenCodeQuota();
      assert.equal(fetchCalls.length, 1, 'second call should hit cache');
      assert.deepEqual(r1, r2);
    });

    it('falls back to stale cache on fetch failure', async () => {
      // First call: succeed → write cache
      nextResponse = new Response(
        HTML_OK(15, 35, 55, 500, 1500, 2500),
        { status: 200 },
      );
      const { getOpenCodeQuota } = await importOc();
      const r1 = await getOpenCodeQuota();
      // Make cache stale (10 min old)
      const cachePath = join(tmpHome, '.cache', 'cc-hud', 'oc-quota.json');
      const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
      cached.ts = Date.now() - 10 * 60 * 1000;
      writeFileSync(cachePath, JSON.stringify(cached));
      // Second call: fetch fails
      nextError = new Error('network down');
      const r2 = await getOpenCodeQuota();
      assert.deepEqual(r1, r2, 'should return stale cache on fetch failure');
    });
  });
});

// ─── Auto-detection & guidance ────────────────────────────────

describe('auto-detection & guidance', () => {
  const origBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const origAuth = process.env.OPENCODE_AUTH;
  const origSkipHint = process.env.CC_HUD_SKIP_OC_HINT;

  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.OPENCODE_AUTH;
    delete process.env.CC_HUD_SKIP_OC_HINT;
  });

  afterEach(() => {
    if (origBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL;
    else process.env.ANTHROPIC_BASE_URL = origBaseUrl;
    if (origAuth === undefined) delete process.env.OPENCODE_AUTH;
    else process.env.OPENCODE_AUTH = origAuth;
    if (origSkipHint === undefined) delete process.env.CC_HUD_SKIP_OC_HINT;
    else process.env.CC_HUD_SKIP_OC_HINT = origSkipHint;
  });

  // ─── isOpenCode ────────────────────────────────────────────

  describe('isOpenCode (enhanced)', () => {
    it('returns true when ANTHROPIC_BASE_URL contains 127.0.0.1', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { isOpenCode } = await importOc();
      assert.equal(isOpenCode(), true);
    });

    it('returns true when OPENCODE_AUTH is set (even without 127.0.0.1)', async () => {
      process.env.OPENCODE_AUTH = 'some-auth';
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { isOpenCode } = await importOc();
      assert.equal(isOpenCode(), true);
    });

    it('returns false when neither 127.0.0.1 nor OPENCODE_AUTH', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { isOpenCode } = await importOc();
      assert.equal(isOpenCode(), false);
    });

    it('returns true when both 127.0.0.1 and OPENCODE_AUTH', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      process.env.OPENCODE_AUTH = 'some-auth';
      const { isOpenCode } = await importOc();
      assert.equal(isOpenCode(), true);
    });
  });

  // ─── isHintSilenced ────────────────────────────────────────

  describe('isHintSilenced', () => {
    it('returns true when CC_HUD_SKIP_OC_HINT=1', async () => {
      process.env.CC_HUD_SKIP_OC_HINT = '1';
      const { isHintSilenced } = await importOc();
      assert.equal(isHintSilenced(), true);
    });

    it('returns false when CC_HUD_SKIP_OC_HINT is unset', async () => {
      const { isHintSilenced } = await importOc();
      assert.equal(isHintSilenced(), false);
    });

    it('returns false when CC_HUD_SKIP_OC_HINT=0', async () => {
      process.env.CC_HUD_SKIP_OC_HINT = '0';
      const { isHintSilenced } = await importOc();
      assert.equal(isHintSilenced(), false);
    });
  });

  // ─── needsGuidance ─────────────────────────────────────────

  describe('needsGuidance', () => {
    it('returns true when 127.0.0.1 + no auth + not silenced', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { needsGuidance } = await importOc();
      assert.equal(needsGuidance(), true);
    });

    it('returns false when 127.0.0.1 but has credentials', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      process.env.OPENCODE_AUTH = 'some-auth';
      const { needsGuidance } = await importOc();
      assert.equal(needsGuidance(), false);
    });

    it('returns false when 127.0.0.1 but silenced', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      process.env.CC_HUD_SKIP_OC_HINT = '1';
      const { needsGuidance } = await importOc();
      assert.equal(needsGuidance(), false);
    });

    it('returns false when not 127.0.0.1 (even without auth)', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { needsGuidance } = await importOc();
      assert.equal(needsGuidance(), false);
    });

    it('returns false when 127.0.0.1 + no auth + silenced=1', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      process.env.CC_HUD_SKIP_OC_HINT = '1';
      const { needsGuidance } = await importOc();
      assert.equal(needsGuidance(), false);
    });
  });

  // ─── getOpenCodeHint ───────────────────────────────────────

  describe('getOpenCodeHint', () => {
    it('returns string when needsGuidance is true', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { getOpenCodeHint } = await importOc();
      const hint = getOpenCodeHint();
      assert.ok(hint);
      assert.equal(typeof hint, 'string');
    });

    it('returns null when needsGuidance is false', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { getOpenCodeHint } = await importOc();
      assert.equal(getOpenCodeHint(), null);
    });

    it('contains "OC" and the ref URL in the hint text', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { getOpenCodeHint } = await importOc();
      const hint = getOpenCodeHint()!;
      assert.ok(hint.includes('OC'), 'hint should mention OC');
      assert.ok(hint.includes('go?ref='), 'hint should reference the go page');
    });
  });

  // ─── getOpenCodeGuidanceLine ───────────────────────────────

  describe('getOpenCodeGuidanceLine', () => {
    it('returns string when needsGuidance is true', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { getOpenCodeGuidanceLine } = await importOc();
      const line = getOpenCodeGuidanceLine();
      assert.ok(line);
      assert.equal(typeof line, 'string');
    });

    it('returns null when needsGuidance is false', async () => {
      process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
      const { getOpenCodeGuidanceLine } = await importOc();
      assert.equal(getOpenCodeGuidanceLine(), null);
    });

    it('contains the opencode.ai ref URL in the guidance', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { getOpenCodeGuidanceLine } = await importOc();
      assert.ok(getOpenCodeGuidanceLine()!.includes('go?ref=TN4ZD3A7YH'));
    });

    it('has multiple lines', async () => {
      process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
      const { getOpenCodeGuidanceLine } = await importOc();
      const lines = getOpenCodeGuidanceLine()!.split('\n');
      assert.ok(lines.length >= 2, 'guidance should span multiple lines');
    });
  });
});
