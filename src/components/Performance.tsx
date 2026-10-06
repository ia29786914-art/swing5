import { useMemo } from "react";
import type { StockRaw, Strategy } from "@/lib/types";
import { performanceReport, type GroupStat, type TrackedSignal } from "@/lib/backtest";
import { STRATEGY_META } from "@/lib/engine";
import { fmtPct } from "@/lib/indicators";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Target, ShieldAlert, Hourglass, Wallet } from "lucide-react";

const STRATS: Exclude<Strategy, "none">[] = ["breakout", "pullback", "reversal", "momentum"];

const OUTCOME_META: Record<TrackedSignal["outcome"], { label: string; cls: string }> = {
  win: { label: "達標", cls: "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 border-0" },
  loss: { label: "止損", cls: "bg-red-500/20 text-red-300 hover:bg-red-500/20 border-0" },
  timeout: { label: "到期離場", cls: "bg-zinc-500/20 text-zinc-300 hover:bg-zinc-500/20 border-0" },
  open: { label: "進行中", cls: "bg-sky-500/20 text-sky-300 hover:bg-sky-500/20 border-0" },
};

function Card({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
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

function StatTable({ title, rows }: { title: string; rows: { name: string; color?: string; s: GroupStat }[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 border-b border-zinc-800">{title}</div>
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-500 text-xs">分組</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">信號數</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">勝率</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">平均收益</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">平均 R</TableHead>
            <TableHead className="text-zinc-500 text-xs text-right">盈虧比</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name} className="border-zinc-800/70">
              <TableCell className={`text-xs font-medium ${r.color ?? "text-zinc-200"}`}>{r.name}</TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-300">{r.s.count}</TableCell>
              <TableCell className={`text-right font-mono text-xs ${r.s.winRate >= 50 ? "text-emerald-400" : r.s.winRate >= 30 ? "text-zinc-200" : "text-zinc-400"}`}>
                {r.s.winRate.toFixed(1)}%
              </TableCell>
              <TableCell className={`text-right font-mono text-xs ${r.s.avgRetPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmtPct(r.s.avgRetPct)}
              </TableCell>
              <TableCell className={`text-right font-mono text-xs ${r.s.avgR >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {r.s.avgR >= 0 ? "+" : ""}{r.s.avgR.toFixed(2)}R
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-zinc-300">
                {r.s.profitFactor === Infinity ? "∞" : r.s.profitFactor.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EquityCurve({ equity }: { equity: { date: string; cumR: number }[] }) {
  const W = 720;
  const H = 220;
  const pad = { l: 48, r: 56, t: 14, b: 22 };
  const values = equity.map((p) => p.cumR);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const stepX = (W - pad.l - pad.r) / Math.max(1, equity.length - 1);
  const x = (i: number) => pad.l + i * stepX;
  const y = (v: number) => pad.t + ((max - v) / span) * (H - pad.t - pad.b);
  const line = equity.map((p, i) => `${x(i).toFixed(1)},${y(p.cumR).toFixed(1)}`).join(" ");
  const final = equity.length ? equity[equity.length - 1].cumR : 0;
  const color = final >= 0 ? "#34d399" : "#f87171";
  const peak = equity.length ? Math.max(...values) : 0;
  const trough = equity.length ? Math.min(...values) : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
        <span className="text-xs font-semibold text-zinc-400">累計 R 曲線</span>
        <span className="text-[11px] text-zinc-500">每筆固定 1R 風險的累計盈虧（R = 收益 ÷ 每股風險）</span>
        <span className="ml-auto text-[11px] font-mono">
          <span className={final >= 0 ? "text-emerald-400" : "text-red-400"}>終值 {final >= 0 ? "+" : ""}{final.toFixed(1)}R</span>
          <span className="text-zinc-500 ml-3">峰值 +{peak.toFixed(1)}R</span>
          <span className="text-zinc-500 ml-3">回撤底 {trough >= 0 ? "+" : ""}{trough.toFixed(1)}R</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        {/* y 軸標籤 */}
        {[max, 0, min].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#3f3f46" : "#27272a"} strokeWidth="0.7" />
            <text x={pad.l - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#71717a">
              {v >= 0 ? "+" : ""}{v.toFixed(0)}R
            </text>
          </g>
        ))}
        {/* 曲線 + 面積 */}
        <polygon points={`${pad.l},${y(0)} ${line} ${x(equity.length - 1)},${y(0)}`} fill={final >= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)"} stroke="none" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.4" />
        {/* 起止日期 */}
        {equity.length > 0 && (
          <>
            <text x={pad.l} y={H - 6} fontSize="9" fill="#52525b">{equity[0].date}</text>
            <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="9" fill="#52525b">{equity[equity.length - 1].date}</text>
          </>
        )}
      </svg>
    </div>
  );
}

export function Performance({ stocks }: { stocks: StockRaw[] }) {  const rep = useMemo(() => performanceReport(stocks), [stocks]);
  const o = rep.overall;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
        <span className="text-zinc-500">信號表現追踪：</span>
        <span>對 3 年歷史逐日重放選股引擎，每個信號按入場/止損/目標模擬 ≤5 日持倉</span>
        {rep.openCount > 0 && (
          <Badge variant="outline" className="border-sky-500/30 text-sky-300">進行中 {rep.openCount}</Badge>
        )}
        <span className="ml-auto text-zinc-600">網站每日自動更新後，新信號會自動入帳並在 5 個交易日後結算</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card icon={<BarChart3 size={12} />} label="已結算信號" value={String(o.count)} sub={`達標 ${o.wins} · 止損 ${o.losses} · 到期 ${o.timeouts}`} />
        <Card icon={<Target size={12} />} label="勝率（達成目標）" value={`${o.winRate.toFixed(1)}%`} sub={`${o.wins}/${o.count} 筆`} tone={o.winRate >= 40 ? "text-emerald-400" : "text-zinc-100"} />
        <Card icon={<Wallet size={12} />} label="平均每筆收益" value={fmtPct(o.avgRetPct)} sub="含到期離場標記市值" tone={o.avgRetPct >= 0 ? "text-emerald-400" : "text-red-400"} />
        <Card icon={<Hourglass size={12} />} label="平均每筆 R 倍數" value={`${o.avgR >= 0 ? "+" : ""}${o.avgR.toFixed(2)}R`} tone={o.avgR >= 0 ? "text-emerald-400" : "text-red-400"} />
        <Card icon={<ShieldAlert size={12} />} label="盈虧比" value={o.profitFactor === Infinity ? "∞" : o.profitFactor.toFixed(2)} sub="總盈利R ÷ |總虧損R|" tone={o.profitFactor >= 1 ? "text-emerald-400" : "text-red-400"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <StatTable
          title="分策略表現"
          rows={STRATS.map((s) => ({ name: STRATEGY_META[s].label, color: STRATEGY_META[s].color, s: rep.byStrategy[s]! }))}
        />
        <StatTable
          title="分年度表現"
          rows={Object.entries(rep.byYear).map(([y, s]) => ({ name: `${y} 年`, s }))}
        />
      </div>

      <EquityCurve equity={rep.equity} />

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 border-b border-zinc-800">最近結算的信號</div>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-xs">日期</TableHead>
              <TableHead className="text-zinc-500 text-xs">代碼</TableHead>
              <TableHead className="text-zinc-500 text-xs">策略</TableHead>
              <TableHead className="text-zinc-500 text-xs text-right">入場 → 出場</TableHead>
              <TableHead className="text-zinc-500 text-xs text-right">天數</TableHead>
              <TableHead className="text-zinc-500 text-xs text-right">收益</TableHead>
              <TableHead className="text-zinc-500 text-xs text-right">R 倍數</TableHead>
              <TableHead className="text-zinc-500 text-xs text-center">結果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rep.recent.map((t, i) => (
              <TableRow key={`${t.ticker}-${t.date}-${i}`} className="border-zinc-800/70">
                <TableCell className="font-mono text-xs text-zinc-400">{t.date}</TableCell>
                <TableCell>
                  <span className="font-semibold text-zinc-100 text-sm">{t.ticker}</span>
                  <span className="text-[11px] text-zinc-500 ml-1.5">{t.name}</span>
                </TableCell>
                <TableCell className={`text-xs ${STRATEGY_META[t.strategy].color}`}>{STRATEGY_META[t.strategy].label}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-300">
                  ${t.entry.toFixed(2)} → {t.exitPrice !== null ? `$${t.exitPrice.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-400">{t.exitDay > 0 ? `${t.exitDay}/${t.holdDays}` : "—"}</TableCell>
                <TableCell className={`text-right font-mono text-xs ${t.retPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(t.retPct)}</TableCell>
                <TableCell className={`text-right font-mono text-xs ${t.rMultiple >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(2)}R
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={OUTCOME_META[t.outcome].cls}>{OUTCOME_META[t.outcome].label}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
