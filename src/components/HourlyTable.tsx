import { useMemo, useState } from "react";
import type { HourlyAnalysis } from "@/lib/hourly";
import { fmtPct, fmtPrice } from "@/lib/indicators";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Props {
  rows: HourlyAnalysis[];
  onSelect: (h: HourlyAnalysis) => void;
}

type SortKey = "ticker" | "close" | "change" | "bb" | "score" | "entry" | "hold";

const ACCESSORS: Record<SortKey, (h: HourlyAnalysis) => number | string> = {
  ticker: (h) => h.raw.ticker,
  close: (h) => h.close,
  change: (h) => h.changePct,
  bb: (h) => h.bbPctB,
  score: (h) => h.score,
  entry: (h) => h.entry,
  hold: (h) => h.holdDays,
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

export function HourlyTable({ rows, onSelect }: Props) {
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
        当前条件下没有符合小时级信号的股票。
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <Th label="代码 / 名称" k="ticker" sort={sort} onSort={onSort} />
            <Th label="时线现价" k="close" sort={sort} onSort={onSort} className="text-right" />
            <Th label="近7小时" k="change" sort={sort} onSort={onSort} className="text-right" />
            <TableHead className="text-zinc-500 text-xs text-center">缠论</TableHead>
            <TableHead className="text-zinc-500 text-xs text-center">Squeeze</TableHead>
            <TableHead className="text-zinc-500 text-xs text-center">MACD</TableHead>
            <Th label="BB %B" k="bb" sort={sort} onSort={onSort} className="text-right" />
            <Th label="评分" k="score" sort={sort} onSort={onSort} className="text-center" />
            <Th label="入场 / 止损 / 目标" k="entry" sort={sort} onSort={onSort} className="text-right" />
            <TableHead className="text-zinc-500 text-xs text-center">盈亏比</TableHead>
            <Th label="持仓≤" k="hold" sort={sort} onSort={onSort} className="text-center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((h) => (
            <TableRow key={h.raw.ticker} className="border-zinc-800/70 hover:bg-zinc-800/40 cursor-pointer" onClick={() => onSelect(h)}>
              <TableCell>
                <div className="font-semibold text-zinc-100 text-sm">{h.raw.ticker}</div>
                <div className="text-[11px] text-zinc-500">
                  {h.raw.name} · {h.raw.sector}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-zinc-100">${fmtPrice(h.close)}</TableCell>
              <TableCell className={`text-right font-mono text-xs ${h.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmtPct(h.changePct)}
              </TableCell>
              <TableCell className="text-center">
                {h.chanSignal ? (
                  <Badge className={`${h.chanSignal === "一买" ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"} hover:bg-transparent border-0`}>
                    {h.chanSignal}
                  </Badge>
                ) : h.chan.bottomDivergence || h.chan.secondBuy ? (
                  <span className="text-xs text-amber-400">背驰酝酿</span>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {h.squeeze.justReleased && h.squeeze.releaseDir === "long" ? (
                  <Badge className="bg-sky-500/20 text-sky-300 hover:bg-transparent border-0">释放↑</Badge>
                ) : h.squeeze.isSqueezed ? (
                  <span className="text-xs text-amber-400">挤压 {h.squeeze.squeezeBars}根</span>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </TableCell>
              <TableCell className="text-center text-xs">
                {h.macdState ? (
                  <span className={h.macdState === "死叉" ? "text-red-400" : "text-emerald-400"}>{h.macdState}</span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-300">{(h.bbPctB * 100).toFixed(0)}%</TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={`font-mono w-11 justify-center ${
                    h.score >= 70 ? "text-emerald-400 border-emerald-500/30"
                    : h.score >= 55 ? "text-sky-400 border-sky-500/30"
                    : "text-zinc-400 border-zinc-600"
                  }`}
                >
                  {h.score}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-[11px] text-zinc-300">
                <span className="text-sky-400">{fmtPrice(h.entry)}</span>
                <span className="text-zinc-600"> / </span>
                <span className="text-red-400">{fmtPrice(h.stop)}</span>
                <span className="text-zinc-600"> / </span>
                <span className="text-emerald-400">{fmtPrice(h.target)}</span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="font-mono text-emerald-400 border-emerald-500/30">1:2.2</Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className="text-xs font-semibold text-zinc-200">{h.holdDays} 天</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
