import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shortModelName } from '../dist/model.js';
import { withEnvSnapshot } from './helpers.ts';

// Model name parsing test cases: [description, displayName, id, expectedName, expectedVariant]
const MODEL_CASES: [string, string | undefined, string | undefined, string, string | null][] = [
  // Standard Claude models
  ['parses standard model id', undefined, 'claude-opus-4-7', 'Opus 4.7', null],
  ['parses sonnet id', undefined, 'claude-sonnet-4-6', 'Sonnet 4.6', null],
  ['parses haiku id', undefined, 'claude-haiku-4-5', 'Haiku 4.5', null],
  // 1M variant
  ['extracts 1M variant from opus', undefined, 'claude-opus-4-7[1m]', 'Opus 4.7', '1M'],
  ['extracts 1M variant from opus 4.6', undefined, 'claude-opus-4-6[1m]', 'Opus 4.6', '1M'],
  // Dated suffix
  ['tolerates dated haiku suffix', undefined, 'claude-haiku-4-5-20251001', 'Haiku 4.5', null],
  ['tolerates dated opus suffix with variant', undefined, 'claude-opus-4-7-20260101[1m]', 'Opus 4.7', '1M'],
  // Prefer id over display_name
  ['prefers id over display_name', 'Opus 4', 'claude-opus-4-7', 'Opus 4.7', null],
  // Fallback to display_name
  ['falls back to display_name without id', 'Opus 4.7 (1M context)', undefined, 'Opus 4.7', null],
  ['falls back to plain display_name', 'Sonnet', undefined, 'Sonnet', null],
  // Missing arguments
  ['returns Claude when both are missing', undefined, undefined, 'Claude', null],
  ['returns Claude when both are empty', '', '', 'Claude', null],
  // Unknown id falls back to display_name
  ['falls back to display_name for unknown id', 'Custom', 'unknown-model-id', 'Custom', null],
  // DeepSeek
  ['beautifies DeepSeek V4 Pro', undefined, 'deepseek-v4-pro', 'DeepSeek V4 Pro', null],
  ['beautifies DeepSeek V4 Flash', undefined, 'deepseek-v4-flash', 'DeepSeek V4 Flash', null],
  ['beautifies DeepSeek with 1M variant', undefined, 'deepseek-v4-pro[1m]', 'DeepSeek V4 Pro', '1M'],
  // MiniMax
  ['beautifies MiniMax M3', undefined, 'MiniMax-M3', 'MiniMax M3', null],
  ['extracts MiniMax 1M variant', undefined, 'MiniMax-M3[1m]', 'MiniMax M3', '1M'],
  ['beautifies MiniMax-Text-01', undefined, 'MiniMax-Text-01', 'MiniMax Text 01', null],
  ['beautifies legacy ABAB 6.5s', undefined, 'abab-6.5s-chat', 'ABAB 6.5s Chat', null],
  ['beautifies legacy ABAB 7', undefined, 'abab-7-chat', 'ABAB 7 Chat', null],
  ['returns family only for plain MiniMax', undefined, 'MiniMax', 'MiniMax', null],
  // GLM
  ['beautifies GLM-5.2', undefined, 'glm-5.2', 'GLM 5.2', null],
  ['extracts GLM 1M variant', undefined, 'glm-5.2[1m]', 'GLM 5.2', '1M'],
  ['beautifies GLM-5-Turbo', undefined, 'glm-5-turbo', 'GLM 5 Turbo', null],
  ['beautifies GLM-4.7', undefined, 'glm-4.7', 'GLM 4.7', null],
  ['beautifies GLM-4.5-Air', undefined, 'glm-4.5-air', 'GLM 4.5 Air', null],
  ['beautifies GLM-4 legacy id', undefined, 'glm-4', 'GLM 4', null],
  ['beautifies legacy ChatGLM', undefined, 'chatglm_turbo', 'ChatGLM Turbo', null],
  ['parses GLM from display_name without id', 'glm-5.2[1m]', undefined, 'GLM 5.2', '1M'],
  ['parses GLM 5 Turbo from display_name', 'glm-5-turbo', undefined, 'GLM 5 Turbo', null],
];

describe('shortModelName', () => {
  withEnvSnapshot();
  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME;
  });

  for (const [desc, displayName, id, expectedName, expectedVariant] of MODEL_CASES) {
    it(desc, () => {
      assert.deepEqual(shortModelName(displayName, id), { name: expectedName, variant: expectedVariant });
    });
  }
});

describe('proxy model override', () => {
  withEnvSnapshot();

  const PROXY_ENV = { ANTHROPIC_BASE_URL: 'http://127.0.0.1:15721', ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'deepseek-v4-flash' };

  it('reads model name from env under local proxy', () => {
    Object.assign(process.env, PROXY_ENV);
    assert.deepEqual(
      shortModelName(undefined, 'claude-opus-4-8[1m]'),
      { name: 'DeepSeek V4 Flash', variant: '1M' },
    );
  });

  it('uses variant from model id', () => {
    Object.assign(process.env, PROXY_ENV);
    assert.equal(shortModelName(undefined, 'claude-opus-4-8[1m]').variant, '1M');
  });

  it('ignores env var when not under local proxy', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = 'deepseek-v4-flash';
    assert.deepEqual(
      shortModelName(undefined, 'claude-opus-4-8[1m]'),
      { name: 'Opus 4.8', variant: '1M' },
    );
  });

  it('ignores empty env var under local proxy', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = '';
    assert.deepEqual(
      shortModelName(undefined, 'claude-opus-4-8[1m]'),
      { name: 'Opus 4.8', variant: '1M' },
    );
  });

  it('beautifies deepseek name', () => {
    Object.assign(process.env, PROXY_ENV);
    assert.deepEqual(
      shortModelName(undefined, 'claude-opus-4-8[1m]'),
      { name: 'DeepSeek V4 Flash', variant: '1M' },
    );
  });

  it('returns raw env value when tryParse does not match', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:15721';
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = 'custom-model-x1';
    assert.deepEqual(
      shortModelName(undefined, 'claude-opus-4-8[1m]'),
      { name: 'custom-model-x1', variant: '1M' },
    );
  });

  it('falls through when no proxy env', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = 'deepseek-v4-flash';
    assert.deepEqual(
      shortModelName(undefined, 'claude-opus-4-8[1m]'),
      { name: 'Opus 4.8', variant: '1M' },
    );
  });
});
