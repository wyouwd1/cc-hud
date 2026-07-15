// — Theme support: CC_HUD_THEME=(catppuccin|dracula|nord) —
const RESET = '\x1b[0m';
const fg = (n) => `\x1b[38;5;${n}m`;
const THEMES = {
    catppuccin: {
        green: fg(151), // #a6e3a1
        yellow: fg(223), // #f9e2af
        peach: fg(216), // #fab387
        red: fg(211), // #f38ba8
        teal: fg(115), // #94e2d5
        blue: fg(111), // #89b4fa
        sapphire: fg(117), // #74c7ec
        lavender: fg(147), // #b4befe
        flamingo: fg(224), // #f2cdcd
        maroon: fg(217), // #eba0ac
        overlay: fg(243), // #6c7086
        surface: fg(238), // #313244
        text: fg(189), // #cdd6f4
    },
    dracula: {
        green: fg(85), // #50fa7b
        yellow: fg(228), // #f1fa8c
        peach: fg(215), // #ffb86c
        red: fg(210), // #ff5555
        teal: fg(123), // #8be9fd
        blue: fg(141), // #bd93f9
        sapphire: fg(117), // #81a1c1 — frost
        lavender: fg(147), // #b4befe
        flamingo: fg(224), // #f2cdcd
        maroon: fg(212), // #ff79c6
        overlay: fg(243), // #6c7086
        surface: fg(237), // #313244
        text: fg(255), // #f8f8f2
    },
    nord: {
        green: fg(149), // #a3be8c
        yellow: fg(223), // #ebcb8b
        peach: fg(173), // #d08770
        red: fg(167), // #bf616a
        teal: fg(117), // #88c0d0
        blue: fg(109), // #81a1c1
        sapphire: fg(117), // #88c0d0
        lavender: fg(147), // #b4befe
        flamingo: fg(224), // #f2cdcd
        maroon: fg(175), // #b48ead
        overlay: fg(243), // #4c566a
        surface: fg(238), // #2e3440
        text: fg(189), // #eceff4
    },
};
function loadTheme() {
    const name = (process.env.CC_HUD_THEME ?? 'catppuccin').toLowerCase();
    return THEMES[name] ?? THEMES.catppuccin;
}
const C = loadTheme();
// — Bar config —
const BAR_WIDTH = 10;
const BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];
const TRACK_CHAR = '░';
function color(percent) {
    if (percent <= 50)
        return C.green;
    if (percent <= 70)
        return C.yellow;
    if (percent <= 85)
        return C.peach;
    return C.red;
}
function progressBar(percent) {
    // null = current_usage not yet populated (start of session or just after /compact)
    // — render an empty track + dim em-dash so it doesn't look like context reset.
    if (percent === null) {
        return `${C.surface}${TRACK_CHAR.repeat(BAR_WIDTH)}${RESET} ${C.overlay}—%${RESET}`;
    }
    const clamped = Math.max(0, Math.min(100, percent));
    const total = (clamped / 100) * BAR_WIDTH;
    const full = Math.floor(total);
    const frac = Math.round((total - full) * 8);
    const empty = BAR_WIDTH - full - (frac > 0 ? 1 : 0);
    const c = color(clamped);
    const bar = c + '█'.repeat(full) +
        (frac > 0 ? BLOCKS[frac] : '') +
        RESET + C.surface +
        TRACK_CHAR.repeat(Math.max(0, empty)) +
        RESET;
    return `${bar} ${c}${clamped}%${RESET}`;
}
function countdownColor(ms) {
    const hours = ms / 3_600_000;
    if (hours >= 24)
        return C.sapphire;
    if (hours >= 3)
        return C.lavender;
    if (hours >= 0.5)
        return C.flamingo;
    return C.maroon;
}
function formatCountdown(resetsAt) {
    if (resetsAt == null)
        return null;
    const ms = resetsAt - Date.now();
    if (ms <= 0)
        return null;
    const minutes = ms / 60_000;
    const c = countdownColor(ms);
    if (minutes < 60)
        return { text: `${Math.round(minutes)}m`, color: c };
    const hours = ms / 3_600_000;
    const fmtNum = (n) => { const r = n.toFixed(1); return r.endsWith('.0') ? r.slice(0, -2) : r; };
    if (hours < 24)
        return { text: `${fmtNum(hours)}h`, color: c };
    const days = ms / 86_400_000;
    return { text: `${fmtNum(days)}d`, color: c };
}
function rateSegment(label, percent, resetsAt) {
    if (percent == null)
        return null;
    const clamped = Math.round(Math.max(0, Math.min(100, percent)));
    const c = color(clamped);
    const cd = formatCountdown(resetsAt);
    const suffix = cd ? ` ${C.overlay}(${RESET}${cd.color}${cd.text}${RESET}${C.overlay})${RESET}` : '';
    return `${C.overlay}${label}:${RESET}${c}${clamped}%${RESET}${suffix}`;
}
function agentSegment(agents) {
    if (agents.length === 0)
        return null;
    const parts = agents.slice(0, 3).map(a => {
        const model = a.model ? ` ${C.overlay}[${a.model}]${RESET}` : '';
        return `${C.teal}◐${RESET} ${C.text}${a.type}${RESET}${model}`;
    });
    return parts.join(' ');
}
export function render(data) {
    const compact = process.env.CC_HUD_COMPACT === '1';
    const segments = [];
    // Model + context bar (variant suffix lives here — it describes context capacity)
    const variant = data.modelVariant ? ` ${C.overlay}(${data.modelVariant})${RESET}` : '';
    const effort = data.effortLevel ? ` ${C.overlay}(${data.effortLevel})${RESET}` : '';
    segments.push(`${C.overlay}[${RESET}${C.blue}${data.model}${RESET}${effort}${C.overlay}]${RESET} ${progressBar(data.contextPercent)}${variant}`);
    // Compact mode: model + context bar only
    if (compact) {
        return segments.join(` ${C.overlay}│${RESET} `);
    }
    // Agents (if any)
    const agentStr = agentSegment(data.agents);
    if (agentStr)
        segments.push(agentStr);
    // Rate limits & quotas (up to three segments: 5h/滚动, 7d/每周, 月)
    const r5 = rateSegment('5h', data.fiveHourPercent, data.fiveHourResetsAt);
    const r7 = rateSegment('7d', data.sevenDayPercent, data.sevenDayResetsAt);
    const rm = rateSegment('mo', data.monthlyPercent, data.monthlyResetsAt);
    const rateParts = [r5, r7, rm].filter((s) => s !== null);
    if (rateParts.length > 0) {
        segments.push(rateParts.join(` ${C.overlay}│${RESET} `));
    }
    // Extra (generic pluggable segment, e.g. balance for non-Anthropic backends)
    if (data.extra) {
        segments.push(`${C.teal}${data.extra}${RESET}`);
    }
    return segments.join(` ${C.overlay}│${RESET} `);
}
