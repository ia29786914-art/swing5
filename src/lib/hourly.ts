import type { Bar, StockRaw } from "./types";
import { atr, ema, last, macd, pct, sma } from "./indicators";

// ---------- Bollinger Bands ----------
export interface Bands {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  pctB: number; // (close - lower) / (upper - lower)
  width: number; // (upper - lower) / mid
}

export function bollinger(closes: number[], period = 20, mult = 2): Bands {
  const mid = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (mid[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += (closes[j] - (mid[i] as number)) ** 2;
    const sd = Math.sqrt(sum / period);
    upper.push((mid[i] as number) + mult * sd);
    lower.push((mid[i] as number) - mult * sd);
  }
  const n = closes.length - 1;
  const u = upper[n] as number;
  const l = lower[n] as number;
  return {
    mid, upper, lower,
    pctB: u > l ? (closes[n] - l) / (u - l) : 0.5,
    width: (mid[n] as number) > 0 ? (u - l) / (mid[n] as number) : 0,
  };
}

// ---------- Keltner Channel ----------
export interface Keltner {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  atr: (number | null)[];
}

export function keltner(bars: Bar[], period = 20, atrMult = 1.5): Keltner {
  const closes = bars.map((b) => b.c);
  const mid = ema(closes, period);
  const atrArr = atr(bars, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (mid[i] === null || atrArr[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      upper.push((mid[i] as number) + atrMult * (atrArr[i] as number));
      lower.push((mid[i] as number) - atrMult * (atrArr[i] as number));
    }
  }
  return { mid, upper, lower, atr: atrArr };
}

// ---------- TTM-style Squeeze: BB inside KC ----------
export interface SqueezeState {
  on: boolean[];          // per-bar: BB fully inside KC
  isSqueezed: boolean;    // current bar squeezed
  justReleased: boolean;  // squeeze released on current bar
  releaseDir: "long" | "short" | null;
  squeezeBars: number;    // consecutive squeezed bars up to now
}

export function squeeze(bars: Bar[]): SqueezeState {
  const closes = bars.map((b) => b.c);
  const bb = bollinger(closes);
  const kc = keltner(bars);
  const on: boolean[] = closes.map((_, i) => {
    if (bb.upper[i] === null || kc.upper[i] === null) return false;
    return (bb.upper[i] as number) < (kc.upper[i] as number) &&
           (bb.lower[i] as number) > (kc.lower[i] as number);
  });
  const n = closes.length - 1;
  let cnt = 0;
  for (let i = n; i >= 0 && on[i]; i--) cnt++;
  const justReleased = n >= 1 && on[n - 1] && !on[n];
  let releaseDir: "long" | "short" | null = null;
  if (justReleased) {
    const mid = kc.mid[n] as number;
    releaseDir = closes[n] >= mid ? "long" : "short";
  }
  return { on, isSqueezed: on[n], justReleased, releaseDir, squeezeBars: cnt };
}

// ---------- Chan theory (缠论): fractals, pens (笔), divergence (背驰) ----------
export interface Fractal {
  type: "top" | "bottom";
  idx: number;
  price: number;
}

export function findFractals(bars: Bar[]): Fractal[] {
  const out: Fractal[] = [];
  for (let i = 2; i < bars.length - 2; i++) {
    const b = bars[i];
    const top =
      b.h > bars[i - 1].h && b.h > bars[i - 2].h && b.h > bars[i + 1].h && b.h > bars[i + 2].h &&
      b.l > bars[i - 1].l && b.l > bars[i + 2].l;
    const bottom =
      b.l < bars[i - 1].l && b.l < bars[i - 2].l && b.l < bars[i + 1].l && b.l < bars[i + 2].l &&
      b.h < bars[i - 1].h && b.h < bars[i + 2].h;
    if (top) out.push({ type: "top", idx: i, price: b.h });
    if (bottom) out.push({ type: "bottom", idx: i, price: b.l });
  }
  return out;
}

/** Build pens (笔): alternating fractals, >= 4 bars between neighbors, keep the more extreme of same type. */
export function buildPens(fractals: Fractal[], minGap = 4): Fractal[] {
  const pens: Fractal[] = [];
  for (const f of fractals) {
    if (pens.length === 0) {
      pens.push(f);
      continue;
    }
    const lastP = pens[pens.length - 1];
    if (f.type === lastP.type) {
      // keep the more extreme fractal of the same type
      if (f.type === "top" ? f.price > lastP.price : f.price < lastP.price) pens[pens.length - 1] = f;
      continue;
    }
    if (f.idx - lastP.idx < minGap) {
      // too close: keep whichever extends the move more
      continue;
    }
    pens.push(f);
  }
  return pens;
}

export interface ChanPoint {
  type: "一买" | "二买" | "一卖" | "二卖";
  idx: number;
  price: number;
}

export interface Zhongshu {
  startIdx: number;
  endIdx: number;
  zd: number; // 中枢下沿 (max of lows)
  zg: number; // 中枢上沿 (min of highs)
  direction: "up" | "down"; // entering direction
}

export interface ChanResult {
  pens: Fractal[];              // filtered pens
  fractals: Fractal[];          // all raw fractals (for chart markers)
  bottomDivergence: boolean;    // 底背驰: price lower low, MACD DIF higher low
  topDivergence: boolean;
  divergenceIdx: number | null; // index of the confirming (latest) pivot
  secondBuy: boolean;           // 二买: pullback holds above the divergence low
  secondBuyIdx: number | null;
  topDivergenceIdx: number | null;
  lastPenLow: number | null;
  lastPenHigh: number | null;
  buyPoints: ChanPoint[];
  sellPoints: ChanPoint[];
  zhongshu: Zhongshu[];
}

/** 中枢: three consecutive pens overlapping; consecutive trios merge into one zone. */
function buildZhongshu(pens: Fractal[]): Zhongshu[] {
  const out: (Zhongshu & { penEnd: number })[] = [];
  for (let i = 0; i + 2 < pens.length; i++) {
    const trio = [pens[i], pens[i + 1], pens[i + 2]];
    const tops = trio.filter((p) => p.type === "top").map((p) => p.price);
    const bots = trio.filter((p) => p.type === "bottom").map((p) => p.price);
    if (!tops.length || !bots.length) continue;
    const zg = Math.min(...tops);
    const zd = Math.max(...bots);
    if (zg <= zd) continue;
    const prev = out[out.length - 1];
    if (prev && prev.penEnd === i + 1) {
      prev.endIdx = pens[i + 2].idx;
      prev.penEnd = i + 2;
      prev.zd = Math.max(prev.zd, zd);
      prev.zg = Math.min(prev.zg, zg);
    } else {
      out.push({
        startIdx: pens[i].idx,
        endIdx: pens[i + 2].idx,
        zd, zg,
        direction: pens[i].type === "bottom" ? "up" : "down",
        penEnd: i + 2,
      });
    }
  }
  return out.map(({ penEnd: _penEnd, ...z }) => z);
}

export function chanAnalysis(bars: Bar[]): ChanResult {
  const closes = bars.map((b) => b.c);
  const { line: dif } = macd(closes);
  const fractals = findFractals(bars);
  const pens = buildPens(fractals);

  const bottoms = pens.filter((p) => p.type === "bottom");
  const tops = pens.filter((p) => p.type === "top");

  // ---------- full-history scan of all qualifying buy/sell points ----------
  const buyPoints: ChanPoint[] = [];
  const sellPoints: ChanPoint[] = [];
  const RECENT = 40; // bars; points within this window count as "active" signals for the screener

  // 一买: every pen-bottom that undercuts the previous pen-bottom while MACD DIF rises
  const firstBuyIdxs: number[] = [];
  for (let i = 1; i < bottoms.length; i++) {
    const b1 = bottoms[i - 1];
    const b2 = bottoms[i];
    const dif1 = dif[b1.idx];
    const dif2 = dif[b2.idx];
    if (b2.price < b1.price * 0.999 && dif1 !== null && dif2 !== null && dif2 > dif1) {
      buyPoints.push({ type: "一买", idx: b2.idx, price: bars[b2.idx].l });
      firstBuyIdxs.push(b2.idx);
    }
  }
  // 二买: first higher pen-bottom after each 一买 (aborted if a lower low prints first)
  for (const fb of firstBuyIdxs) {
    const fbPrice = bars[fb].l;
    const difFb = dif[fb];
    for (const b3 of bottoms) {
      if (b3.idx <= fb) continue;
      if (b3.price < fbPrice * 0.999) break; // 一买 failed
      if (b3.price > fbPrice * 1.001) {
        const d3 = dif[b3.idx];
        if (d3 !== null && difFb !== null && d3 > difFb) {
          buyPoints.push({ type: "二买", idx: b3.idx, price: bars[b3.idx].l });
        }
        break; // only the first higher low per 一买
      }
    }
  }

  // 一卖: every pen-top that exceeds the previous pen-top while MACD DIF falls
  const firstSellIdxs: number[] = [];
  for (let i = 1; i < tops.length; i++) {
    const t1 = tops[i - 1];
    const t2 = tops[i];
    const dif1 = dif[t1.idx];
    const dif2 = dif[t2.idx];
    if (t2.price > t1.price * 1.001 && dif1 !== null && dif2 !== null && dif2 < dif1) {
      sellPoints.push({ type: "一卖", idx: t2.idx, price: bars[t2.idx].h });
      firstSellIdxs.push(t2.idx);
    }
  }
  // 二卖: first lower pen-top after each 一卖 (aborted if a higher high prints first)
  for (const fs of firstSellIdxs) {
    const fsPrice = bars[fs].h;
    const difFs = dif[fs];
    for (const t3 of tops) {
      if (t3.idx <= fs) continue;
      if (t3.price > fsPrice * 1.001) break; // 一卖 failed
      if (t3.price < fsPrice * 0.999) {
        const d3 = dif[t3.idx];
        if (d3 !== null && difFs !== null && d3 < difFs) {
          sellPoints.push({ type: "二卖", idx: t3.idx, price: bars[t3.idx].h });
        }
        break;
      }
    }
  }

  buyPoints.sort((a, b) => a.idx - b.idx);
  sellPoints.sort((a, b) => a.idx - b.idx);

  // "active" signals = most recent point within the recency window (drives the screener)
  const n = bars.length - 1;
  const lastBuy = [...buyPoints].reverse().find((p) => n - p.idx <= RECENT);
  const lastSell = [...sellPoints].reverse().find((p) => n - p.idx <= RECENT);
  const bottomDivergence = !!lastBuy;
  const divergenceIdx = lastBuy?.idx ?? null;
  const secondBuy = !!lastBuy && lastBuy.type === "二买";
  const secondBuyIdx = secondBuy ? lastBuy.idx : null;
  const topDivergence = !!lastSell;
  const topDivergenceIdx = lastSell?.idx ?? null;

  return {
    pens, fractals, bottomDivergence, topDivergence, divergenceIdx, secondBuy, secondBuyIdx, topDivergenceIdx,
    lastPenLow: bottoms.length ? bottoms[bottoms.length - 1].price : null,
    lastPenHigh: tops.length ? tops[tops.length - 1].price : null,
    buyPoints, sellPoints,
    zhongshu: buildZhongshu(pens),
  };
}

// ---------- composite hourly analysis ----------
export type MacdState = "金叉" | "红柱放大" | "绿柱缩短" | "死叉" | null;

export interface HourlyAnalysis {
  raw: StockRaw;
  bars: Bar[];
  close: number;
  changePct: number;
  atrVal: number;
  atrPct: number;
  chan: ChanResult;
  macdState: MacdState;
  macdHist: number;
  squeeze: SqueezeState;
  bbPctB: number;
  bbWidth: number;
  chanSignal: "一买" | "二买" | null;
  signalLabel: string;
  score: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  holdDays: number;
}

export function analyzeHourly(raw: StockRaw): HourlyAnalysis {
  const bars = raw.hourly;
  const closes = bars.map((b) => b.c);
  const n = closes.length - 1;
  const close = closes[n];

  const bb = bollinger(closes);
  const sq = squeeze(bars);
  const chan = chanAnalysis(bars);
  const { hist } = macd(closes);
  const histNow = last(hist);
  const histPrev = hist[n - 3] ?? histNow;

  let macdState: MacdState = null;
  // 金叉: histogram crossed above zero within the last 3 bars
  const crossed = [0, 1, 2].some((k) => {
    const cur = hist[n - k];
    const prev = hist[n - k - 1];
    return cur !== null && prev !== null && cur > 0 && prev <= 0;
  });
  if (crossed) macdState = "金叉";
  else if (histNow > 0 && histNow > histPrev) macdState = "红柱放大";
  else if (histNow < 0 && histNow > histPrev) macdState = "绿柱缩短";

  const chanSignal = chan.bottomDivergence ? "一买" : chan.secondBuy ? "二买" : null;

  // ----- score -----
  let score = 0;
  if (chanSignal === "一买") score += 40;
  else if (chanSignal === "二买") score += 32;
  else if (chan.bottomDivergence) score += 15;
  if (sq.justReleased && sq.releaseDir === "long") score += 22;
  else if (sq.isSqueezed) score += 10;
  if (macdState === "金叉") score += 16;
  else if (macdState === "红柱放大") score += 12;
  else if (macdState === "绿柱缩短") score += 8;
  if (bb.pctB > 0.05 && bb.pctB < 0.65) score += 8;
  if (close > (last(ema(closes, 20)) ?? close)) score += 6;
  if (chan.lastPenLow !== null && close > chan.lastPenLow) score += 5;
  score = Math.min(99, Math.round(score));
  const hasSignal = chanSignal !== null || (sq.justReleased && sq.releaseDir === "long") || macdState === "金叉";
  if (!hasSignal) score = Math.min(score, 55);

  // ----- plan: hold 1-3 days -----
  const atrArr = atr(bars, 14);
  const atrVal = last(atrArr);
  const swingLow = chan.lastPenLow ?? close - 2 * atrVal;
  let stop = Math.min(swingLow - 0.3 * atrVal, close - 0.8 * atrVal);
  let risk = close - stop;
  if (risk <= 0 || risk > 3.5 * atrVal) {
    stop = close - 2 * atrVal;
    risk = close - stop;
  }
  const target = close + 2.2 * risk;
  const rr = risk > 0 ? 2.2 : 0;

  let holdDays = 2;
  if (chanSignal === "一买") holdDays = 3;
  else if (chanSignal === "二买") holdDays = 2;
  else if (sq.justReleased) holdDays = 2;
  else if (macdState === "金叉") holdDays = 2;

  const labelParts: string[] = [];
  if (chanSignal) labelParts.push(`缠论${chanSignal}`);
  if (sq.justReleased && sq.releaseDir === "long") labelParts.push("Squeeze释放");
  else if (sq.isSqueezed) labelParts.push("Squeeze挤压");
  if (macdState) labelParts.push(`MACD${macdState}`);

  return {
    raw, bars, close,
    changePct: pct(close, closes[n - 7]),
    atrVal, atrPct: (atrVal / close) * 100,
    chan, macdState, macdHist: histNow, squeeze: sq,
    bbPctB: bb.pctB, bbWidth: bb.width,
    chanSignal,
    signalLabel: labelParts.length ? labelParts.join(" · ") : "观望",
    score, entry: close, stop, target, rr, holdDays,
  };
}
