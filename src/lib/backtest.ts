// 信號表現追踪：對歷史上每一天重放選股引擎，模擬 ≤5 日持倉計劃的結果。
// 入場價 = 信號日收盤；止損/目標/持倉天數與雷達即時信號完全一致。
// 同日同時觸及止損與目標時保守計為止損；跳空穿越時按開盤價成交。
import type { StockRaw, Strategy } from "./types";
import { computeIndicators, signalAt } from "./engine";

export type Outcome = "win" | "loss" | "timeout" | "open";

export interface TrackedSignal {
  ticker: string;
  name: string;
  sector: string;
  date: string; // 美東日期 YYYY-MM-DD
  strategy: Exclude<Strategy, "none">;
  score: number;
  entry: number;
  stop: number;
  target: number;
  holdDays: number;
  outcome: Outcome;
  exitPrice: number | null;
  exitDay: number; // 實際出場在第幾個交易日
  retPct: number;
  rMultiple: number;
}

const NY_DATE = { timeZone: "America/New_York" } as const;

function etDate(t?: number): string {
  if (t === undefined) return "";
  return new Date(t * 1000).toLocaleDateString("en-CA", NY_DATE);
}

export function runBacktest(stocks: StockRaw[]): TrackedSignal[] {
  const out: TrackedSignal[] = [];
  for (const raw of stocks) {
    const bars = raw.bars;
    const n = bars.length;
    const ind = computeIndicators(bars); // 每只股票只算一次全序列指標
    let i = 60; // 需要 60 根預熱
    while (i < n - 1) {
      const core = signalAt(bars, ind, i + 1);
      i++;
      if (!core || core.strategy === "none") continue;
      const { entry, stop, target, holdDays } = core.plan;
      const risk = entry - stop;
      if (risk <= 0) continue;

      // 倉位冷卻期：同一股票上一筆信號未了結前不再開新倉
      const horizon = Math.min(5, holdDays);
      if (i + horizon >= n) {
        // 數據不足以了結，記為進行中
        out.push({
          ticker: raw.ticker, name: raw.name, sector: raw.sector,
          date: etDate(bars[i - 1].t), strategy: core.strategy, score: core.score,
          entry, stop, target, holdDays: horizon,
          outcome: "open", exitPrice: null, exitDay: 0, retPct: 0, rMultiple: 0,
        });
        i += horizon;
        continue;
      }

      let outcome: Outcome = "timeout";
      let exitPrice = bars[i + horizon - 1].c;
      let exitDay = horizon;
      for (let d = 1; d <= horizon; d++) {
        const b = bars[i + d - 1];
        if (b.o <= stop) {
          outcome = "loss"; exitPrice = b.o; exitDay = d; break;
        }
        if (b.l <= stop) {
          outcome = "loss"; exitPrice = stop; exitDay = d; break;
        }
        if (b.o >= target) {
          outcome = "win"; exitPrice = b.o; exitDay = d; break;
        }
        if (b.h >= target) {
          outcome = "win"; exitPrice = target; exitDay = d; break;
        }
      }
      out.push({
        ticker: raw.ticker, name: raw.name, sector: raw.sector,
        date: etDate(bars[i - 1].t), strategy: core.strategy, score: core.score,
        entry, stop, target, holdDays: horizon,
        outcome, exitPrice, exitDay,
        retPct: ((exitPrice - entry) / entry) * 100,
        rMultiple: (exitPrice - entry) / risk,
      });
      i += horizon; // 冷卻：持倉期內不再開新信號
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface GroupStat {
  count: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  avgRetPct: number;
  avgR: number;
  profitFactor: number;
}

function statOf(trades: TrackedSignal[]): GroupStat {
  const closed = trades.filter((t) => t.outcome !== "open");
  const wins = closed.filter((t) => t.outcome === "win");
  const losses = closed.filter((t) => t.outcome === "loss");
  const timeouts = closed.filter((t) => t.outcome === "timeout");
  const grossWin = closed.reduce((a, t) => a + Math.max(0, t.rMultiple), 0);
  const grossLoss = Math.abs(closed.reduce((a, t) => a + Math.min(0, t.rMultiple), 0));
  return {
    count: closed.length,
    wins: wins.length,
    losses: losses.length,
    timeouts: timeouts.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    avgRetPct: closed.length ? closed.reduce((a, t) => a + t.retPct, 0) / closed.length : 0,
    avgR: closed.length ? closed.reduce((a, t) => a + t.rMultiple, 0) / closed.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
  };
}

export interface PerformanceReport {
  overall: GroupStat;
  openCount: number;
  byStrategy: Partial<Record<Exclude<Strategy, "none">, GroupStat>>;
  byYear: Record<string, GroupStat>;
  recent: TrackedSignal[]; // 最近了結的信號（新→舊）
  /** 累計 R 曲線：按了結日聚合（同日多筆先求和再累計） */
  equity: { date: string; cumR: number }[];
}

export function buildReport(trades: TrackedSignal[]): PerformanceReport {
  const byStrategy: PerformanceReport["byStrategy"] = {};
  (["breakout", "pullback", "reversal", "momentum"] as const).forEach((s) => {
    const g = trades.filter((t) => t.strategy === s);
    if (g.length) byStrategy[s] = statOf(g);
  });
  const byYear: Record<string, GroupStat> = {};
  trades.forEach((t) => {
    const y = t.date.slice(0, 4) || "?";
    if (!byYear[y]) {
      const g = statOf(trades.filter((x) => (x.date.slice(0, 4) || "?") === y));
      byYear[y] = g;
    }
  });
  const recent = trades
    .filter((t) => t.outcome !== "open")
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 40);
  const equity: { date: string; cumR: number }[] = [];
  let cum = 0;
  trades
    .filter((t) => t.outcome !== "open" && t.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((t) => {
      cum += t.rMultiple;
      const lastPt = equity[equity.length - 1];
      if (lastPt && lastPt.date === t.date) lastPt.cumR = cum;
      else equity.push({ date: t.date, cumR: cum });
    });
  return {
    overall: statOf(trades),
    openCount: trades.filter((t) => t.outcome === "open").length,
    byStrategy, byYear, recent, equity,
  };
}

// 以 stocks 數組身份做緩存，避免每次渲染重算
const cache = new WeakMap<StockRaw[], PerformanceReport>();
export function performanceReport(stocks: StockRaw[]): PerformanceReport {
  let r = cache.get(stocks);
  if (!r) {
    r = buildReport(runBacktest(stocks));
    cache.set(stocks, r);
  }
  return r;
}
