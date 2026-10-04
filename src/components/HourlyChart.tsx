import { useEffect, useMemo, useRef, useState } from "react";
import type { Bar } from "@/lib/types";
import { macd, sma } from "@/lib/indicators";
import { bollinger, keltner, type ChanResult } from "@/lib/hourly";
import { useChartZoom } from "@/hooks/useChartZoom";
import { ChanOverlay } from "./ChanOverlay";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface Props {
  bars: Bar[];
  showBars?: number;
  chan?: ChanResult;
  height?: number;
}

const UP = "#34d399";
const DOWN = "#f87171";

/** Approximate hourly timestamps: walk back from now, hourly bars within 10:00-16:00 ET. */
function hourLabels(count: number, endOffset: number): string[] {
  const out: string[] = [];
  const d = new Date();
  let back = endOffset;
  const stepBack = () => {
    do {
      d.setTime(d.getTime() - 60 * 60 * 1000);
    } while (d.getDay() === 0 || d.getDay() === 6 || d.getHours() < 10 || d.getHours() > 16);
  };
  while (back > 0) {
    stepBack();
    back--;
  }
  for (let i = 0; i < count; i++) {
    out.unshift(`${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}时`);
    stepBack();
  }
  return out;
}

export function HourlyChart({ bars, showBars = 120, chan, height = 340 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const dragRef = useRef<{ x: number; moved: boolean } | null>(null);

  const data = useMemo(() => bars.slice(-showBars), [bars, showBars]);
  const { win, zoomAt, panBy, reset } = useChartZoom(data.length);
  const visible = data.slice(win.start, win.end);
  const visOff = win.start;

  const labelsAll = useMemo(() => hourLabels(data.length, bars.length - data.length), [data.length, bars.length]);
  const labels = labelsAll.slice(visOff, win.end);

  const W = 720;
  const macdH = 64;
  const volH = 36;
  const pad = { l: 52, r: 10, t: 10, b: 4 };
  const chartH = height - macdH - volH - pad.t - pad.b - 8;

  // indicators on full shown slice, then windowed (valid warm-up at pan edges)
  const closesAll = useMemo(() => data.map((b) => b.c), [data]);
  const bbAll = useMemo(() => bollinger(closesAll), [closesAll]);
  const kcAll = useMemo(() => keltner(data), [data]);
  const macdAll = useMemo(() => macd(closesAll), [closesAll]);
  const ma20All = useMemo(() => sma(closesAll, 20), [closesAll]);
  const ma50All = useMemo(() => sma(closesAll, 50), [closesAll]);

  const ma20 = ma20All.slice(visOff, win.end);
  const ma50 = ma50All.slice(visOff, win.end);

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
    line: macdAll.line.slice(visOff, win.end),
    signal: macdAll.signal.slice(visOff, win.end),
    hist: macdAll.hist.slice(visOff, win.end),
  };

  const min = Math.min(...visible.map((b) => b.l));
  const max = Math.max(...visible.map((b) => b.h));
  const span = max - min || 1;
  const y = (v: number) => pad.t + ((max - v) / span) * chartH;
  const step = (W - pad.l - pad.r) / visible.length;
  const x = (i: number) => pad.l + (i + 0.5) * step;
  const bw = Math.max(1.2, step * 0.6);

  const path = (arr: (number | null)[], yy: (v: number) => number) =>
    arr.map((v, i) => (v === null ? null : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yy(v).toFixed(1)}`)).filter(Boolean).join(" ");

  const macdVals = [...(macdData.line.filter((v) => v !== null) as number[]), ...(macdData.signal.filter((v) => v !== null) as number[])];
  const mMax = Math.max(...macdVals.map(Math.abs), 1e-9);
  const volTop = pad.t + chartH + 2;
  const macdTop = volTop + volH + 4;
  const mY = (v: number) => macdTop + macdH / 2 - (v / mMax) * (macdH / 2 - 6);
  const zeroY = macdTop + macdH / 2;
  const maxVol = Math.max(...visible.map((b) => b.v), 1);

  // ---- wheel zoom (rAF-throttled) + global mouseup to end drag ----
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
    const up = () => { dragRef.current = null; };
    window.addEventListener("mouseup", up);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", up);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [zoomAt]);

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
            <span className="text-zinc-400">{labels[hover]}</span>
            <span className="text-zinc-500">开 <b className="text-zinc-200">{hb.o.toFixed(2)}</b></span>
            <span className="text-zinc-500">高 <b className="text-emerald-400">{hb.h.toFixed(2)}</b></span>
            <span className="text-zinc-500">低 <b className="text-red-400">{hb.l.toFixed(2)}</b></span>
            <span className="text-zinc-500">收 <b className={hb.c >= hb.o ? "text-emerald-300" : "text-red-300"}>{hb.c.toFixed(2)}</b></span>
            <span className={`${hb.c >= hb.o ? "text-emerald-400" : "text-red-400"}`}>
              {((hb.c / hb.o - 1) * 100).toFixed(2)}%
            </span>
            <span className="text-zinc-500">量 <b className="text-zinc-200">{(hb.v / 1e3).toFixed(0)}K</b></span>
            {bb.upper[hover] !== null && (
              <span className="text-amber-500/90">
                %BB {(((hb.c - bb.lower[hover]!) / ((bb.upper[hover]! - bb.lower[hover]!) || 1)) * 100).toFixed(0)}%
              </span>
            )}
            {macdData.hist[hover] !== null && (
              <span className="text-zinc-500">
                MACD <b className={macdData.hist[hover]! >= 0 ? "text-emerald-400" : "text-red-400"}>{macdData.hist[hover]!.toFixed(3)}</b>
              </span>
            )}
          </>
        ) : (
          <span className="text-zinc-600">滑鼠移動查看數據 · 滾輪縮放 · 按住拖拽平移</span>
        )}
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
        {/* KC band fill */}
        {(() => {
          let d = "";
          kc.upper.forEach((v, i) => { if (v !== null) d += `L${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
          for (let i = kc.lower.length - 1; i >= 0; i--) {
            const v = kc.lower[i];
            if (v !== null) d += `L${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          }
          return <path d={`${d} Z`} fill="rgba(56,189,248,0.06)" stroke="none" />;
        })()}
        <path d={path(kc.upper, y)} fill="none" stroke="#0ea5e9" strokeWidth="0.9" opacity={0.7} />
        <path d={path(kc.lower, y)} fill="none" stroke="#0ea5e9" strokeWidth="0.9" opacity={0.7} />
        {/* BB */}
        <path d={path(bb.upper, y)} fill="none" stroke="#f59e0b" strokeWidth="0.9" opacity={0.85} />
        <path d={path(bb.lower, y)} fill="none" stroke="#f59e0b" strokeWidth="0.9" opacity={0.85} />
        <path d={path(bb.mid, y)} fill="none" stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="3 3" opacity={0.5} />

        {/* price gridlines */}
        {[min, min + span / 2, max].map((p) => (
          <g key={p}>
            <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="#27272a" strokeWidth="0.5" />
            <text x={pad.l - 5} y={y(p) + 3} textAnchor="end" fontSize="9" fill="#71717a">
              {p >= 1000 ? p.toFixed(0) : p.toFixed(2)}
            </text>
          </g>
        ))}

        {/* volume strip */}
        {visible.map((b, i) => {
          const vh = (b.v / maxVol) * volH;
          return (
            <rect key={i} x={x(i) - bw / 2} y={volTop + (volH - vh)} width={bw} height={vh}
              fill={b.c >= b.o ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)"} />
          );
        })}
        <text x={pad.l + 4} y={volTop + 10} fontSize="8.5" fill="#71717a">VOL</text>

        {/* candles */}
        {visible.map((b, i) => {
          const up = b.c >= b.o;
          const color = up ? UP : DOWN;
          const top = y(Math.max(b.o, b.c));
          const hgt = Math.max(0.8, Math.abs(y(b.o) - y(b.c)));
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="0.8" />
              <rect x={x(i) - bw / 2} y={top} width={bw} height={hgt} fill={up ? "transparent" : color} stroke={color} strokeWidth="0.8" />
            </g>
          );
        })}

        {/* MAs */}
        <path d={path(ma20, y)} fill="none" stroke="#facc15" strokeWidth="1" opacity={0.85} />
        <path d={path(ma50, y)} fill="none" stroke="#a78bfa" strokeWidth="1" opacity={0.85} />

        {/* 缠论: 中枢 + 分型 + 买卖点 */}
        {chan && <ChanOverlay chan={chan} base={bars.length - showBars + visOff} count={visible.length} x={x} y={y} />}

        {/* MACD panel */}
        <line x1={pad.l} x2={W - pad.r} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeWidth="0.7" />
        {visible.map((_, i) => {
          const v = macdData.hist[i];
          if (v === null) return null;
          return (
            <line key={i} x1={x(i)} x2={x(i)} y1={zeroY} y2={mY(v)}
              stroke={v >= 0 ? "rgba(52,211,153,0.55)" : "rgba(248,113,113,0.55)"} strokeWidth={bw * 0.7} />
          );
        })}
        <path d={path(macdData.line, mY)} fill="none" stroke="#e4e4e7" strokeWidth="0.9" />
        <path d={path(macdData.signal, mY)} fill="none" stroke="#facc15" strokeWidth="0.9" />
        <text x={pad.l + 4} y={macdTop + 11} fontSize="8.5" fill="#71717a">MACD (12,26,9)</text>

        {/* hour ticks */}
        {[0.25, 0.5, 0.75].map((f) => {
          const i = Math.min(visible.length - 1, Math.floor(visible.length * f));
          return (
            <text key={f} x={x(i)} y={height - 2} textAnchor="middle" fontSize="8" fill="#52525b">
              {labels[i]}
            </text>
          );
        })}

        {/* crosshair */}
        {hb && hover !== null && mouseY !== null && !dragRef.current && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - 6} stroke="#71717a" strokeWidth="0.6" strokeDasharray="3 3" opacity={0.7} />
            {mouseY > pad.t && mouseY < pad.t + chartH && (
              <>
                <line x1={pad.l} x2={W - pad.r} y1={mouseY} y2={mouseY} stroke="#71717a" strokeWidth="0.6" strokeDasharray="3 3" opacity={0.7} />
                <text x={pad.l - 5} y={mouseY + 3} textAnchor="end" fontSize="9" fill="#a1a1aa">
                  {(max - ((mouseY - pad.t) / chartH) * span).toFixed(2)}
                </text>
              </>
            )}
            <circle cx={x(hover)} cy={y(hb.c)} r="2.2" fill={hb.c >= hb.o ? UP : DOWN} />
          </g>
        )}
      </svg>
    </div>
  );
}
