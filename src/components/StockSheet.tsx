import { useMemo, useState } from "react";
import type { StockAnalysis } from "@/lib/types";
import { STRATEGY_META } from "@/lib/engine";
import { fmtPct, fmtPrice } from "@/lib/indicators";
import { analyzeHourly } from "@/lib/hourly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CandleChart } from "./CandleChart";
import { HourlyChart } from "./HourlyChart";
import { CircleDollarSign, CalendarClock, Play, ArrowLeft } from "lucide-react";

interface Props {
  stock: StockAnalysis | null;
  onClose: () => void;
  onAddToJournal: (s: StockAnalysis, shares: number) => void;
}

function Ind({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  return (
    <div className="rounded-lg bg-zinc-900/80 border border-zinc-800 px-3 py-2">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={`text-sm font-mono font-semibold ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}

export function StockSheet({ stock, onClose, onAddToJournal }: Props) {
  const [capital, setCapital] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [view, setView] = useState<"daily" | "hourly">("daily");

  const hourly = useMemo(() => (stock ? analyzeHourly(stock.raw) : null), [stock]);

  const calc = useMemo(() => {
    if (!stock || stock.plan.riskPerShare <= 0) return null;
    const riskDollar = capital * (riskPct / 100);
    const shares = Math.floor(riskDollar / stock.plan.riskPerShare);
    const cost = shares * stock.plan.entry;
    const potential = shares * stock.plan.rewardPerShare;
    return { riskDollar, shares, cost, potential };
  }, [stock, capital, riskPct]);

  if (!stock) return null;
  const p = stock.plan;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5">
        {/* Top bar with back button */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onClose}
          >
            <ArrowLeft size={15} className="mr-1.5" /> 返回
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-zinc-50">
              {stock.raw.ticker}
              <span className="text-base font-normal text-zinc-400 ml-2">{stock.raw.name}</span>
            </h2>
            <Badge variant="outline" className={`${STRATEGY_META[stock.strategy].color} border-zinc-700`}>
              {stock.signalLabel}
            </Badge>
          </div>
          <div className="ml-auto hidden sm:block text-right">
            <div className="text-[11px] text-zinc-500">评分</div>
            <div className="text-lg font-bold font-mono text-sky-400 leading-none">{stock.score}<span className="text-xs text-zinc-500">/99</span></div>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mb-5">
          {stock.sector} · {stock.raw.marketCap > 0 ? `市值 ${stock.raw.marketCap}B · ` : ""}{stock.signalDetail}
        </p>

        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between mb-1 px-1 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-[11px]">
                  <button onClick={() => setView("daily")}
                    className={`px-3 py-1 font-medium transition-colors ${view === "daily" ? "bg-sky-600 text-white" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"}`}>
                    日线
                  </button>
                  <button onClick={() => setView("hourly")}
                    className={`px-3 py-1 font-medium transition-colors ${view === "hourly" ? "bg-sky-600 text-white" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"}`}>
                    小时线
                  </button>
                </div>
                <span className="text-[11px] text-zinc-500">
                  {view === "daily" ? `近 ${Math.min(250, stock.raw.bars.length)} 个交易日（可縮放至 3 年）` : `近 ${Math.min(200, stock.raw.hourly.length)} 个小时（可縮放至 1 年）`}
                </span>
              </div>
              <div className="flex gap-3 text-[11px] flex-wrap">
                <span className="text-yellow-400">— MA20</span>
                <span className="text-violet-400">— MA50</span>
                <span className="text-amber-500">— BB(20,2)</span>
                <span className="text-sky-400">— KC(20,1.5ATR)</span>
                <span className="text-amber-500/80">▢ 中枢</span>
                <span className="text-rose-400">▼一买/二买</span>
                <span className="text-teal-400">▲一卖/二卖</span>
              </div>
            </div>
            {view === "daily" ? (
              <CandleChart bars={stock.raw.bars} showBars={250} entry={p.rr > 0 ? p.entry : undefined} stop={p.rr > 0 ? p.stop : undefined} target={p.rr > 0 ? p.target : undefined} height={480} chan={stock.chan} />
            ) : hourly ? (
              <HourlyChart bars={hourly.bars} showBars={200} chan={hourly.chan} height={480} />
            ) : null}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <Ind label="现价" value={`$${fmtPrice(stock.close)}`} tone={stock.changePct >= 0 ? "up" : "down"} />
            <Ind label="今日涨跌" value={fmtPct(stock.changePct)} tone={stock.changePct >= 0 ? "up" : "down"} />
            <Ind label="20日涨跌" value={fmtPct(stock.change20d)} tone={stock.change20d >= 0 ? "up" : "down"} />
            <Ind label="RSI(14)" value={stock.rsi.toFixed(1)} tone={stock.rsi > 70 ? "down" : stock.rsi < 30 ? "up" : "flat"} />
            <Ind label="量比" value={`${stock.volRatio.toFixed(2)}×`} tone={stock.volRatio >= 1.5 ? "up" : "flat"} />
            <Ind label="ATR" value={`${stock.atrPct.toFixed(1)}%`} />
          </div>

          {p.rr > 0 && (
            <>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDollarSign size={15} className="text-sky-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">交易参数（持仓 ≤ {p.holdDays} 天）</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[
                    { label: "建议入场", value: `$${fmtPrice(p.entry)}`, cls: "text-sky-400" },
                    { label: "止损价", value: `$${fmtPrice(p.stop)}`, cls: "text-red-400" },
                    { label: "目标价", value: `$${fmtPrice(p.target)}`, cls: "text-emerald-400" },
                    { label: "盈亏比", value: `1:${p.rr.toFixed(1)}`, cls: "text-zinc-100" },
                  ].map((it) => (
                    <div key={it.label} className="rounded-lg bg-zinc-950/70 border border-zinc-800 py-2.5">
                      <div className="text-[10px] text-zinc-500">{it.label}</div>
                      <div className={`font-mono font-bold ${it.cls}`}>{it.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="text-zinc-500">每股风险 <span className="text-red-400 font-mono">${p.riskPerShare.toFixed(2)}</span></div>
                  <div className="text-zinc-500">每股空间 <span className="text-emerald-400 font-mono">${p.rewardPerShare.toFixed(2)}</span></div>
                  <div className="text-zinc-500">止损幅度 <span className="text-zinc-300 font-mono">{((p.riskPerShare / p.entry) * 100).toFixed(1)}%</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock size={15} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">5 日持仓计划表</h3>
                </div>
                <div className="space-y-0">
                  {p.plan.map((step, i) => (
                    <div key={step.day} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                          step.day === 5 ? "bg-red-500/15 border-red-500/40 text-red-400" : "bg-zinc-800 border-zinc-700 text-zinc-300"
                        }`}>
                          D{step.day}
                        </div>
                        {i < p.plan.length - 1 && <div className="w-px flex-1 bg-zinc-800 my-0.5" />}
                      </div>
                      <div className="pb-4 pt-0.5">
                        <div className="text-sm font-medium text-zinc-200">{step.action}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{step.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="text-sm font-semibold text-zinc-100 mb-3">仓位计算器（固定风险法）</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">账户资金 ($)</Label>
                    <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)}
                      className="bg-zinc-950 border-zinc-700 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">单笔风险 (%)</Label>
                    <Input type="number" step={0.25} value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value) || 0)}
                      className="bg-zinc-950 border-zinc-700 font-mono" />
                  </div>
                </div>
                {calc && calc.shares > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 py-2">
                      <div className="text-[10px] text-zinc-500">可买股数</div>
                      <div className="font-mono font-bold text-zinc-100">{calc.shares}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 py-2">
                      <div className="text-[10px] text-zinc-500">占用资金</div>
                      <div className="font-mono font-bold text-zinc-100">${calc.cost.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg bg-zinc-950/70 border border-zinc-800 py-2">
                      <div className="text-[10px] text-zinc-500">潜在盈利</div>
                      <div className="font-mono font-bold text-emerald-400">+${calc.potential.toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-zinc-500">输入资金与风险比例后自动计算仓位。</div>
                )}
                <Separator className="my-4 bg-zinc-800" />
                <Button className="w-full bg-sky-600 hover:bg-sky-500" onClick={() => calc && calc.shares > 0 && onAddToJournal(stock, calc.shares)}>
                  <Play size={15} className="mr-2" /> 按此计划记入交易日志
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
