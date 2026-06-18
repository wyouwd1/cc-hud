---
name: setup
description: Configure cc-hud statusline in Claude Code settings
---

Set up the cc-hud statusline. Write the following `statusLine` config into the user's `~/.claude/settings.json` (merge with existing settings, do not overwrite other fields):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/index.js",
    "padding": 2
  }
}
```

Use `${CLAUDE_PLUGIN_ROOT}` which resolves to the plugin's install directory.

> **Important:** If the plugin is upgraded via marketplace, the version number in the
> `statusLine.command` path must be updated manually (e.g. `0.4.2/dist/index.js` →
> `0.4.4/dist/index.js`). Marketplace updates install new versions but do not rewrite
> the statusLine config.

After writing the config, tell the user to run `/reload-plugins` to see the HUD.
