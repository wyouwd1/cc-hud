import { afterEach, beforeEach } from 'node:test';

/** 保存 process.env 快照，afterEach 自动还原 */
export function withEnvSnapshot(): void {
  let origEnv: NodeJS.ProcessEnv;
  beforeEach(() => { origEnv = { ...process.env }; });
  afterEach(() => { process.env = origEnv; });
}
