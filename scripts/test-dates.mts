import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "fs";
import { CandleChart } from "../src/components/CandleChart";
import { HourlyChart } from "../src/components/HourlyChart";

const raw = JSON.parse(readFileSync(new URL("../src/data/stocks.json", import.meta.url), "utf-8"));
const stock = raw.stocks[0];
const d = renderToString(createElement(CandleChart, { bars: stock.bars, showBars: 250 }));
const h = renderToString(createElement(HourlyChart, { bars: stock.hourly, showBars: 200 }));
const pick = (html: string) => [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
console.log("daily text labels:", pick(d).slice(-4));
console.log("hourly text labels:", pick(h).slice(-4));
