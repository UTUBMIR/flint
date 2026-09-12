export const termColors = {
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
    dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
    boldBlue: (s: string) => `\x1b[1;34m${s}\x1b[0m`,
    boldGreen: (s: string) => `\x1b[1;32m${s}\x1b[0m`,
    reset: "\x1b[0m",
    clearScreen: "\x1b[2J\x1b[H\x1b[3J",
    clearScrollback: "\x1b[3J"
};

export const termSymbols = {
    arrow: "->",
    installed: "[*]",
    notInstalled: "[ ]",
    ok: "[OK]",
    fail: "[FAIL]",
    plus: "+",
    minus: "-",
    prompt: "$"
};

export function colorize(color: keyof typeof termColors, text: string): string {
    const fn = termColors[color];
    return typeof fn === "function" ? (fn as (s: string) => string)(text) : text;
}
