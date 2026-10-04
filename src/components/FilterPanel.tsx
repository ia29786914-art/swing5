import type { Strategy } from "@/lib/types";
import { STRATEGY_META } from "@/lib/engine";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Filters {
  strategy: Strategy | "all";
  minScore: number;
  maxPrice: number;
  minVolRatio: number;
  rsiMin: number;
  rsiMax: number;
  sector: string;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  sectors: string[];
  count: number;
}

export function FilterPanel({ filters, onChange, sectors, count }: Props) {
  const strategies: (Strategy | "all")[] = ["all", "breakout", "pullback", "reversal", "momentum"];
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 mr-1">策略</span>
        {strategies.map((s) => (
          <Badge
            key={s}
            variant={filters.strategy === s ? "default" : "outline"}
            className={`cursor-pointer ${filters.strategy === s ? "bg-sky-500/90 hover:bg-sky-500" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}
            onClick={() => onChange({ ...filters, strategy: s })}
          >
            {s === "all" ? "全部" : STRATEGY_META[s].label}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-zinc-400">最低评分</Label>
            <span className="text-xs text-sky-400 font-mono">{filters.minScore}</span>
          </div>
          <Slider value={[filters.minScore]} min={0} max={95} step={5} onValueChange={([v]) => onChange({ ...filters, minScore: v })} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-zinc-400">股价上限 $</Label>
            <span className="text-xs text-sky-400 font-mono">{filters.maxPrice === 10000 ? "不限" : filters.maxPrice}</span>
          </div>
          <Slider value={[filters.maxPrice]} min={10} max={10000} step={10} onValueChange={([v]) => onChange({ ...filters, maxPrice: v })} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-zinc-400">RSI 区间</Label>
            <span className="text-xs text-sky-400 font-mono">
              {filters.rsiMin} ~ {filters.rsiMax}
            </span>
          </div>
          <Slider value={[filters.rsiMin, filters.rsiMax]} min={5} max={95} step={1} onValueChange={([a, b]) => onChange({ ...filters, rsiMin: a, rsiMax: b })} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-zinc-400">最低量比</Label>
            <span className="text-xs text-sky-400 font-mono">{filters.minVolRatio.toFixed(1)}×</span>
          </div>
          <Slider value={[filters.minVolRatio]} min={0} max={3} step={0.1} onValueChange={([v]) => onChange({ ...filters, minVolRatio: v })} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">行业</span>
        <Select value={filters.sector} onValueChange={(v) => onChange({ ...filters, sector: v })}>
          <SelectTrigger className="w-40 h-8 bg-zinc-950 border-zinc-700 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all">全部行业</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-zinc-500">
          命中 <span className="text-sky-400 font-semibold">{count}</span> 只
        </span>
      </div>
    </div>
  );
}
