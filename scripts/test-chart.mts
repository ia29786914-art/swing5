// Smoke test: render CandleChart with REAL data, inspect produced SVG paths.
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "fs";
import { CandleChart } from "../src/components/CandleChart";

const raw = JSON.parse(readFileSync(new URL("../src/data/stocks.json", import.meta.url), "utf-8"));
const stock = raw.stocks[0];
console.log("stock:", stock.ticker, "bars:", stock.bars.length);

const html = renderToString(createElement(CandleChart, { bars: stock.bars, showBars: 120 }));
const dAttrs = [...html.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]);
console.log("total path d:", dAttrs.length);
console.log("starts with M:", dAttrs.filter((d) => d.startsWith("M")).length);
console.log("starts with L:", dAttrs.filter((d) => d.startsWith("L")).length);
console.log("empty d:", dAttrs.filter((d) => d.length === 0).length);
for (const d of dAttrs) console.log("  [" + d.slice(0, 30) + (d.length > 30 ? "…len=" + d.length : "") + "]");
console.log("has MA20 yellow path:", html.includes('stroke="#facc15"'));
console.log("has BB amber path:", html.includes('stroke="#f59e0b"'));
console.log("has KC sky path:", html.includes('stroke="#0ea5e9"'));
console.log("has volume rects:", (html.match(/<rect/g) || []).length);
