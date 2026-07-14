/**
 * 本地代理检测工具函数。
 *
 * 检查 ANTHROPIC_BASE_URL 是否指向本地回环地址，
 * 用于推断用户可能在使用本地代理（cc-switch / OpenCode Go 等）。
 */
export function isLocalProxy(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? '';
  return baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
}
