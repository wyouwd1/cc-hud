# Todo: cc-hud v2 — npm · Qwen · CI/CD · HUD 增强

## Phase 1: npm 发布

- [ ] **Task 1**: 改包名 `@wyouwd1/cc-hud` + `npm publish --access public`
  - Verify: `npm view @wyouwd1/cc-hud`
- [ ] **Task 2**: 市场 manifest 更新 + README 安装指南
  - Verify: plugin.json / marketplace.json 信息更新

### Checkpoint 1
- [ ] npm 包可见
- [ ] 市场信息已更新

---

## Phase 2: 通义千问 (Qwen) 后端

- [ ] **Task 3**: 实现 `src/qwen.ts`（余额采集）
  - Verify: `tsc` 编译无报错
- [ ] **Task 4**: 编写 `tests/qwen.test.ts`
  - Verify: `node --test tests/qwen.test.ts` 全通过
- [ ] **Task 5**: 集成到 `src/index.ts` + 全测试
  - Verify: `npm run build && npm test` 全通过

### Checkpoint 2
- [ ] Qwen 后端完成
- [ ] 全部测试通过

---

## Phase 3: HUD 功能增强

- [ ] **Task 6**: 自定义主题 `CC_HUD_THEME`（Catppuccin/Dracula/Nord）
  - Verify: 不同环境变量输出不同颜色
- [ ] **Task 7**: 紧凑模式 `CC_HUD_COMPACT=1`
  - Verify: 紧凑模式输出更短

### Checkpoint 3
- [ ] 主题切换正常
- [ ] 紧凑模式正常
- [ ] 全部测试通过

---

## Phase 4: CI/CD 管线

- [ ] **Task 8**: 创建 `ci.yml`（push/PR → tsc + test）
  - Verify: GitHub Actions 可见
- [ ] **Task 9**: c8 覆盖率配置
  - Verify: `npx c8 npm test` 输出 ≥ 80%
- [ ] **Task 10**: 创建 `publish.yml`（tag push → npm publish）
  - Verify: GitHub Actions 配置正确

### Checkpoint 4
- [ ] CI 自动运行
- [ ] 覆盖率 ≥ 80%
- [ ] 发布管线就绪

---

## Phase 5: 文档整理

- [ ] **Task 11**: OpenCode → OpenCode Go + README 更新
  - Verify: 文档中命名统一

### Checkpoint 5
- [ ] 文档完整
- [ ] 全部 11 个任务完成
