import { useMemo, useState } from "react";
import "@/App.css";
import dataJson from "@/data/stocks.json";
import type { JournalEntry, StockAnalysis, StockRaw } from "@/lib/types";
import { analyzeStock, marketStats, STRATEGY_META } from "@/lib/engine";
import { analyzeHourly, type HourlyAnalysis } from "@/lib/hourly";
import { fmtPct } from "@/lib/indicators";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { FilterPanel, type Filters } from "@/components/FilterPanel";
import { ScreenerTable } from "@/components/ScreenerTable";
import { StockSheet } from "@/components/StockSheet";
import { HourlyTable } from "@/components/HourlyTable";
import { HourlySheet } from "@/components/HourlySheet";
import { Journal } from "@/components/Journal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, Gauge, Flame } from "lucide-react";

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold font-mono ${tone ?? "text-zinc-100"}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

export default function App() {
  const stocks = useMemo(() => (dataJson as { stocks: StockRaw[] }).stocks, []);
  const analyses = useMemo(() => stocks.map(analyzeStock), [stocks]);
  const byTicker = useMemo(() => new Map(analyses.map((a) => [a.raw.ticker, a])), [analyses]);
  const stats = useMemo(() => marketStats(analyses), [analyses]);
  const sectors = useMemo(() => [...new Set(analyses.map((a) => a.sector))], [analyses]);

  const [filters, setFilters] = useState<Filters>({
    strategy: "all",
    minScore: 40,
    maxPrice: 10000,
    minVolRatio: 0,
    rsiMin: 5,
    rsiMax: 95,
    sector: "all",
    query: "",
  });
  const [watchlist, setWatchlist] = useLocalStorage<string[]>("swing5_watchlist", []);
  const [journal, setJournal] = useLocalStorage<JournalEntry[]>("swing5_journal", []);
  const [selected, setSelected] = useState<StockAnalysis | null>(null);
  const [hourlySelected, setHourlySelected] = useState<HourlyAnalysis | null>(null);

  const hourlyAnalyses = useMemo(() => stocks.map(analyzeHourly), [stocks]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return analyses
      .filter((s) => filters.strategy === "all" || s.strategy === filters.strategy)
      .filter((s) => s.score >= filters.minScore)
      .filter((s) => s.close <= filters.maxPrice)
      .filter((s) => s.volRatio >= filters.minVolRatio)
      .filter((s) => s.rsi >= filters.rsiMin && s.rsi <= filters.rsiMax)
      .filter((s) => filters.sector === "all" || s.sector === filters.sector)
      .filter((s) => !q || s.raw.ticker.toLowerCase().includes(q) || s.raw.name.toLowerCase().includes(q))
      .sort((a, b) => b.score - a.score);
  }, [analyses, filters]);

  const signalCount = useMemo(() => {
    const c = { breakout: 0, pullback: 0, reversal: 0, momentum: 0 };
    analyses.forEach((s) => {
      if (s.strategy !== "none") c[s.strategy]++;
    });
    return c;
  }, [analyses]);

  const toggleWatch = (t: string) =>
    setWatchlist((w) => (w.includes(t) ? w.filter((x) => x !== t) : [...w, t]));

  const addToJournal = (s: StockAnalysis, shares: number) => {
    const entry: JournalEntry = {
      id: `${Date.now()}-${s.raw.ticker}`,
      ticker: s.raw.ticker,
      name: s.raw.name,
      entryDate: new Date().toISOString().slice(0, 10),
      entryPrice: s.plan.entry,
      shares,
      stopPrice: s.plan.stop,
      targetPrice: s.plan.target,
      status: "open",
    };
    setJournal((j) => [entry, ...j]);
    setSelected(null);
  };

  const closeTrade = (id: string, exitPrice: number) =>
    setJournal((j) =>
      j.map((e) =>
        e.id === id
          ? { ...e, status: "closed" as const, exitDate: new Date().toISOString().slice(0, 10), exitPrice }
          : e
      )
    );
  const removeTrade = (id: string) => setJournal((j) => j.filter((e) => e.id !== id));

  const watchRows = watchlist.map((t) => byTicker.get(t)).filter((x): x is StockAnalysis => !!x);

  const hourlySignals = useMemo(() => {
    let chan = 0;
    let squeezeFire = 0;
    let squeezed = 0;
    let macdGold = 0;
    hourlyAnalyses.forEach((h) => {
      if (h.chanSignal) chan++;
      if (h.squeeze.justReleased && h.squeeze.releaseDir === "long") squeezeFire++;
      else if (h.squeeze.isSqueezed) squeezed++;
      if (h.macdState === "金叉") macdGold++;
    });
    return { chan, squeezeFire, squeezed, macdGold };
  }, [hourlyAnalyses]);

  const hourlyRows = useMemo(
    () => hourlyAnalyses.filter((h) => h.score >= 30).sort((a, b) => b.score - a.score),
    [hourlyAnalyses]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Swing<span className="text-sky-400">5</span>
              <span className="ml-3 text-sm font-normal text-zinc-500">美股短线选股工具 · 持仓纪律 ≤ 5 天</span>
            </h1>
            <p className="text-xs text-zinc-600 mt-1">
              真實行情 · 數據源 Yahoo Finance · 日線近 3 年 / 小時線近 1 年 · 覆蓋納指100 + 道指30 成份股 · 信號僅為技術演示，非投資建議
            </p>
          </div>
          <div className="flex gap-2">
            {(Object.keys(signalCount) as (keyof typeof signalCount)[]).map((k) => (
              <Badge key={k} variant="outline" className="border-zinc-700 text-zinc-400">
                <span className={STRATEGY_META[k].color}>{STRATEGY_META[k].label}</span>
                <span className="ml-1.5 font-mono">{signalCount[k]}</span>
              </Badge>
            ))}
          </div>
        </header>

        {/* Market stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat icon={<Activity size={12} />} label="樣本 20 日平均漲跌" value={fmtPct(stats.avgChange20d)} tone={stats.avgChange20d >= 0 ? "text-emerald-400" : "text-red-400"} sub={`${analyses.length} 只成份股等權`} />
          <Stat icon={<Gauge size={12} />} label="市场广度（站上 MA50）" value={`${stats.breadthPct.toFixed(0)}%`} tone={stats.breadthPct >= 50 ? "text-emerald-400" : "text-red-400"} sub="短线环境指标" />
          <Stat icon={<TrendingUp size={12} />} label="平均短线评分" value={stats.avgScore.toFixed(0)} sub="满分 99" />
          <Stat icon={<Flame size={12} />} label="最强板块" value={stats.hotSector} sub="20 日累计涨幅最高" />
        </div>

        <Tabs defaultValue="hourly">
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-4">
            <TabsTrigger value="hourly">
              小时级雷达
              {hourlySignals.chan + hourlySignals.squeezeFire > 0 && (
                <Badge className="ml-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/20 border-0 px-1.5">
                  {hourlySignals.chan + hourlySignals.squeezeFire}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="screener">日线雷达</TabsTrigger>
            <TabsTrigger value="watchlist">自选股 ({watchlist.length})</TabsTrigger>
            <TabsTrigger value="journal">交易日志 ({journal.filter((e) => e.status === "open").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="hourly" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
              <span className="text-zinc-500">小时级信号池：</span>
              <Badge variant="outline" className="border-rose-500/30 text-rose-300">缠论买点 {hourlySignals.chan}</Badge>
              <Badge variant="outline" className="border-sky-500/30 text-sky-300">Squeeze 释放 {hourlySignals.squeezeFire}</Badge>
              <Badge variant="outline" className="border-amber-500/30 text-amber-300">挤压蓄势 {hourlySignals.squeezed}</Badge>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">MACD 金叉 {hourlySignals.macdGold}</Badge>
              <span className="ml-auto text-zinc-600">缠论底背驰=一买 · 回试不破=二买 · 止损取笔低点 · 持仓 1-3 天 · 评分≥45 为强信号，30-44 为观察池</span>
            </div>
            <HourlyTable rows={hourlyRows} onSelect={setHourlySelected} />
          </TabsContent>

          <TabsContent value="screener" className="space-y-4">
            <FilterPanel filters={filters} onChange={setFilters} sectors={sectors} count={filtered.length} />
            <ScreenerTable rows={filtered} watchlist={watchlist} onToggleWatch={toggleWatch} onSelect={setSelected} />
          </TabsContent>

          <TabsContent value="watchlist">
            {watchRows.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-16 text-center text-sm text-zinc-500">
                自选股为空。在选股雷达里点击星标 ★ 把股票加到这里。
              </div>
            ) : (
              <div className="space-y-4">
                <FilterPanel filters={filters} onChange={setFilters} sectors={sectors} count={filtered.length} />
                <ScreenerTable rows={watchRows} watchlist={watchlist} onToggleWatch={toggleWatch} onSelect={setSelected} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="journal">
            <Journal entries={journal} analyses={byTicker} onClose={closeTrade} onRemove={removeTrade} />
          </TabsContent>
        </Tabs>
      </div>

      <StockSheet stock={selected} onClose={() => setSelected(null)} onAddToJournal={addToJournal} />
      <HourlySheet h={hourlySelected} onClose={() => setHourlySelected(null)} />
    </div>
  );
}
