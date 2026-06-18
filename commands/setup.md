---
name: setup
description: Configure cc-hud statusline in Claude Code settings
---

Configure cc-hud as the Claude Code statusline. Since v0.5.0, cc-hud uses a stable-path **launcher** so future plugin upgrades do **not** require re-running this setup — the launcher resolves whichever cc-hud version is currently installed on each tick.

Steps below are idempotent — safe to re-run.

## Step 1 — Resolve paths

Resolve the user's home directory:

```bash
node -e "console.log(require('os').homedir())"
```

Call the output **HOME**. From it derive:

- Launcher source: `${CLAUDE_PLUGIN_ROOT}/scripts/launcher.cjs`
- Launcher destination (stable path): `<HOME>/.claude/bin/cc-hud-launcher.cjs`
- User settings: `<HOME>/.claude/settings.json`

## Step 2 — Install the launcher

Always overwrite (the launcher is a managed file):

1. `mkdir -p <HOME>/.claude/bin`
2. Read `${CLAUDE_PLUGIN_ROOT}/scripts/launcher.cjs` verbatim, then Write the **exact same content** to `<HOME>/.claude/bin/cc-hud-launcher.cjs`. Do not modify or annotate it.

The launcher reads `<HOME>/.claude/plugins/installed_plugins.json` on each tick and spawns the latest installed cc-hud's `dist/index.js`. Its contents stay valid across cc-hud versions, so this file rarely needs rewriting.

## Step 3 — Update `statusLine` in `~/.claude/settings.json`

Read `<HOME>/.claude/settings.json` (treat as `{}` if missing or unreadable). The target merged config:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node <HOME>/.claude/bin/cc-hud-launcher.cjs",
    "padding": 2
  }
}
```

Substitute `<HOME>` with the **absolute path** — do not leave `~` or `${HOME}` in the JSON.

Branch on the current `statusLine.command`:

- **Missing** → merge in the target. Tell user: `✓ statusLine registered (cc-hud launcher)`.
- **Already points at `cc-hud-launcher.cjs`** → leave untouched. Tell user: `✓ launcher already registered (idempotent skip)`.
- **Direct cc-hud path** (contains `cc-hud` and `dist/index.js` — i.e. the old version-pinned form) → overwrite. Tell user: `✓ migrated statusLine from version-pinned path to stable launcher — future cc-hud upgrades no longer need re-running /cc-hud:setup`.
- **cc-bot shim** (contains `cc-bot` and `statusline.js`) → leave untouched. Tell user: `ℹ cc-bot's statusline shim already wraps cc-hud automatically — no change needed`.
- **Other non-empty value** → ask via `AskUserQuestion` whether to overwrite (default = keep existing). On "keep", skip the write and tell user the launcher is installed at `<HOME>/.claude/bin/cc-hud-launcher.cjs` for manual wiring.

When writing, **merge** — never wipe other top-level keys in `settings.json`.

## Step 4 — Confirm

Tell the user (single block):

```
✓ cc-hud launcher → <HOME>/.claude/bin/cc-hud-launcher.cjs
✓ statusLine      → node <HOME>/.claude/bin/cc-hud-launcher.cjs

Run /reload-plugins to see the HUD.

Future upgrades:
  /plugin marketplace update cc-hud
  /reload-plugins
(no need to re-run /cc-hud:setup unless a release note says otherwise.)
```
