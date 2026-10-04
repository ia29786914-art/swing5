import type { StockAnalysis, StockRaw, Strategy, TradePlan } from "./types";
import { atr, last, macd, pct, rsi, sma } from "./indicators";
import { chanAnalysis } from "./hourly";

const lastN = (arr: number[], n: number) => arr.slice(-n);

export function analyzeStock(raw: StockRaw): StockAnalysis {
  const bars = raw.bars;
  const closes = bars.map((b) => b.c);
  const vols = bars.map((b) => b.v);
  const n = bars.length;

  const close = closes[n - 1];
  const prevClose = closes[n - 2];
  const changePct = pct(close, prevClose);

  const ma20Arr = sma(closes, 20);
  const ma50Arr = sma(closes, 50);
  const rsiArr = rsi(closes, 14);
  const { hist: macdHistArr } = macd(closes);
  const atrArr = atr(bars, 14);

  const ma20 = last(ma20Arr);
  const ma50 = last(ma50Arr);
  const rsiVal = last(rsiArr);
  const macdHist = last(macdHistArr);
  const macdPrev = macdHistArr[n - 4] ?? macdHist;
  const macdRising = macdHist > macdPrev;
  const atrVal = last(atrArr);

  const high20 = Math.max(...lastN(bars.map((b) => b.h), 20));
  const distHigh20Pct = pct(close, high20);
  const distMa20Pct = pct(close, ma20);

  const avgVol20 = lastN(vols, 21).slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = vols[n - 1] / avgVol20;

  const change20d = pct(close, closes[n - 21]);

  // ----- strategy detection (prioritized) -----
  const nearHigh = distHigh20Pct > -2.5;
  const upDay = close > bars[n - 1].o;
  const strongVol = volRatio >= 1.5;
  const nearMa20 = Math.abs(distMa20Pct) < 1.5;
  const quietVol = volRatio < 0.9;
  const uptrend = close > ma50 && ma20 > ma50;
  const priorGain = change20d > 4;

  let strategy: Strategy = "none";
  let signalLabel = "观望";
  let signalDetail = "暂无符合 ≤5 天短线的标准 setups，继续观察。";

  if (nearHigh && strongVol && upDay && close > ma20) {
    strategy = "breakout";
    signalLabel = "突破买点";
    signalDetail = `放量(${volRatio.toFixed(1)}×)站上 20 日新高区域，短线动能启动，2-3 日内顺势跟进。`;
  } else if (uptrend && nearMa20 && quietVol && rsiVal > 42 && rsiVal < 60 && priorGain) {
    strategy = "pullback";
    signalLabel = "缩量回踩";
    signalDetail = "上升趋势中回踩 MA20 且缩量，回踩不破即是低吸点，持股 2-4 天博反弹延续。";
  } else if (rsiVal < 38 && upDay && strongVol) {
    strategy = "reversal";
    signalLabel = "放量反转";
    signalDetail = `超卖区(RSI ${rsiVal.toFixed(0)})放量收阳，短线超跌反弹窗口，快进快出 1-3 天。`;
  } else if (uptrend && rsiVal >= 55 && rsiVal <= 72 && macdHist > 0 && macdRising && change20d > 6) {
    strategy = "momentum";
    signalLabel = "趋势动量";
    signalDetail = "均线多头 + MACD 红柱放大，趋势中段上车，3-5 天持有，跌破 MA20 离场。";
  }

  // ----- score (0-100) -----
  let score = 0;
  score += Math.min(25, Math.max(0, (rsiVal - 35) * 0.7)); // RSI sweet spot
  score += Math.min(20, volRatio * 6); // volume confirmation, cap 20
  if (macdHist > 0) score += 12;
  if (macdRising) score += 6;
  if (close > ma20) score += 8;
  if (close > ma50) score += 8;
  if (strategy === "breakout") score += 15;
  if (strategy === "pullback") score += 12;
  if (strategy === "reversal") score += 10;
  if (strategy === "momentum") score += 12;
  score += Math.min(8, Math.max(0, change20d * 0.5));
  score = Math.round(Math.min(99, score));
  if (strategy === "none") score = Math.min(score, 49);

  // ----- trade plan (holding <= 5 days) -----
  const atrPct = (atrVal / close) * 100;
  let stopMult = 1.5;
  let targetMult = 2.6;
  let holdDays = 3;
  if (strategy === "breakout") {
    stopMult = 1.2;
    targetMult = 2.4;
    holdDays = 3;
  } else if (strategy === "pullback") {
    stopMult = 1.4;
    targetMult = 2.2;
    holdDays = 4;
  } else if (strategy === "reversal") {
    stopMult = 1.8;
    targetMult = 3.0;
    holdDays = 2;
  } else if (strategy === "momentum") {
    stopMult = 1.6;
    targetMult = 3.2;
    holdDays = 5;
  }

  const entry = close;
  let stop = entry - atrVal * stopMult;
  // never allow stop above recent structure for breakout (below breakout bar low)
  if (strategy === "breakout") stop = Math.min(stop, bars[n - 1].l - atrVal * 0.3);
  let target = entry + atrVal * targetMult;
  if (strategy === "reversal") target = Math.min(target, high20 * 0.995); // reversal plays target prior resistance

  const riskPerShare = entry - stop;
  const rewardPerShare = target - entry;
  const rr = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  const plan: TradePlan = {
    entry, stop, target, riskPerShare, rewardPerShare, rr,
    atr: atrVal, atrPct, holdDays,
    plan: [
      { day: 1, action: "建仓", note: signalDetail },
      { day: 2, action: "持股观察", note: "不破止损继续持有；放量滞涨可减半仓锁定利润。" },
      { day: 3, action: "移动止损", note: "将止损上移至成本价（保本）；剩余仓位博取目标价。" },
      { day: Math.min(4, holdDays), action: holdDays >= 4 ? "减仓 / 评估" : "到期前评估", note: "未达目标则逢高离场，绝不恋战。" },
      { day: 5, action: "强制离场", note: "第 5 个交易日收盘前无条件清仓——本工具纪律：持仓 ≤ 5 天。" },
    ],
  };

  return {
    raw, close, changePct, change20d, rsi: rsiVal, macdHist, macdRising,
    ma20, ma50, aboveMa20: close > ma20, aboveMa50: close > ma50,
    distMa20Pct, distHigh20Pct, high20, volRatio, atrPct,
    sector: raw.sector, strategy, signalLabel, signalDetail, score, plan,
    chan: chanAnalysis(raw.bars),
  };
}

export interface MarketStats {
  avgChange20d: number;
  breadthPct: number; // % of stocks above MA50
  avgScore: number;
  hotSector: string;
  date: string;
}

export function marketStats(all: StockAnalysis[]): MarketStats {
  const avgChange20d = all.reduce((a, s) => a + s.change20d, 0) / all.length;
  const breadthPct = (all.filter((s) => s.aboveMa50).length / all.length) * 100;
  const avgScore = all.reduce((a, s) => a + s.score, 0) / all.length;
  const bySector = new Map<string, number>();
  all.forEach((s) => bySector.set(s.sector, (bySector.get(s.sector) ?? 0) + s.change20d));
  const hotSector = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
  const d = new Date();
  return {
    avgChange20d, breadthPct, avgScore, hotSector,
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  };
}

export const STRATEGY_META: Record<Strategy, { label: string; color: string }> = {
  breakout: { label: "突破买点", color: "text-emerald-400" },
  pullback: { label: "缩量回踩", color: "text-sky-400" },
  reversal: { label: "放量反转", color: "text-amber-400" },
  momentum: { label: "趋势动量", color: "text-violet-400" },
  none: { label: "观望", color: "text-zinc-500" },
};
