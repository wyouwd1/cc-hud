# ToDo: 自定义代理模型名正确显示 ✅ 全部完成

## Phase 1: 核心逻辑

- [x] **T1** — `src/model.ts` 新增 `isLocalProxy()` / `proxyModelName()`，修改 `shortModelName()`

## Phase 2: 测试

- [x] **T2** — `tests/model.test.ts` 新增代理模式测试用例（7 个 it）+ 环境隔离

## Phase 3: 验证

- [x] **T3** — `npm test` 全部通过（188 tests, 42 suites, 0 failures）
