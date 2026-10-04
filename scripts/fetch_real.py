# Fetch REAL data from Yahoo Finance chart API (no auth needed):
#   - daily bars:  interval=1d, range=3y   (~750 bars)
#   - hourly bars: interval=1h, range=1y   (~1700 bars, US sessions)
# Writes src/data/stocks.json in the exact schema the app already consumes.
# Universe = current NQ100 + DJIA constituents (scripts/index_members.json),
# plus the original watchlist. Sector / market cap are static metadata.
import json, time, urllib.request, os

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

BASE = [
    ("PLTR","Palantir Tech","软件", 90), ("SHOP","Shopify Inc.","电商", 110),
    ("UBER","Uber Technologies","出行", 150), ("COIN","Coinbase Glb","加密", 60),
    ("MSTR","MicroStrategy","加密", 40), ("SMCI","Super Micro Computer","硬件", 45),
    ("ARM","Arm Holdings","半导体", 140),
    ("SQ_PLACEHOLDER","-","-",0),
    ("NET","Cloudflare Inc.","软件", 30), ("DDOG","Datadog Inc.","软件", 40),
    ("MDB","MongoDB Inc.","软件", 25), ("RBLX","Roblox Corp.","传媒", 45),
    ("HOOD","Robinhood Mkts","金融", 40), ("SOFI","SoFi Technologies","金融", 18),
    ("AFRM","Affirm Holdings","金融", 12), ("RIVN","Rivian Automotive","汽车", 15),
    ("LCID","Lucid Group","汽车", 9), ("F","Ford Motor Co.","汽车", 45),
    ("XOM","Exxon Mobil","能源", 520),
]

GICS_ZH = {
    "Information Technology": "科技", "Technology": "科技",
    "Health Care": "医疗", "Consumer Discretionary": "可选消费",
    "Consumer Staples": "必需消费", "Industrials": "工业",
    "Financials": "金融", "Communication Services": "通信服务",
    "Telecommunications": "通信服务", "Utilities": "公用事业",
    "Energy": "能源", "Real Estate": "房地产", "Materials": "原材料",
}

def build_meta():
    here = os.path.dirname(os.path.abspath(__file__))
    idx = json.load(open(os.path.join(here, "index_members.json"), encoding="utf-8"))
    meta = {}
    for tk, (name, sector) in idx["dj_meta"].items():
        meta[tk] = [name, sector, 0]
    for tk, (name, sector) in idx["nq"].items():
        meta[tk] = [name, GICS_ZH.get(sector, sector or "其他"), 0]
    for tk, name, sector, mcap in BASE:
        if tk == "SQ_PLACEHOLDER":
            continue
        meta[tk] = [name, sector, mcap]
    return sorted(meta.items())

def fetch(symbol, interval, range_):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range_}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        payload = json.loads(r.read().decode())
    result = payload["chart"]["result"][0]
    ts = result.get("timestamp") or []
    q = result["indicators"]["quote"][0]
    out = []
    for i, t in enumerate(ts):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        v = q["volume"][i] or 0
        if o is None or h is None or l is None or c is None:
            continue
        out.append({"o": round(o, 2), "h": round(h, 2), "l": round(l, 2),
                    "c": round(c, 2), "v": int(v)})
    return out

stocks, failed = [], []
META = build_meta()
print(f"universe: {len(META)} tickers")
for tk, (name, sector, mcap) in META:
    try:
        daily = fetch(tk, "1d", "3y")
        time.sleep(0.35)
        hourly = fetch(tk, "1h", "1y")
        time.sleep(0.35)
        if len(daily) < 100 or len(hourly) < 100:
            raise ValueError(f"too few bars: daily={len(daily)} hourly={len(hourly)}")
        stocks.append({"ticker": tk, "name": name, "sector": sector,
                       "marketCap": mcap, "basePrice": daily[-1]["c"],
                       "bars": daily, "hourly": hourly})
        print(f"OK  {tk}: daily={len(daily)} hourly={len(hourly)} last=${daily[-1]['c']}")
    except Exception as e:
        failed.append(tk)
        print(f"ERR {tk}: {e}")

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "stocks.json")
with open(out, "w") as f:
    json.dump({"generatedFor": "Swing5 real data via Yahoo Finance v8 chart API",
               "source": "Yahoo Finance", "stocks": stocks}, f, separators=(",", ":"))
print(f"\nstocks: {len(stocks)}, failed: {failed}")
if len(stocks) < 80:
    print("FATAL: too few stocks fetched, treating as failure")
    raise SystemExit(1)
