import { useCallback, useEffect, useState } from "react";

export interface ZoomWin {
  start: number; // first visible bar index (inclusive)
  end: number;   // exclusive
  count: number;
}

/**
 * Zoom/pan state over a fixed-length bar array.
 * - zoomAt(ratio, dir): zoom in/out keeping the bar at `ratio` (0..1 of the visible window) anchored
 * - panBy(bars): shift the window by N bars (positive = drag left = view moves right)
 */
export function useChartZoom(total: number) {
  const [win, setWin] = useState<ZoomWin>({ start: 0, end: total, count: total });

  // reset when the underlying series changes (different stock / different showBars)
  useEffect(() => {
    setWin({ start: 0, end: total, count: total });
  }, [total]);

  const zoomAt = useCallback(
    (ratio: number, dir: 1 | -1) => {
      setWin((w) => {
        const factor = dir === 1 ? 0.78 : 1.3;
        const count = Math.max(20, Math.min(total, Math.round(w.count * factor)));
        if (count === w.count) return w;
        const anchor = w.start + ratio * w.count;
        const start = Math.max(0, Math.min(total - count, Math.round(anchor - ratio * count)));
        return { start, end: start + count, count };
      });
    },
    [total]
  );

  const panBy = useCallback(
    (bars: number) => {
      setWin((w) => {
        const start = Math.max(0, Math.min(total - w.count, w.start + bars));
        return { ...w, start, end: start + w.count };
      });
    },
    [total]
  );

  const reset = useCallback(() => setWin({ start: 0, end: total, count: total }), [total]);

  return { win, zoomAt, panBy, reset };
}
