# Generate realistic OHLCV daily data for ~40 liquid US stocks, 300 trading days.
# Seeded per ticker so the dataset is reproducible. Deliberately varies regime per
# stock so different swing setups (breakout, pullback, reversal, momentum) appear.
import json, math, random

STOCKS = [
    ("AAPL","Apple Inc.","科技", 3500, 230),
    ("MSFT","Microsoft Corp.","科技", 3100, 420),
    ("NVDA","NVIDIA Corp.","半导体", 2900, 880),
    ("TSLA","Tesla Inc.","汽车", 900, 250),
    ("AMD","Adv Micro Devices","半导体", 260, 150),
    ("META","Meta Platforms","科技", 1400, 510),
    ("GOOGL","Alphabet Inc.","科技", 2100, 170),
    ("AMZN","Amazon.com Inc.","电商", 1900, 185),
    ("NFLX","Netflix Inc.","传媒", 380, 680),
    ("AVGO","Broadcom Inc.","半导体", 700, 160),
    ("CRM","Salesforce Inc.","软件", 300, 320),
    ("ORCL","Oracle Corp.","软件", 340, 140),
    ("PLTR","Palantir Tech","软件", 90, 28),
    ("SHOP","Shopify Inc.","电商", 110, 75),
    ("UBER","Uber Technologies","出行", 150, 72),
    ("COIN","Coinbase Glb","加密", 60, 220),
    ("MSTR","MicroStrategy","加密", 40, 300),
    ("SMCI","Super Micro Computer","硬件", 45, 45),
    ("ARM","Arm Holdings","半导体", 140, 130),
    ("MU","Micron Technology","半导体", 110, 105),
    ("QCOM","Qualcomm Inc.","半导体", 190, 160),
    ("INTC","Intel Corp.","半导体", 90, 22),
    ("PYPL","PayPal Holdings","金融", 80, 68),
    ("SQ","Block Inc.","金融", 45, 82),
    ("NET","Cloudflare Inc.","软件", 30, 95),
    ("DDOG","Datadog Inc.","软件", 40, 120),
    ("CRWD","CrowdStrike Hld","软件", 90, 310),
    ("PANW","Palo Alto Networks","软件", 110, 190),
    ("SNOW","Snowflake Inc.","软件", 60, 160),
    ("MDB","MongoDB Inc.","软件", 25, 260),
    ("RBLX","Roblox Corp.","传媒", 45, 42),
    ("HOOD","Robinhood Mkts","金融", 40, 34),
    ("SOFI","SoFi Technologies","金融", 18, 12),
    ("AFRM","Affirm Holdings","金融", 12, 38),
    ("RIVN","Rivian Automotive","汽车", 15, 14),
    ("LCID","Lucid Group","汽车", 9, 3.2),
    ("F","Ford Motor Co.","汽车", 45, 11),
    ("XOM","Exxon Mobil","能源", 520, 115),
    ("JPM","JPMorgan Chase","金融", 680, 240),
]

DAYS = 300

def simulate(ticker, base_price, seed):
    rng = random.Random(seed)
    price = base_price * rng.uniform(0.35, 0.75)
    bars = []
    # regime: 0=drift up, 1=chop, 2=drift down, 3=strong trend
    regime = rng.randint(0, 3)
    regime_left = rng.randint(15, 60)
    base_vol = rng.uniform(0.015, 0.045)
    drift_map = {0: 0.0012, 1: 0.0, 2: -0.0012, 3: 0.0022}
    for i in range(DAYS):
        regime_left -= 1
        if regime_left <= 0:
            regime = rng.randint(0, 3)
            regime_left = rng.randint(15, 60)
        drift = drift_map[regime]
        # occasional shock / event day (earnings-like gap)
        shock = 0.0
        if rng.random() < 0.012:
            shock = rng.choice([-1, 1]) * rng.uniform(0.04, 0.11)
        ret = drift + rng.gauss(0, base_vol) + shock
        open_p = price * (1 + rng.gauss(0, base_vol * 0.4))
        close_p = max(0.5, price * (1 + ret))
        high_p = max(open_p, close_p) * (1 + abs(rng.gauss(0, base_vol * 0.5)))
        low_p = min(open_p, close_p) * (1 - abs(rng.gauss(0, base_vol * 0.5)))
        vol_base = rng.uniform(8e6, 5e7)
        vol = vol_base * (1 + abs(ret) * 22 + rng.random() * 0.5)
        bars.append({
            "o": round(open_p, 2), "h": round(high_p, 2),
            "l": round(low_p, 2), "c": round(close_p, 2),
            "v": int(vol),
        })
        price = close_p
    return bars

def simulate_hourly(ticker, base_price, seed):
    """350 hourly bars (50 days x 7 hours). U-shaped intraday volume,
    realistic open/close/hi/lo structure anchored around the same base price."""
    rng = random.Random(seed)
    price = base_price * rng.uniform(0.35, 0.75)
    bars = []
    regime = rng.randint(0, 3)
    regime_left = rng.randint(10, 30)
    base_vol = rng.uniform(0.015, 0.04) / math.sqrt(7)  # hourly vol from daily vol
    drift_map = {0: 0.0012, 1: 0.0, 2: -0.0012, 3: 0.0022}
    vol_shape = [1.35, 0.85, 0.8, 0.7, 0.85, 1.0, 1.45]  # open/close heavy
    vol_base = rng.uniform(1.5e5, 1.2e6)
    for day in range(50):
        regime_left -= 1
        if regime_left <= 0:
            regime = rng.randint(0, 3)
            regime_left = rng.randint(10, 30)
        day_ret = drift_map[regime] + rng.gauss(0, base_vol * 1.6)
        if rng.random() < 0.02:
            day_ret += rng.choice([-1, 1]) * rng.uniform(0.02, 0.06)
        # overnight gap
        price = price * (1 + rng.gauss(0, base_vol * 0.8))
        for h in range(7):
            o = price
            ret = day_ret / 7 + rng.gauss(0, base_vol)
            c = max(0.3, o * (1 + ret))
            hi = max(o, c) * (1 + abs(rng.gauss(0, base_vol * 0.45)))
            lo = min(o, c) * (1 - abs(rng.gauss(0, base_vol * 0.45)))
            v = vol_base * vol_shape[h] * (1 + abs(ret) * 90 + rng.random() * 0.6)
            bars.append({"o": round(o, 2), "h": round(hi, 2), "l": round(lo, 2),
                         "c": round(c, 2), "v": int(v)})
            price = c
    return bars

out = []
for idx, (tk, name, sector, mcap, base) in enumerate(STOCKS):
    bars = simulate(tk, base, seed=hash(tk) % (2**31))
    hbars = simulate_hourly(tk, base, seed=(hash(tk) % (2**31)) + 7)
    out.append({
        "ticker": tk, "name": name, "sector": sector,
        "marketCap": mcap, "basePrice": base,
        "bars": bars, "hourly": hbars,
    })

with open(r"D:\KimiData\kimi\Workspaces\USRTB\swing5\src\data\stocks.json", "w") as f:
    json.dump({"generatedFor": "Swing5 demo dataset", "days": DAYS, "stocks": out}, f, separators=(",", ":"))
print("stocks:", len(out), "daily bars:", DAYS, "hourly bars:", len(out[0]["hourly"]))
