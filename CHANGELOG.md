# Changelog

All notable changes to cc-hud are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] — 2026-07-03

### Added
- OpenCode Go subscription quota display (rolling / weekly / monthly)
- CC_HUD_EXTRA_FILE support for custom extra segment via file
- Windows path guidance for CC_HUD_EXTRA_FILE setup

### Fixed
- Context availability now relies on `used_percentage` instead of `current_usage`

### Changed
- Forked from upstream (WaterTian/cc-hud), independently maintained by 熊崽
- Removed upstream remote, all future development on `wyouwd1/cc-hud`

## [0.5.1] — 2026-06-23

### Fixed
- Show "—%" when `current_usage` is null instead of collapsing to 0%

## [0.5.0] — 2026-06-18

### Added
- Stable-path launcher for upgrade-safe `statusLine` configuration (v0.5.0)

### Changed
- README: keep English only, remove Chinese 'Why' section
- Animated SVG preview header with PNG fallback

## [0.4.5] — 2026-06-18

### Added
- Setup step documentation in upgrade flow

### Changed
- Updated preview image and setup instructions for GLM

## [0.4.4] — 2026-06-18

### Fixed
- Parse model id from `display_name` too — GLM backends only send `display_name`

## [0.4.3] — 2026-06-18

### Added
- GLM balance auto-fetch
- Model name beautification for GLM

## [0.4.2] — 2026-06-01

### Fixed
- Read MiniMax quota from `*_remaining_percent` instead of `_usage_count`

## [0.4.1] — 2026-06-01

### Fixed
- Aggregate MiniMax Token Plan usage across all models

## [0.4.0] — 2026-06-01

### Added
- MiniMax Token Plan quota display with auto-detection
- Model name beautification for MiniMax

## [0.3.1] — 2026-05-27

### Fixed
- Support deepseek `[1m]` variant suffix parsing

## [0.3.0] — 2026-05-27

### Added
- DeepSeek balance auto-detection
- Model name beautification for DeepSeek

## [0.2.5] — 2026-04-29

### Fixed
- Install command and remove restart step from setup flow

## [0.2.4] — 2026-04-14

### Added
- Surface 1M context variant beside context percentage
- Redesigned preview as terminal window with Geist Mono
- Star history chart in README

### Changed
- HUD font enlarged to 18px

## [0.2.3] — 2026-04-14

### Fixed
- Trim trailing `.0` in countdown display (7.0d → 7d, 5.0h → 5h)

## [0.2.2] — 2026-04-14

### Fixed
- Spacing between rate segments
- Use absolute image URL for npm

## [0.2.1] — 2026-04-14

### Fixed
- Handle seconds-based `resets_at` timestamp from Claude Code

## [0.2.0] — 2026-04-14

### Added
- Rate limit reset countdown with Catppuccin color scale
- NPM badges and metadata enrichment

## [0.1.0] — 2026-04-03

### Added
- Initial cc-hud statusline plugin
- Plugin marketplace support (`marketplace.json`)
- Context usage display with progress bar
- Active agent detection from transcript
- Model name beautification
- Tail read + pre-filter + timeout for performance

[0.6.0]: https://github.com/wyouwd1/cc-hud/releases/tag/v0.6.0
[0.5.1]: https://github.com/WaterTian/cc-hud/releases/tag/v0.5.1
[0.5.0]: https://github.com/WaterTian/cc-hud/releases/tag/v0.5.0
[0.4.5]: https://github.com/WaterTian/cc-hud/releases/tag/v0.4.5
[0.4.4]: https://github.com/WaterTian/cc-hud/releases/tag/v0.4.4
[0.4.3]: https://github.com/WaterTian/cc-hud/releases/tag/v0.4.3
[0.4.2]: https://github.com/WaterTian/cc-hud/releases/tag/v0.4.2
[0.4.1]: https://github.com/WaterTian/cc-hud/releases/tag/v0.4.1
[0.4.0]: https://github.com/WaterTian/cc-hud/releases/tag/v0.4.0
[0.3.1]: https://github.com/WaterTian/cc-hud/releases/tag/v0.3.1
[0.3.0]: https://github.com/WaterTian/cc-hud/releases/tag/v0.3.0
[0.2.5]: https://github.com/WaterTian/cc-hud/releases/tag/v0.2.5
[0.2.4]: https://github.com/WaterTian/cc-hud/releases/tag/v0.2.4
[0.2.3]: https://github.com/WaterTian/cc-hud/releases/tag/v0.2.3
[0.2.2]: https://github.com/WaterTian/cc-hud/releases/tag/v0.2.2
[0.2.1]: https://github.com/WaterTian/cc-hud/releases/tag/v0.2.1
[0.2.0]: https://github.com/WaterTian/cc-hud/releases/tag/v0.2.0
[0.1.0]: https://github.com/WaterTian/cc-hud/releases/tag/v0.1.0
