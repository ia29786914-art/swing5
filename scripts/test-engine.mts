import { analyzeHourly } from "../src/lib/hourly.ts";
import { analyzeStock } from "../src/lib/engine.ts";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../src/data/stocks.json", import.meta.url), "utf8"));

let chan1 = 0, chan2 = 0, diverge = 0, sqFire = 0, sqOn = 0, gold = 0, score45 = 0;
for (const s of data.stocks) {
  const h = analyzeHourly(s);
  if (h.chanSignal === "一买") chan1++;
  if (h.chanSignal === "二买") chan2++;
  if (h.chan.bottomDivergence) diverge++;
  if (h.squeeze.justReleased && h.squeeze.releaseDir === "long") sqFire++;
  if (h.squeeze.isSqueezed) sqOn++;
  if (h.macdState === "金叉") gold++;
  if (h.score >= 45) score45++;
}

const daily = data.stocks.map(analyzeStock);
const dailySignals = daily.filter((d) => d.strategy !== "none");

console.log("=== hourly ===");
console.log("一买:", chan1, " 二买:", chan2, " 底背驰:", diverge);
console.log("Squeeze释放:", sqFire, " 挤压中:", sqOn, " MACD金叉:", gold);
console.log("评分>=45:", score45, "/", data.stocks.length);
console.log("=== daily ===");
console.log("信号数:", dailySignals.length, "/", data.stocks.length);

// show top 5 hourly
const top = data.stocks.map(analyzeHourly).sort((a, b) => b.score - a.score).slice(0, 5);
for (const t of top) {
  console.log(t.raw.ticker, "score=" + t.score, t.signalLabel,
    "entry=" + t.entry.toFixed(2), "stop=" + t.stop.toFixed(2), "target=" + t.target.toFixed(2));
}
