import type { Bar } from "./types";

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    prev = prev === null ? values[i] : values[i] * k + prev * (1 - k);
    out.push(i >= period - 1 ? prev : null);
  }
  return out;
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = Math.max(diff, 0);
    const l = Math.max(-diff, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

export function macd(closes: number[]): { line: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line: (number | null)[] = closes.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? (fast[i] as number) - (slow[i] as number) : null
  );
  const validStart = line.findIndex((v) => v !== null);
  const valid = line.slice(validStart).map((v) => v as number);
  const sig = ema(valid, 9);
  const signal: (number | null)[] = [...new Array(validStart).fill(null), ...sig];
  const hist = line.map((v, i) => (v !== null && signal[i] !== null ? v - (signal[i] as number) : null));
  return { line, signal, hist };
}

export function atr(bars: Bar[], period = 14): (number | null)[] {
  const trs: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      trs.push(bars[i].h - bars[i].l);
    } else {
      trs.push(
        Math.max(
          bars[i].h - bars[i].l,
          Math.abs(bars[i].h - bars[i - 1].c),
          Math.abs(bars[i].l - bars[i - 1].c)
        )
      );
    }
  }
  return sma(trs, period);
}

export const last = (arr: (number | null)[]): number => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i] as number;
  return NaN;
};

export function pct(a: number, b: number): number {
  return b === 0 ? 0 : ((a - b) / b) * 100;
}

export function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v.toFixed(2);
}

export function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
