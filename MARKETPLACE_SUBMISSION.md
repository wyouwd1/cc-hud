# Claude Code 插件市场上架指南

## 前置条件

- [ ] 已发布 `@wyouwd1/cc-hud` npm 包（已完成 v0.6.0/0.6.1）
- [ ] 以下 manifest 文件已更新（已完成）

| 文件 | 字段 | 当前值 |
|------|------|--------|
| `.claude-plugin/plugin.json` | `author.name` | `wyouwd1` |
| `.claude-plugin/plugin.json` | `repository` | `https://github.com/wyouwd1/cc-hud` |
| `.claude-plugin/marketplace.json` | `owner.name` | `wyouwd1` |

---

## 提交流程

### 1. 登录 Claude Code

在终端中运行：

```
claude plugins:marketplace
```

如果此命令不可用，尝试：

```
claude plugins:list
```

### 2. 在 Claude Code 中提交插件

两种方式：

**方式 A — 通过命令提交**

```
/plugin marketplace add wyoud1/cc-hud
/plugin install cc-hud@cc-hud
```

**方式 B — 通过插件市场 Web 界面**

1. 打开 [Claude Code Plugin Marketplace](https://claude.ai/plugins)
2. 点击 **Publish Plugin**
3. 填写以下信息：

| 字段 | 值 |
|------|-----|
| GitHub URL | `https://github.com/wyouwd1/cc-hud` |
| Plugin name | `cc-hud` |
| Source | 自动从 plugin.json 读取 |

### 3. 等待审核

- 审核周期：通常 **1-2 周**
- 审核期间可正常使用插件（本地安装不受影响）
- 审核通过后会自动通知

### 4. 验证上架

审核通过后：

```
/plugin marketplace install cc-hud
/plugin install cc-hud@cc-hud
/reload-plugins
```

验证状态栏显示正常：

```
[Opus 4.7] ██░░░░░░░░ 20% (1M)
```

---

## 常见问题

### Q: 审核需要什么材料？
插件市场主要检查：
- 插件能正常安装和运行
- `plugin.json` 和 `marketplace.json` 格式正确
- 不包含恶意代码
- 遵循 Claude Code 插件规范

### Q: 审核不通过怎么办？
根据审核反馈修改后重新提交。常见原因：
- manifest 信息不完整
- 插件在标准环境中运行出错
- 违反了内容政策

### Q: 插件上架后如何更新？
1. 发布新版本到 GitHub（打 tag）
2. 等待 CI/CD 自动发布到 npm
3. 插件市场会自动检测并显示更新
4. 用户运行 `/plugin marketplace update cc-hud` 即可更新

### Q: 用户如何安装？
上架后用户只需在 Claude Code 中运行：

```
/plugin marketplace add wyoud1/cc-hud
/plugin install cc-hud@cc-hud
/reload-plugins
/cc-hud:setup
```

---

## 参考链接

- [Claude Code Plugins 文档](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [cc-hud GitHub](https://github.com/wyouwd1/cc-hud)
- [cc-hud npm](https://www.npmjs.com/package/@wyouwd1/cc-hud)
- [CHANGELOG](https://github.com/wyouwd1/cc-hud/blob/main/CHANGELOG.md)
