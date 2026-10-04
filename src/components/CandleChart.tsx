import { useEffect, useMemo, useRef, useState } from "react";
import type { Bar } from "@/lib/types";
import type { ChanResult } from "@/lib/hourly";
import { macd, sma } from "@/lib/indicators";
import { bollinger, keltner } from "@/lib/hourly";
import { useChartZoom } from "@/hooks/useChartZoom";
import { ChanOverlay } from "./ChanOverlay";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface Props {
  bars: Bar[];
  showBars?: number;
  entry?: number;
  stop?: number;
  target?: number;
  height?: number;
  chan?: ChanResult;
}

const UP = "#34d399";
const DOWN = "#f87171";

/** Approximate trading-day date labels: walk back from today skipping weekends. */
function barDates(count: number, endOffset: number): string[] {
  const out: string[] = [];
  const d = new Date();
  let back = endOffset;
  while (back > 0) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) back--;
  }
  for (let i = 0; i < count; i++) {
    out.unshift(`${d.getMonth() + 1}/${d.getDate()}`);
    do {
      d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
  }
  return out;
}

export function CandleChart({ bars, showBars = 120, entry, stop, target, height = 460, chan }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showKC, setShowKC] = useState(true);
  const dragRef = useRef<{ x: number; moved: boolean } | null>(null);

  const data = useMemo(() => bars.slice(-showBars), [bars, showBars]);
  const { win, zoomAt, panBy, reset } = useChartZoom(data.length);
  const visible = data.slice(win.start, win.end);
  const visOff = win.start;

  const datesAll = useMemo(() => barDates(data.length, bars.length - data.length), [data.length, bars.length]);
  const dates = datesAll.slice(visOff, win.end);

  const W = 720;
  const volH = 42;
  const macdH = 68;
  const pad = { l: 52, r: 56, t: 10, b: 14 };
  const chartH = height - volH - macdH - pad.t - pad.b;

  // indicators computed on the FULL shown slice, then windowed (keeps warm-up valid at pan edges)
  const closesAll = useMemo(() => data.map((b) => b.c), [data]);
  const indAll = useMemo(() => {
    const m = macd(closesAll);
    return { ma20: sma(closesAll, 20), ma50: sma(closesAll, 50), macd: m };
  }, [closesAll]);
  const bbAll = useMemo(() => bollinger(closesAll), [closesAll]);
  const kcAll = useMemo(() => keltner(data), [data]);

  const ma20 = indAll.ma20.slice(visOff, win.end);
  const ma50 = indAll.ma50.slice(visOff, win.end);
  const bb = {
    mid: bbAll.mid.slice(visOff, win.end),
    upper: bbAll.upper.slice(visOff, win.end),
    lower: bbAll.lower.slice(visOff, win.end),
  };
  const kc = {
    mid: kcAll.mid.slice(visOff, win.end),
    upper: kcAll.upper.slice(visOff, win.end),
    lower: kcAll.lower.slice(visOff, win.end),
  };
  const macdData = {
    line: indAll.macd.line.slice(visOff, win.end),
    signal: indAll.macd.signal.slice(visOff, win.end),
    hist: indAll.macd.hist.slice(visOff, win.end),
  };

  const min = Math.min(...visible.map((b) => b.l));
  const max = Math.max(...visible.map((b) => b.h));
  const span = max - min || 1;
  const y = (v: number) => pad.t + ((max - v) / span) * chartH;
  const step = (W - pad.l - pad.r) / visible.length;
  const x = (i: number) => pad.l + (i + 0.5) * step;
  const bw = Math.max(1.2, step * 0.62);

  const maxVol = Math.max(...visible.map((b) => b.v));
  const macdVals = [...(macdData.line.filter((v) => v !== null) as number[]), ...(macdData.signal.filter((v) => v !== null) as number[])];
  const mMax = Math.max(...macdVals.map(Math.abs), 1e-9);
  const macdTop = pad.t + chartH + volH + 6;
  const mY = (v: number) => macdTop + macdH / 2 - (v / mMax) * (macdH / 2 - 6);
  const zeroY = macdTop + macdH / 2;

  const linePath = (arr: (number | null)[], yy: (v: number) => number) => {
    let started = false;
    return arr
      .map((v, i) => {
        if (v === null) return null;
        const cmd = started ? "L" : "M"; // path 必須以 M 起頭，否則瀏覽器整條不畫
        started = true;
        return `${cmd}${x(i).toFixed(1)},${yy(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  };

  const levels: { v: number; color: string; dash?: boolean; label?: string }[] = [];
  if (entry !== undefined) levels.push({ v: entry, color: "#38bdf8", label: "入场" });
  if (stop !== undefined) levels.push({ v: stop, color: DOWN, dash: true, label: "止损" });
  if (target !== undefined) levels.push({ v: target, color: UP, dash: true, label: "目标" });

  // ---- wheel zoom (native listener, passive:false, rAF-throttled) ----
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let raf = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = svg.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * W;
        const ratio = Math.min(1, Math.max(0, (mx - pad.l) / (W - pad.l - pad.r)));
        setHover(null);
        zoomAt(ratio, e.deltaY < 0 ? 1 : -1);
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [zoomAt]);

  // end drag even if mouseup happens outside the chart
  useEffect(() => {
    const up = () => { dragRef.current = null; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const handleMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * height;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      if (Math.abs(dx) > 3) dragRef.current.moved = true;
      panBy(-Math.round((dx / rect.width) * visible.length));
      dragRef.current.x = e.clientX;
      return;
    }
    const idx = Math.round((mx - pad.l) / step - 0.5);
    setHover(idx >= 0 && idx < visible.length ? idx : null);
    setMouseY(my);
  };

  const hb = hover !== null && hover < visible.length ? visible[hover] : null;
  const zoomed = win.count < data.length;

  return (
    <div>
      {/* toolbar + hover readout */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-1.5 font-mono text-[11px] min-h-5">
        {hb && hover !== null ? (
          <>
            <span className="text-zinc-400">{dates[hover]}</span>
            <span className="text-zinc-500">开 <b className="text-zinc-200">{hb.o.toFixed(2)}</b></span>
            <span className="text-zinc-500">高 <b className="text-emerald-400">{hb.h.toFixed(2)}</b></span>
            <span className="text-zinc-500">低 <b className="text-red-400">{hb.l.toFixed(2)}</b></span>
            <span className="text-zinc-500">收 <b className={hb.c >= hb.o ? "text-emerald-300" : "text-red-300"}>{hb.c.toFixed(2)}</b></span>
            <span className={`${hb.c >= hb.o ? "text-emerald-400" : "text-red-400"}`}>
              {((hb.c / hb.o - 1) * 100).toFixed(2)}%
            </span>
            <span className="text-zinc-500">量 <b className="text-zinc-200">{(hb.v / 1e6).toFixed(2)}M</b></span>
            {showMA && ma20[hover] !== null && <span className="text-yellow-500/90">MA20 {ma20[hover]!.toFixed(2)}</span>}
            {showMA && ma50[hover] !== null && <span className="text-violet-400">MA50 {ma50[hover]!.toFixed(2)}</span>}
            {macdData.hist[hover] !== null && (
              <span className="text-zinc-500">
                MACD <b className={macdData.hist[hover]! >= 0 ? "text-emerald-400" : "text-red-400"}>{macdData.hist[hover]!.toFixed(3)}</b>
              </span>
            )}
          </>
        ) : (
          <span className="text-zinc-600">滑鼠移動查看數據 · 滾輪縮放 · 按住拖拽平移</span>
        )}
        <span className="flex items-center gap-1 mr-auto sm:mr-0">
          <button onClick={() => setShowMA(!showMA)} title="均線開關"
            className={`px-1.5 py-0.5 rounded border text-[10px] ${showMA ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10" : "border-zinc-800 text-zinc-600"}`}>
            MA
          </button>
          <button onClick={() => setShowBB(!showBB)} title="保力加通道開關"
            className={`px-1.5 py-0.5 rounded border text-[10px] ${showBB ? "border-amber-500/40 text-amber-400 bg-amber-500/10" : "border-zinc-800 text-zinc-600"}`}>
            BB
          </button>
          <button onClick={() => setShowKC(!showKC)} title="Keltner 通道開關"
            className={`px-1.5 py-0.5 rounded border text-[10px] ${showKC ? "border-sky-500/40 text-sky-400 bg-sky-500/10" : "border-zinc-800 text-zinc-600"}`}>
            KC
          </button>
        </span>
        <span className="ml-auto flex items-center gap-1">
          {zoomed && <span className="text-sky-400 mr-1">{win.count} 根</span>}
          <button onClick={() => zoomAt(0.5, 1)} className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" title="放大">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => zoomAt(0.5, -1)} className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" title="縮小">
            <ZoomOut size={14} />
          </button>
          <button onClick={reset} className={`p-1 rounded hover:bg-zinc-800 ${zoomed ? "text-sky-400" : "text-zinc-600"}`} title="重置視圖">
            <Maximize size={14} />
          </button>
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className="w-full select-none"
        style={{ cursor: dragRef.current ? "grabbing" : "crosshair" }}
        onMouseMove={handleMove}
        onMouseDown={(e) => { dragRef.current = { x: e.clientX, moved: false }; }}
        onMouseUp={() => { dragRef.current = null; }}
        onMouseLeave={() => { dragRef.current = null; setHover(null); setMouseY(null); }}
      >
        {/* price gridlines */}
        {[min, min + span / 2, max].map((p) => (
          <g key={p}>
            <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="#27272a" strokeWidth="0.6" />
            <text x={pad.l - 5} y={y(p) + 3} textAnchor="end" fontSize="9" fill="#71717a">
              {p >= 1000 ? p.toFixed(0) : p.toFixed(1)}
            </text>
          </g>
        ))}

        {/* KC band fill + BB/KC lines */}
        {showKC && (
          <>
            {(() => {
              let d = "";
              let started = false;
              const seg = (v: number | null, i: number) => {
                if (v === null) return;
                d += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
                started = true;
              };
              kc.upper.forEach(seg);
              for (let i = kc.lower.length - 1; i >= 0; i--) seg(kc.lower[i], i);
              return <path d={`${d} Z`} fill="rgba(56,189,248,0.07)" stroke="none" />;
            })()}
            <path d={linePath(kc.upper, y)} fill="none" stroke="#0ea5e9" strokeWidth="0.9" opacity={0.7} />
            <path d={linePath(kc.lower, y)} fill="none" stroke="#0ea5e9" strokeWidth="0.9" opacity={0.7} />
          </>
        )}
        {showBB && (
          <>
            <path d={linePath(bb.upper, y)} fill="none" stroke="#f59e0b" strokeWidth="0.9" opacity={0.85} />
            <path d={linePath(bb.lower, y)} fill="none" stroke="#f59e0b" strokeWidth="0.9" opacity={0.85} />
            <path d={linePath(bb.mid, y)} fill="none" stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="3 3" opacity={0.5} />
          </>
        )}

        {/* volume */}
        {visible.map((b, i) => {
          const vh = (b.v / maxVol) * volH;
          return (
            <rect key={i} x={x(i) - bw / 2} y={pad.t + chartH + 2 + (volH - vh)} width={bw} height={vh}
              fill={b.c >= b.o ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)"} />
          );
        })}

        {/* MACD panel */}
        <line x1={pad.l} x2={W - pad.r} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeWidth="0.7" />
        {visible.map((_, i) => {
          const v = macdData.hist[i];
          if (v === null) return null;
          return <line key={i} x1={x(i)} x2={x(i)} y1={zeroY} y2={mY(v)}
            stroke={v >= 0 ? "rgba(52,211,153,0.55)" : "rgba(248,113,113,0.55)"} strokeWidth={bw * 0.7} />;
        })}
        <path d={linePath(macdData.line, mY)} fill="none" stroke="#e4e4e7" strokeWidth="0.9" />
        <path d={linePath(macdData.signal, mY)} fill="none" stroke="#facc15" strokeWidth="0.9" />
        <text x={pad.l + 4} y={macdTop + 10} fontSize="8.5" fill="#71717a">MACD (12,26,9)</text>

        {/* candles */}
        {visible.map((b, i) => {
          const up = b.c >= b.o;
          const color = up ? UP : DOWN;
          const top = y(Math.max(b.o, b.c));
          const hgt = Math.max(0.8, Math.abs(y(b.o) - y(b.c)));
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="1" />
              <rect x={x(i) - bw / 2} y={top} width={bw} height={hgt} fill={up ? "transparent" : color} stroke={color} strokeWidth="1" />
            </g>
          );
        })}

        {/* MAs */}
        {showMA && (
          <>
            <path d={linePath(ma20, y)} fill="none" stroke="#facc15" strokeWidth="1.1" opacity={0.85} />
            <path d={linePath(ma50, y)} fill="none" stroke="#a78bfa" strokeWidth="1.1" opacity={0.85} />
          </>
        )}

        {/* 缠论: 中枢 + 分型 + 买卖点 */}
        {chan && <ChanOverlay chan={chan} base={bars.length - showBars + visOff} count={visible.length} x={x} y={y} />}

        {/* trade levels */}
        {levels.map((lv) => (
          <g key={lv.label}>
            <line x1={pad.l} x2={W - pad.r} y1={y(lv.v)} y2={y(lv.v)} stroke={lv.color} strokeWidth="1"
              strokeDasharray={lv.dash ? "5 4" : undefined} opacity={0.8} />
            <text x={W - pad.r + 5} y={y(lv.v) + 3} fontSize="9.5" fill={lv.color}>
              {lv.label} {lv.v >= 1000 ? lv.v.toFixed(0) : lv.v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* date ticks */}
        {[0.25, 0.5, 0.75].map((f) => {
          const i = Math.min(visible.length - 1, Math.floor(visible.length * f));
          return (
            <text key={f} x={x(i)} y={height - 2} textAnchor="middle" fontSize="8.5" fill="#52525b">
              {dates[i]}
            </text>
          );
        })}

        {/* crosshair */}
        {hb && hover !== null && mouseY !== null && !dragRef.current && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#71717a" strokeWidth="0.6" strokeDasharray="3 3" opacity={0.7} />
            {mouseY > pad.t && mouseY < pad.t + chartH && (
              <>
                <line x1={pad.l} x2={W - pad.r} y1={mouseY} y2={mouseY} stroke="#71717a" strokeWidth="0.6" strokeDasharray="3 3" opacity={0.7} />
                <text x={pad.l - 5} y={mouseY + 3} textAnchor="end" fontSize="9" fill="#a1a1aa">
                  {(max - ((mouseY - pad.t) / chartH) * span).toFixed(2)}
                </text>
              </>
            )}
            <circle cx={x(hover)} cy={y(hb.c)} r="2.5" fill={hb.c >= hb.o ? UP : DOWN} />
          </g>
        )}
      </svg>
    </div>
  );
}
