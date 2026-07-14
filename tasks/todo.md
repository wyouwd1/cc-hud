# ToDo: OpenCode Go 自动识别与配置引导 ✅ 全部完成

## Phase 1: 核心逻辑

- [x] **T1** — `src/model.ts` 导出 `isLocalProxy()`（加 `export`）
- [x] **T2** — `src/opencode.ts` 新增检测与引导函数（`hasCredentials` / `isHintSilenced` / `needsGuidance` / `getOpenCodeHint` / `getOpenCodeGuidanceLine`）；增强 `isOpenCode()`

## Phase 2: 集成

- [x] **T3** — `src/index.ts` 接入引导输出（extra 段 hint + stdout 指引行）

## Phase 3: 测试

- [x] **T4** — `tests/opencode.test.ts` 新增 ~15 条检测与引导测试（实际 19 条）

## Phase 4: 验证

- [x] **T5** — `npm test` 全部通过（207 tests, 48 suites, 0 failures）
