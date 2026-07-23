/**
 * OpenCode SQLite 兜底读取模块。
 *
 * 当事件数据不足时，直接从 OpenCode 的 SQLite 数据库读取会话信息。
 * 只读操作，不写入。仅作为事件驱动数据采集的补充。
 *
 * 数据库位置（Linux/macOS）:
 *   ~/.local/share/opencode/opencode.db
 *   ~/.local/share/opencode/sessions/
 *
 * Windows:
 *   %LOCALAPPDATA%/opencode/opencode.db
 */

import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const DB_FILENAME = 'opencode.db';

function dbPath(): string | null {
  const home = homedir();
  // 优先查常见路径
  const candidates = platform() === 'win32'
    ? [
        join(process.env.LOCALAPPDATA || '', 'opencode', DB_FILENAME),
        join(home, '.local', 'share', 'opencode', DB_FILENAME),
      ]
    : [
        join(home, '.local', 'share', 'opencode', DB_FILENAME),
        join(home, '.config', 'opencode', DB_FILENAME),
      ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export interface SessionRecord {
  id: string;
  model_id?: string;
  model_provider?: string;
  tokens_input?: number;
  tokens_output?: number;
  agent_type?: string;
  created_at?: number;
  updated_at?: number;
}

/**
 * 尝试从 SQLite 获取最新的活跃会话信息。
 * 使用 child_process 调用 sqlite3 CLI，避免加 better-sqlite3 依赖。
 * 如果 sqlite3 CLI 不存在则静默返回 null。
 */
export async function readActiveSession(): Promise<SessionRecord | null> {
  const path = dbPath();
  if (!path) return null;

  try {
    const { execSync } = await import('node:child_process');
    // 用 sqlite3 CLI 做 JSON 格式查询
    const sql = `SELECT json_object(
      'id', s.id,
      'model_id', s.model_id,
      'model_provider', s.model_provider,
      'tokens_input', s.tokens_input,
      'tokens_output', s.tokens_output,
      'agent_type', s.agent_type,
      'updated_at', s.updated_at
    )
    FROM sessions s
    WHERE s.archived_at IS NULL
    ORDER BY s.updated_at DESC
    LIMIT 1`;

    const result = execSync(`sqlite3 -json "${path}" "${sql}"`, {
      timeout: 2000,
      encoding: 'utf8',
      windowsHide: true,
    }).trim();

    if (!result) return null;
    const rows = JSON.parse(result) as SessionRecord[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
