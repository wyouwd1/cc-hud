import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const DEFAULT_PATH = join(homedir(), '.cc-hud-status');

let filePath = DEFAULT_PATH;

export function setStatusPath(p: string) {
  filePath = p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
}

export function getStatusPath(): string {
  return filePath;
}

export async function writeStatusFile(content: string): Promise<void> {
  if (!content) return;
  try {
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    const tmp = filePath + '.tmp.' + process.pid;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, filePath);
  } catch {
    // 静默降级
  }
}
