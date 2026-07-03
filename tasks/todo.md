# Todo: cc-hud 独立维护

## Phase 1: 解绑与合并

- [ ] **Task 1**: 解绑上游 remote
  - Verify: `git remote -v` 仅显示 origin
- [ ] **Task 2**: 合并 feat/opencode-quota → main
  - Verify: `git diff main..feat/opencode-quota` 空输出
- [ ] **Task 3**: 安装依赖 + 构建验证
  - Verify: `npm run build` 成功

### Checkpoint 1
- [ ] `git remote -v` 无 upstream
- [ ] main 包含 OpenCode 特性
- [ ] `npm run build` 通过

## Phase 2: 清理与配置

- [ ] **Task 4**: 清理本地和远程分支
  - Verify: `git branch -a` 仅剩 main
- [ ] **Task 5**: 更新插件清单所有权
  - Verify: plugin.json / marketplace.json 信息更新
- [ ] **Task 6**: 创建 CHANGELOG.md
  - Verify: Keep a Changelog 格式，包含 v0.1.0~v0.6.0

### Checkpoint 2
- [ ] 只剩 main 分支
- [ ] 插件信息已更新

## Phase 3: 测试与文档

- [ ] **Task 7**: 编写 OpenCode 单元测试
  - Verify: `node --test tests/opencode.test.ts` 全部通过
- [ ] **Task 8**: 完整测试套件验证
  - Verify: `npm test` 全部通过
- [ ] **Task 9**: 更新 README
  - Verify: 作者和仓库链接已更新

### Checkpoint 3
- [ ] 所有测试通过（含新 OpenCode 测试）
- [ ] README 已更新

## Phase 4: 发布 v0.6.0

- [ ] **Task 10**: 版本 bump + 打 tag (v0.6.0)
  - Verify: `git tag -l` 包含 v0.6.0
- [ ] **Task 11**: 推送到 GitHub
  - Verify: GitHub 上 main + tag 可见
- [ ] **Task 12**: 创建 GitHub Release
  - Verify: `gh release view v0.6.0` 可用

### Checkpoint 4
- [ ] v0.6.0 Release 已发布
- [ ] 独立维护管线建立完毕

## Phase 5 (Future): 组织迁移

- [ ] **Task 13**: 迁移仓库到 GitHub 组织
  - Verify: remote URL 指向组织 repo
- [ ] **Task 14**: 提交 Claude Code 插件市场审核
  - Verify: `claude plugins:install cc-hud` 可用
