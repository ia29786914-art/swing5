import type { ChanResult } from "@/lib/hourly";

interface Props {
  chan: ChanResult;
  base: number;      // global bar index of visible[0]
  count: number;     // visible.length
  x: (localIdx: number) => number;
  y: (price: number) => number;
}

/**
 * Chan-theory overlay: 中枢 zones (orange boxes), 顶/底 fractals (triangles),
 * 一买/二买 (below bar) and 一卖/二卖 (above bar) markers.
 */
export function ChanOverlay({ chan, base, count, x, y }: Props) {
  const end = base + count;

  const zs = chan.zhongshu
    .filter((z) => z.endIdx >= base && z.startIdx < end)
    .map((z) => ({ ...z, s: Math.max(z.startIdx, base), e: Math.min(z.endIdx, end - 1) }))
    .filter((z) => z.e > z.s);

  const fractals = chan.fractals.filter((f) => f.idx >= base && f.idx < end);
  const buys = chan.buyPoints.filter((p) => p.idx >= base && p.idx < end);
  const sells = chan.sellPoints.filter((p) => p.idx >= base && p.idx < end);

  return (
    <g>
      {/* 中枢 zones */}
      {zs.map((z, i) => {
        const x1 = x(z.s - base);
        const x2 = x(z.e - base);
        const top = y(z.zg);
        const hgt = Math.max(2, y(z.zd) - y(z.zg));
        return (
          <g key={`zs${i}`}>
            <rect x={x1} y={top} width={x2 - x1} height={hgt}
              fill="rgba(245,158,11,0.10)" stroke="rgba(245,158,11,0.5)" strokeWidth="0.8" strokeDasharray="4 3" />
            <text x={(x1 + x2) / 2} y={top + 9} textAnchor="middle" fontSize="8" fill="rgba(245,158,11,0.85)">
              中枢
            </text>
          </g>
        );
      })}

      {/* 分型 */}
      {fractals.map((f, i) => (
        <g key={`f${i}`}>
          {f.type === "top" ? (
            <>
              <path d={`M${x(f.idx - base)},${y(f.price) - 3} L${x(f.idx - base) - 3.5},${y(f.price) - 10} L${x(f.idx - base) + 3.5},${y(f.price) - 10} Z`} fill="#f87171" />
              <text x={x(f.idx - base)} y={y(f.price) - 13} textAnchor="middle" fontSize="8" fill="#f87171">顶</text>
            </>
          ) : (
            <>
              <path d={`M${x(f.idx - base)},${y(f.price) + 3} L${x(f.idx - base) - 3.5},${y(f.price) + 10} L${x(f.idx - base) + 3.5},${y(f.price) + 10} Z`} fill="#34d399" />
              <text x={x(f.idx - base)} y={y(f.price) + 19} textAnchor="middle" fontSize="8" fill="#34d399">底</text>
            </>
          )}
        </g>
      ))}

      {/* 买卖点 */}
      {buys.map((p, i) => (
        <text key={`b${i}`} x={x(p.idx - base)} y={y(p.price) + 30} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fb7185">
          ▼{p.type}
        </text>
      ))}
      {sells.map((p, i) => (
        <text key={`s${i}`} x={x(p.idx - base)} y={y(p.price) - 20} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#2dd4bf">
          {p.type}▲
        </text>
      ))}
    </g>
  );
}
