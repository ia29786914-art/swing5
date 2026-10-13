import { useMemo, useState } from "react";
import type { StockAnalysis } from "@/lib/types";
import { STRATEGY_META } from "@/lib/engine";
import { fmtPct, fmtPrice } from "@/lib/indicators";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Props {
  rows: StockAnalysis[];
  watchlist: string[];
  onToggleWatch: (t: string) => void;
  onSelect: (s: StockAnalysis) => void;
}

type SortKey = "ticker" | "close" | "change" | "change20" | "score" | "rsi" | "vol" | "atr" | "rr" | "hold";

const ACCESSORS: Record<SortKey, (s: StockAnalysis) => number | string> = {
  ticker: (s) => s.raw.ticker,
  close: (s) => s.close,
  change: (s) => s.changePct,
  change20: (s) => s.change20d,
  score: (s) => s.score,
  rsi: (s) => s.rsi,
  vol: (s) => s.volRatio,
  atr: (s) => s.atrPct,
  rr: (s) => s.plan.rr,
  hold: (s) => s.plan.holdDays,
};

function Th({ label, k, sort, onSort, className }: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === k;
  return (
    <TableHead
      className={`text-zinc-500 text-xs cursor-pointer select-none hover:text-zinc-300 ${className ?? ""}`}
      onClick={() => onSort(k)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active ? (
          sort.dir === "asc" ? <ArrowUp size={10} className="text-sky-400" /> : <ArrowDown size={10} className="text-sky-400" />
        ) : (
          <ArrowUpDown size={10} className="opacity-25" />
        )}
      </span>
    </TableHead>
  );
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
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = ACCESSORS[sort.key];
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort]);

  const onSort = (k: SortKey) =>
    setSort((prev) => (prev?.key === k ? { key: k, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));

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
            <Th label="代码 / 名称" k="ticker" sort={sort} onSort={onSort} />
            <Th label="现价" k="close" sort={sort} onSort={onSort} className="text-right" />
            <Th label="今日" k="change" sort={sort} onSort={onSort} className="text-right" />
            <Th label="20日" k="change20" sort={sort} onSort={onSort} className="text-right" />
            <TableHead className="text-zinc-500 text-xs text-center">信号</TableHead>
            <Th label="评分" k="score" sort={sort} onSort={onSort} className="text-center" />
            <Th label="RSI" k="rsi" sort={sort} onSort={onSort} className="text-right" />
            <Th label="量比" k="vol" sort={sort} onSort={onSort} className="text-right" />
            <Th label="ATR%" k="atr" sort={sort} onSort={onSort} className="text-right" />
            <TableHead className="text-zinc-500 text-xs text-right">入场 / 止损 / 目标</TableHead>
            <Th label="盈亏比" k="rr" sort={sort} onSort={onSort} className="text-center" />
            <Th label="持仓≤" k="hold" sort={sort} onSort={onSort} className="text-center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s) => (
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
