import type { HourlyAnalysis } from "@/lib/hourly";
import { fmtPct, fmtPrice } from "@/lib/indicators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HourlyChart } from "./HourlyChart";
import { GitBranch, Waves, CircleDollarSign, CalendarClock, ArrowLeft } from "lucide-react";

interface Props {
  h: HourlyAnalysis | null;
  onClose: () => void;
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  return (
    <div className="rounded-lg bg-zinc-900/80 border border-zinc-800 px-3 py-2">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className={`text-sm font-mono font-semibold ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}

export function HourlySheet({ h, onClose }: Props) {
  if (!h) return null;
  const risk = h.entry - h.stop;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
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
              {h.raw.ticker}
              <span className="text-base font-normal text-zinc-400 ml-2">{h.raw.name}</span>
            </h2>
            <Badge variant="outline" className="border-zinc-700 text-sky-400">
              小时级 · {h.signalLabel}
            </Badge>
          </div>
          <div className="ml-auto hidden sm:block text-right">
            <div className="text-[11px] text-zinc-500">评分</div>
            <div className="text-lg font-bold font-mono text-sky-400 leading-none">{h.score}<span className="text-xs text-zinc-500">/99</span></div>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mb-5">
          {h.raw.sector} · 信号基于 {h.bars.length} 根真实小时K线：缠论分型/笔/背驰 + MACD + 布林 + 肯特纳 Squeeze
        </p>

        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-[11px] text-zinc-500">小时线 · 近 150 根</span>
              <div className="flex gap-3 text-[11px] flex-wrap">
                <span className="text-amber-500">— BB(20,2)</span>
                <span className="text-sky-400">— KC(20,1.5ATR)</span>
                <span className="text-yellow-400">— MA20</span>
                <span className="text-violet-400">— MA50</span>
                <span className="text-zinc-500">▮ VOL</span>
                <span className="text-amber-500/80">▢ 中枢</span>
                <span className="text-rose-400">▼买</span>
                <span className="text-teal-400">卖▲</span>
              </div>
            </div>
            <HourlyChart bars={h.bars} showBars={150} chan={h.chan} height={600} />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <Chip label="时线现价" value={`$${fmtPrice(h.close)}`} />
            <Chip label="近7小时" value={fmtPct(h.changePct)} tone={h.changePct >= 0 ? "up" : "down"} />
            <Chip label="ATR(14H)" value={`${h.atrPct.toFixed(2)}%`} />
            <Chip label="BB %B" value={`${(h.bbPctB * 100).toFixed(0)}%`} />
            <Chip label="MACD柱" value={h.macdHist.toFixed(3)} tone={h.macdHist >= 0 ? "up" : "down"} />
            <Chip label="Squeeze" value={h.squeeze.isSqueezed ? `挤压${h.squeeze.squeezeBars}根` : h.squeeze.justReleased ? "刚释放" : "无"} />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={15} className="text-rose-400" />
              <h3 className="text-sm font-semibold text-zinc-100">缠论结构解读</h3>
            </div>
            <ul className="text-xs text-zinc-400 space-y-1.5 leading-relaxed">
              <li>
                有效笔：最近底分型 <span className="font-mono text-emerald-400">{h.chan.lastPenLow !== null ? "$" + fmtPrice(h.chan.lastPenLow) : "—"}</span>
                {" / "}顶分型 <span className="font-mono text-red-400">{h.chan.lastPenHigh !== null ? "$" + fmtPrice(h.chan.lastPenHigh) : "—"}</span>
              </li>
              <li>
                底背驰：
                {h.chan.bottomDivergence ? (
                  <span className="text-rose-300"> 出现 —— 价格创新低但 MACD DIF 抬升，空方动能衰竭（一买信号）</span>
                ) : (
                  <span className="text-zinc-600"> 未出现</span>
                )}
              </li>
              <li>
                二买确认：
                {h.chan.secondBuy ? (
                  <span className="text-emerald-300"> 成立 —— 回试不破背驰低点且 MACD 站回零轴上方</span>
                ) : (
                  <span className="text-zinc-600"> 未成立</span>
                )}
              </li>
              <li>
                顶背驰（风险）：{h.chan.topDivergence ? <span className="text-amber-300">出现，警惕回落</span> : <span className="text-zinc-600">未出现</span>}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Waves size={15} className="text-sky-400" />
              <h3 className="text-sm font-semibold text-zinc-100">BB + Keltner Squeeze</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              布林通道{h.bbWidth < 0.05 ? "（宽度极窄，波动压缩）" : ""}当前 {h.bbWidth.toFixed(3)}；%B = {(h.bbPctB * 100).toFixed(0)}%。
              {h.squeeze.isSqueezed
                ? `BB 已 ${h.squeeze.squeezeBars} 根收缩进 KC 内部，波动蓄势中——等待向上突破释放。`
                : h.squeeze.justReleased
                ? `Squeeze 刚向上释放，通常是短线爆发起点，配合 MACD 金叉胜率更高。`
                : "当前无挤压状态，通道正常张开。"}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CircleDollarSign size={15} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-zinc-100">交易参数（小时级 · 持仓 ≤ {h.holdDays} 天）</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { label: "建议入场", value: `$${fmtPrice(h.entry)}`, cls: "text-sky-400" },
                { label: "止损（笔低点）", value: `$${fmtPrice(h.stop)}`, cls: "text-red-400" },
                { label: "目标（2.2R）", value: `$${fmtPrice(h.target)}`, cls: "text-emerald-400" },
                { label: "每股风险", value: `$${risk.toFixed(2)}`, cls: "text-zinc-100" },
              ].map((it) => (
                <div key={it.label} className="rounded-lg bg-zinc-950/70 border border-zinc-800 py-2.5">
                  <div className="text-[10px] text-zinc-500">{it.label}</div>
                  <div className={`font-mono font-bold ${it.cls}`}>{it.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
              <CalendarClock size={12} className="text-amber-400" />
              止损设在最近缠论笔低点下方 0.3×ATR；小时级信号衰减快，持仓不超过 {h.holdDays} 天，第 {h.holdDays} 天收盘前无条件离场。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
