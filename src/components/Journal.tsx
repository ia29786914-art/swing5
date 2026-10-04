import type { JournalEntry, StockAnalysis } from "@/lib/types";
import { fmtPrice } from "@/lib/indicators";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { AlarmClockCheck, Trash2, XCircle } from "lucide-react";

const MAX_HOLD_DAYS = 5;

function holdingInfo(entryDate: string) {
  const days = Math.floor((Date.now() - new Date(entryDate + "T00:00:00").getTime()) / 86400000) + 1;
  return { days, overdue: days > MAX_HOLD_DAYS, urgent: days === MAX_HOLD_DAYS };
}

interface Props {
  entries: JournalEntry[];
  analyses: Map<string, StockAnalysis>;
  onClose: (id: string, exitPrice: number) => void;
  onRemove: (id: string) => void;
}

export function Journal({ entries, analyses, onClose, onRemove }: Props) {
  const [closing, setClosing] = useState<JournalEntry | null>(null);
  const [exitPrice, setExitPrice] = useState("");

  const open = entries.filter((e) => e.status === "open");
  const closed = entries.filter((e) => e.status === "closed");

  const pnl = (e: JournalEntry) =>
    e.status === "closed" && e.exitPrice !== undefined
      ? (e.exitPrice - e.entryPrice) * e.shares
      : undefined;

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
            持仓中 <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30">{open.length}</Badge>
            <span className="text-[11px] font-normal text-zinc-500">纪律：持仓不超过 {MAX_HOLD_DAYS} 天，到期强制离场</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {open.map((e) => {
              const info = holdingInfo(e.entryDate);
              const cur = analyses.get(e.ticker);
              const unrealized = cur ? (cur.close - e.entryPrice) * e.shares : undefined;
              return (
                <Card key={e.id} className={`border ${info.overdue ? "border-red-500/50 bg-red-500/5" : info.urgent ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/60"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-zinc-100">{e.ticker}</span>
                        <span className="text-xs text-zinc-500 ml-2">{e.name}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          info.overdue
                            ? "bg-red-500/20 text-red-300 border-red-500/50 animate-pulse"
                            : info.urgent
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-zinc-800 text-zinc-300 border-zinc-700"
                        }
                      >
                        {info.overdue ? (
                          <>
                            <AlarmClockCheck size={11} className="mr-1" />超期 {info.days - MAX_HOLD_DAYS} 天，立即离场!
                          </>
                        ) : (
                          `第 ${info.days} / ${MAX_HOLD_DAYS} 天`
                        )}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="text-zinc-500 text-[10px]">入场价</div>
                        <div className="font-mono text-zinc-200">${fmtPrice(e.entryPrice)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">股数</div>
                        <div className="font-mono text-zinc-200">{e.shares}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">成本</div>
                        <div className="font-mono text-zinc-200">${(e.entryPrice * e.shares).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">浮动盈亏</div>
                        <div className={`font-mono font-semibold ${unrealized === undefined ? "text-zinc-500" : unrealized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {unrealized === undefined ? "—" : `${unrealized >= 0 ? "+" : ""}$${Math.round(unrealized).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 h-7 text-xs" onClick={() => { setClosing(e); setExitPrice(cur ? String(cur.close) : ""); }}>
                        <XCircle size={12} className="mr-1" /> 平仓
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-red-400" onClick={() => onRemove(e.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-2">已平仓 <span className="text-[11px] font-normal text-zinc-500">（最近 20 条）</span></h3>
        {closed.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-10 text-center text-sm text-zinc-500">
            暂无平仓记录。从选股页挑一只股票，按交易计划建仓后记入日志。
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                  <th className="text-left font-medium p-3">代码</th>
                  <th className="text-right font-medium p-3">入场</th>
                  <th className="text-right font-medium p-3">出场</th>
                  <th className="text-right font-medium p-3">股数</th>
                  <th className="text-right font-medium p-3">盈亏</th>
                  <th className="text-right font-medium p-3">持仓天数</th>
                </tr>
              </thead>
              <tbody>
                {closed.slice(0, 20).map((e) => {
                  const p = pnl(e);
                  const days = e.exitDate ? Math.max(1, Math.round((new Date(e.exitDate).getTime() - new Date(e.entryDate).getTime()) / 86400000)) : 0;
                  return (
                    <tr key={e.id} className="border-b border-zinc-800/60 text-zinc-300">
                      <td className="p-3 font-semibold">{e.ticker}</td>
                      <td className="p-3 text-right font-mono">${fmtPrice(e.entryPrice)}</td>
                      <td className="p-3 text-right font-mono">${e.exitPrice !== undefined ? fmtPrice(e.exitPrice) : "—"}</td>
                      <td className="p-3 text-right font-mono">{e.shares}</td>
                      <td className={`p-3 text-right font-mono font-semibold ${p === undefined ? "text-zinc-500" : p >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {p === undefined ? "—" : `${p >= 0 ? "+" : ""}$${Math.round(p).toLocaleString()}`}
                      </td>
                      <td className="p-3 text-right font-mono text-xs">{days} 天</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">平仓 {closing?.ticker}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs text-zinc-500">出场价格 ($)</Label>
            <Input autoFocus value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} className="bg-zinc-900 border-zinc-700 font-mono" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => setClosing(null)}>取消</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => {
              if (closing && Number(exitPrice) > 0) {
                onClose(closing.id, Number(exitPrice));
                setClosing(null);
              }
            }}>确认平仓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
