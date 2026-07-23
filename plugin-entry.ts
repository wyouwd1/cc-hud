/**
 * OpenCode 插件入口。
 * 当 npm 包 `@wyouwd1/cc-hud` 通过 `"plugin"` 配置加载时，
 * OpenCode 读取此文件的默认导出（`{ id, setup }` V2 Promise 格式）。
 */
export { default } from './opencode-plugin/index.js';
