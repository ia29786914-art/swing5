import type { StockAnalysis } from "@/lib/types";
import { STRATEGY_META } from "@/lib/engine";
import { fmtPct, fmtPrice } from "@/lib/indicators";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

interface Props {
  rows: StockAnalysis[];
  watchlist: string[];
  onToggleWatch: (t: string) => void;
  onSelect: (s: StockAnalysis) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : score >= 60 ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
    : score >= 45 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-zinc-500/15 text-zinc-400 border-zinc-600";
  return (
    <Badge variant="outline" className={`${color} font-mono w-11 justify-center`}>
      {score}
    </Badge>
  );
}

export function ScreenerTable({ rows, watchlist, onToggleWatch, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-16 text-center text-sm text-zinc-500">
        当前筛选条件下没有符合条件的股票，放宽条件试试。
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-500 text-xs w-10"></TableHead>
            <TableHead className="text-zinc-500 text-xs">代码 / 名称</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">现价</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">今日</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">20日</TableHead>
            <TableHead className="text-zinc-500 text-xs text-center">信号</TableHead>
            <TableHead className="text-zinc-500 text-xs text-center">评分</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">RSI</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">量比</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">ATR%</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">入场 / 止损 / 目标</TableHead>
            <TableHead className="text-zinc-500 text-xs text-center">盈亏比</TableHead>
            <TableHead className="text-zinc-500 text-xs text-center">持仓≤</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow
              key={s.raw.ticker}
              className="border-zinc-800/70 hover:bg-zinc-800/40 cursor-pointer"
              onClick={() => onSelect(s)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <button
                  className={`p-1 rounded ${watchlist.includes(s.raw.ticker) ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}
                  onClick={() => onToggleWatch(s.raw.ticker)}
                  title="加入自选"
                >
                  <Star size={15} fill={watchlist.includes(s.raw.ticker) ? "currentColor" : "none"} />
                </button>
              </TableCell>
              <TableCell>
                <div className="font-semibold text-zinc-100 text-sm">{s.raw.ticker}</div>
                <div className="text-[11px] text-zinc-500">
                  {s.raw.name} · {s.sector}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-zinc-100">${fmtPrice(s.close)}</TableCell>
              <TableCell className={`text-right font-mono text-xs ${s.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmtPct(s.changePct)}
              </TableCell>
              <TableCell className={`text-right font-mono text-xs ${s.change20d >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                {fmtPct(s.change20d)}
              </TableCell>
              <TableCell className="text-center">
                <span className={`text-xs font-medium ${STRATEGY_META[s.strategy].color}`}>{s.signalLabel}</span>
              </TableCell>
              <TableCell className="text-center">
                <ScoreBadge score={s.score} />
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-300">{s.rsi.toFixed(0)}</TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-300">{s.volRatio.toFixed(2)}×</TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-300">{s.atrPct.toFixed(1)}%</TableCell>
              <TableCell className="text-right font-mono text-[11px] text-zinc-300">
                {s.plan.rr > 0 ? (
                  <>
                    <span className="text-sky-400">{fmtPrice(s.plan.entry)}</span>
                    <span className="text-zinc-600"> / </span>
                    <span className="text-red-400">{fmtPrice(s.plan.stop)}</span>
                    <span className="text-zinc-600"> / </span>
                    <span className="text-emerald-400">{fmtPrice(s.plan.target)}</span>
                  </>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </TableCell>
              <TableCell className="text-center font-mono text-xs">
                {s.plan.rr > 0 ? (
                  <Badge variant="outline" className={`font-mono ${s.plan.rr >= 2 ? "text-emerald-400 border-emerald-500/30" : "text-zinc-400 border-zinc-600"}`}>
                    1:{s.plan.rr.toFixed(1)}
                  </Badge>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {s.plan.holdDays > 0 && s.plan.rr > 0 ? (
                  <span className="text-xs font-semibold text-zinc-200">{s.plan.holdDays} 天</span>
                ) : (
                  <span className="text-zinc-600 text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
