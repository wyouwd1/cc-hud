import { readFileSync } from 'node:fs';

export interface HudConfig {
  theme: string;
  compact: boolean;
  statusFile: string;
}

const DEFAULTS: HudConfig = {
  theme: 'catppuccin',
  compact: false,
  statusFile: '',
};

let cached: HudConfig | null = null;

function envBool(key: string): boolean | undefined {
  const v = process.env[key];
  if (v === '1' || v?.toLowerCase() === 'true') return true;
  if (v === '0' || v?.toLowerCase() === 'false') return false;
  return undefined;
}

function tryReadOpencodeJson(): Partial<HudConfig> | null {
  try {
    const configPath = process.env.OPENCODE_CONFIG || '';
    if (!configPath) return null;
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const ccHud = parsed?.['cc-hud'];
    if (!ccHud || typeof ccHud !== 'object') return null;
    return {
      theme: typeof ccHud.theme === 'string' ? ccHud.theme : undefined,
      compact: typeof ccHud.compact === 'boolean' ? ccHud.compact : undefined,
      statusFile: typeof ccHud.statusFile === 'string' ? ccHud.statusFile : undefined,
    };
  } catch {
    return null;
  }
}

export function loadConfig(): HudConfig {
  if (cached) return cached;

  const fileCfg = tryReadOpencodeJson() ?? {};

  const envTheme = process.env.CC_HUD_THEME;
  const envCompact = envBool('CC_HUD_COMPACT');
  const envStatusFile = process.env.CC_HUD_STATUS_FILE;

  cached = {
    theme: envTheme ?? fileCfg.theme ?? DEFAULTS.theme,
    compact: envCompact ?? fileCfg.compact ?? DEFAULTS.compact,
    statusFile: envStatusFile ?? fileCfg.statusFile ?? DEFAULTS.statusFile,
  };
  return cached;
}

export function invalidateConfig() {
  cached = null;
}
