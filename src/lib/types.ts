import type { ChanResult } from "./hourly";

export interface Bar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface StockRaw {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number; // $B
  basePrice: number;
  bars: Bar[];
  hourly: Bar[];
}

export type Strategy = "breakout" | "pullback" | "reversal" | "momentum" | "none";

export interface TradePlan {
  entry: number;
  stop: number;
  target: number;
  riskPerShare: number;
  rewardPerShare: number;
  rr: number; // reward:risk
  atr: number;
  atrPct: number;
  holdDays: number; // suggested max holding days (<=5)
  plan: { day: number; action: string; note: string }[];
}

export interface StockAnalysis {
  raw: StockRaw;
  close: number;
  changePct: number; // today
  change20d: number;
  rsi: number;
  macdHist: number;
  macdRising: boolean;
  ma20: number;
  ma50: number;
  aboveMa20: boolean;
  aboveMa50: boolean;
  distMa20Pct: number;
  distHigh20Pct: number; // distance from 20d high, negative = below
  high20: number;
  volRatio: number; // today vol / 20d avg vol
  atrPct: number;
  sector: string;
  strategy: Strategy;
  signalLabel: string;
  signalDetail: string;
  score: number; // 0-100
  plan: TradePlan;
  chan: ChanResult; // 缠论 structure on daily bars
}

export interface JournalEntry {
  id: string;
  ticker: string;
  name: string;
  entryDate: string; // ISO
  entryPrice: number;
  shares: number;
  stopPrice: number;
  targetPrice: number;
  note?: string;
  status: "open" | "closed";
  exitDate?: string;
  exitPrice?: number;
}
