import { readFileSync } from "fs";
import { runBacktest, buildReport } from "../src/lib/backtest";

const raw = JSON.parse(readFileSync(new URL("../src/data/stocks.json", import.meta.url), "utf-8"));
const t0 = Date.now();
const trades = runBacktest(raw.stocks);
const t1 = Date.now();
const rep = buildReport(trades);
console.log(`backtest: ${t1 - t0}ms, signals: ${trades.length}`);
console.log("overall:", JSON.stringify(rep.overall));
for (const [k, v] of Object.entries(rep.byStrategy)) console.log(k, "winRate", v.winRate.toFixed(1), "avgR", v.avgR.toFixed(2), "count", v.count);
console.log("byYear:", Object.entries(rep.byYear).map(([y, v]) => `${y}: n=${v.count} win=${v.winRate.toFixed(0)}% avgR=${v.avgR.toFixed(2)}`).join(" | "));
console.log("open:", rep.openCount);
console.log("sample:", JSON.stringify(trades[trades.length - 2]), JSON.stringify(trades[trades.length - 1]));
