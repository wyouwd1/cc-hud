/** 全局常量和映射配置 */

/** 超时 — 从不阻塞 Claude Code */
export const TIMEOUT_MS = 6000;

/** effort level 原始值 → 显示标签 */
export const EFFORT_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'xHigh',
  max: 'Max',
  ultracode: 'Ultracode',
};
