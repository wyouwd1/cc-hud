/** 时间戳工具 — 秒级纪元 → 毫秒级纪元 */
export function toMs(ts) {
    if (ts == null)
        return null;
    return ts < 1e12 ? ts * 1000 : ts;
}
