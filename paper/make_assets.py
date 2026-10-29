#!/usr/bin/env python3
"""Generate every number, table and figure in paper/main.tex from committed data.

Nothing in the paper is typed in by hand. This script re-runs the per-stock
models exactly as scripts/ml/05_generate_signals.py does, checks that the result
matches the committed data/ml-signals.json, and then writes:

    paper/numbers.tex        one \\newcommand per number quoted in the text
    paper/tables/*.tex       table bodies
    paper/figures/*.pdf      vector figures

Run from the repository root:

    python paper/make_assets.py
"""
from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
PAPER = ROOT / "paper"
FIG = PAPER / "figures"
TAB = PAPER / "tables"
FIG.mkdir(exist_ok=True)
TAB.mkdir(exist_ok=True)

FEATURES = ["ma5", "ma20", "ret", "ma_ratio"]

# ----------------------------------------------------------------------
# Figure style, shared with the other two papers in the series
# ----------------------------------------------------------------------
BLUE, ORANGE, GREY, INK = "#1f5aa6", "#d9702a", "#8c8c8c", "#222222"
plt.rcParams.update({
    "font.family": "STIXGeneral", "mathtext.fontset": "stix",
    "font.size": 8.5, "axes.titlesize": 8.5, "axes.labelsize": 8.5,
    "xtick.labelsize": 7.5, "ytick.labelsize": 7.5, "legend.fontsize": 7.5,
    "axes.linewidth": 0.6, "axes.edgecolor": "#444444",
    "xtick.major.width": 0.6, "ytick.major.width": 0.6,
    "xtick.major.size": 2.5, "ytick.major.size": 2.5,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#e8e8e8", "grid.linewidth": 0.5,
    "axes.axisbelow": True, "legend.frameon": False,
    "lines.linewidth": 1.0, "pdf.fonttype": 42,
    "savefig.bbox": "tight", "savefig.pad_inches": 0.02,
    "axes.titlelocation": "left", "axes.titleweight": "normal",
})
WIDTH = 6.5  # text width in inches


def panel(ax, text):
    ax.set_title(text, fontsize=8.5, pad=6)


# ----------------------------------------------------------------------
# Number formatting for LaTeX
# ----------------------------------------------------------------------
MACROS: dict[str, str] = {}


def num(x: float, d: int, signed: bool = False) -> str:
    s = f"{x:+.{d}f}" if signed else f"{x:.{d}f}"
    return f"\\ensuremath{{{s}}}" if s.startswith(("-", "+")) else s


def pct(x: float, d: int = 1, signed: bool = False) -> str:
    """x is a fraction; returns a LaTeX percentage."""
    return num(100 * x, d, signed) + "\\%"


def macro(name: str, value) -> None:
    assert name.isalpha(), name
    MACROS[name] = str(value)


def thousands(n: int) -> str:
    return f"{n:,}".replace(",", "{,}")


def longdate(s: str) -> str:
    """2019-07-01 -> 1~July~2019, for dates in running text."""
    return pd.Timestamp(s).strftime("%-d %B %Y").replace(" ", "~")


# ----------------------------------------------------------------------
# Re-run the models
# ----------------------------------------------------------------------
spec = importlib.util.spec_from_file_location(
    "gen", ROOT / "scripts" / "ml" / "05_generate_signals.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

from sklearn.linear_model import LinearRegression  # noqa: E402
from sklearn.metrics import r2_score  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

prices = pd.read_csv(ROOT / "scripts" / "ml" / "raw_prices.csv",
                     index_col="Date", parse_dates=True)
signals = json.loads((ROOT / "data" / "ml-signals.json").read_text())
missing = json.loads((ROOT / "data" / "ml-missing.json").read_text())
universe = json.loads((ROOT / "data" / "universe.json").read_text())
detail = json.loads((ROOT / "data" / "reliance-model-detail.json").read_text())

rows = []
for t in sorted(signals):
    f = gen.build_features(prices[t].dropna())
    cut = int(len(f) * gen.TRAIN_FRAC)
    train, test = f.iloc[:cut], f.iloc[cut:]
    sc = StandardScaler()
    model = LinearRegression().fit(sc.fit_transform(train[FEATURES]),
                                   train["ret_target"])
    pred = model.predict(sc.transform(test[FEATURES]))
    y = test["ret_target"].to_numpy()
    acc = float(((pred > 0) == (y > 0)).mean())
    up = float((y > 0).mean())
    rec = signals[t]
    # The paper must describe the committed results, not a near relative.
    assert abs(round(acc, 4) - rec["dirAccuracy"]) < 1e-9, t
    assert abs(round(up, 4) - rec["naiveBaseline"]) < 1e-9, t
    assert abs(round(float(r2_score(y, pred)), 6) - rec["r2Return"]) < 1e-9, t
    n = len(y)
    k = int(((pred > 0) == (y > 0)).sum())
    # Pesaran and Timmermann (1992) test of directional accuracy, which
    # allows for the base rates of predicted and realised up days.
    px, py = float((pred > 0).mean()), up
    p_star = py * px + (1 - py) * (1 - px)
    v_p = p_star * (1 - p_star) / n
    v_ps = ((2 * py - 1) ** 2 * px * (1 - px) / n
            + (2 * px - 1) ** 2 * py * (1 - py) / n
            + 4 * py * px * (1 - py) * (1 - px) / n ** 2)
    pt = (acc - p_star) / math.sqrt(v_p - v_ps) if v_p - v_ps > 0 else np.nan
    rows.append(dict(
        ticker=t, n=n, k=k, acc=acc, up=up, edge=acc - up, r2=rec["r2Return"],
        cap=rec["marketCapCategory"], top=rec["topFeature"],
        w_ratio=rec["maRatioWeight"], px=px, pt=pt,
        p_binom=stats.binomtest(k, n, 0.5).pvalue,
        test_chg=test["close"].iloc[-1] / test["close"].iloc[0] - 1,
        full=rec["dataQuality"] == "full",
    ))
df = pd.DataFrame(rows)
N = len(df)


def bh(p: np.ndarray, q: float = 0.05) -> np.ndarray:
    """Benjamini-Hochberg rejections at false discovery rate q."""
    order = np.argsort(p)
    ranked = p[order] * len(p) / (np.arange(len(p)) + 1)
    passed = np.where(ranked <= q)[0]
    out = np.zeros(len(p), bool)
    if len(passed):
        out[order[: passed.max() + 1]] = True
    return out


df["bh"] = bh(df["p_binom"].to_numpy())
df["p_pt"] = 2 * stats.norm.sf(np.abs(df["pt"]))
pt_ok = df["pt"].notna()
df.loc[pt_ok, "bh_pt"] = bh(df.loc[pt_ok, "p_pt"].to_numpy())

# ----------------------------------------------------------------------
# Numbers quoted in the text
# ----------------------------------------------------------------------
macro("NUniverse", len(universe))
macro("NStocks", N)
macro("NExcluded", len(missing))
macro("NFull", int(df["full"].sum()))
macro("NPartial", int((~df["full"]).sum()))
macro("MeanTestDays", num(df["n"].mean(), 1))
macro("MinTestDays", int(df["n"].min()))
macro("MaxTestDays", int(df["n"].max()))
obs = [len(gen.build_features(prices[t].dropna())) for t in df["ticker"]]
macro("MedianObs", thousands(int(np.median(obs))))
macro("MedianTrainObs", thousands(int(np.median([int(o * 0.8) for o in obs]))))

macro("RsqMean", num(df["r2"].mean(), 4))
macro("RsqMedian", num(df["r2"].median(), 4))
macro("RsqMin", num(df["r2"].min(), 3))
macro("RsqMax", num(df["r2"].max(), 3, signed=True))
macro("NRsqPos", int((df["r2"] > 0).sum()))
macro("NRsqNeg", int((df["r2"] < 0).sum()))

macro("AccMean", pct(df["acc"].mean()))
macro("AccSD", num(100 * df["acc"].std(), 1))
macro("AccMin", pct(df["acc"].min()))
macro("AccMax", pct(df["acc"].max()))
tt = stats.ttest_1samp(df["acc"], 0.5)
macro("AccTstat", num(tt.statistic, 2))
macro("UpMean", pct(df["up"].mean()))
macro("EdgeMean", num(100 * df["edge"].mean(), 2, signed=True))
macro("NEdgePos", int((df["edge"] > 0).sum()))
macro("RandomEdge", num(100 * (0.5 - df["up"]).mean(), 2, signed=True))
macro("NWeakBench", int((df["up"] < 0.5).sum()))
macro("EdgeBenchCorr", num(np.corrcoef(df["edge"], 0.5 - df["up"])[0, 1], 2))
excess = df["edge"] - (0.5 - df["up"])  # = acc - 0.5
macro("NBeatRandom", int((excess > 0).sum()))
macro("MedianTestChange", pct(df["test_chg"].median(), 2, signed=True))
macro("NRose", int((df["test_chg"] > 0).sum()))

se = math.sqrt(0.25 / df["n"].mean())
macro("SEAcc", num(100 * se, 1))
macro("TwoSE", num(200 * se, 1))
band = 2 * se
# Accuracy one stock would need for an 80%-power, two-sided 5% binomial test.
mde = (stats.norm.ppf(0.975) + stats.norm.ppf(0.80)) * se
macro("MDEAcc", pct(0.5 + mde, 1))
macro("MDEpp", num(100 * mde, 1))
macro("PooledSE", num(100 * df["acc"].std() / math.sqrt(N), 2))
macro("NOutsideBand", int((df["edge"].abs() > band).sum()))
macro("NAboveBand", int((df["edge"] > band).sum()))
macro("NBelowBand", int((df["edge"] < -band).sum()))
sig = df["p_binom"] < 0.05
macro("NSigAbove", int((sig & (df["acc"] > 0.5)).sum()))
macro("NSigBelow", int((sig & (df["acc"] < 0.5)).sum()))
macro("NSigAboveBH", int((df["bh"] & (df["acc"] > 0.5)).sum()))
macro("NSigBelowBH", int((df["bh"] & (df["acc"] < 0.5)).sum()))
macro("ExpectedPerTail", num(0.025 * N, 1))
macro("NPTDefined", int(pt_ok.sum()))
macro("NPTUndefined", int((~pt_ok).sum()))
ptsig = df["p_pt"] < 0.05
macro("NPTSigPos", int((ptsig & (df["pt"] > 0)).sum()))
macro("NPTSigNeg", int((ptsig & (df["pt"] < 0)).sum()))
macro("NPTBH", int(df["bh_pt"].fillna(False).astype(bool).sum()))
macro("PTMedian", num(df["pt"].median(), 2))
macro("PxMedian", pct(df["px"].median()))

counts = df["top"].value_counts()
for f, name in [("ma5", "TopMaFive"), ("ma20", "TopMaTwenty"),
                ("ret", "TopRet"), ("ma_ratio", "TopRatio")]:
    macro(name, int(counts.get(f, 0)))
npos = int((df["w_ratio"] > 0).sum())
macro("NRatioPos", npos)
macro("NRatioNeg", int((df["w_ratio"] < 0).sum()))
macro("SignTestP", num(stats.binomtest(npos, N, 0.5).pvalue, 2))
macro("RatioAbsMean", num(df["w_ratio"].abs().mean(), 4))
macro("RatioAbsMeanPP", num(100 * df["w_ratio"].abs().mean(), 2))

# Reliance worked example
pm, nm, rm = detail["priceModel"], detail["naiveModel"], detail["returnModel"]
macro("RelTrainStart", longdate(detail["trainDateRange"]["start"]))
macro("RelTrainEnd", longdate(detail["trainDateRange"]["end"]))
macro("RelTestStart", longdate(detail["testDateRange"]["start"]))
macro("RelTestEnd", longdate(detail["testDateRange"]["end"]))
macro("RelTestDays", detail["metrics"]["testDays"])
macro("RelPriceRsq", num(pm["r2"], 3))
macro("RelNaiveRsq", num(nm["r2"], 3))
macro("RelMAEcut", f"{round(100 * (1 - nm['mae'] / pm['mae']))}\\%")
ret_rows = rm["testPeriodData"]
act = np.array([r["actualReturn"] for r in ret_rows])
prd = np.array([r["predictedReturn"] for r in ret_rows])
macro("RelActLo", pct(act.min(), 1))
macro("RelActHi", pct(act.max(), 1, signed=True))
macro("RelPredBand", pct(np.abs(prd).max(), 2))
# The random walk's R^2 is 1 - (RMSE / SD of the close)^2, with the SD taken
# around the evaluation-sample mean as in r2_score.
close_sd = np.array([r["actual"] for r in pm["testPeriodData"]]).std()
assert abs(1 - (nm["rmse"] / close_sd) ** 2 - nm["r2"]) < 1e-4
macro("RelCloseSD", num(close_sd, 1))
macro("RelRWRMSE", num(nm["rmse"], 1))
macro("RelPriceDir", pct(pm["dirAccuracy"], 1))
macro("RelNaiveDir", pct(nm["dirAccuracy"], 1))
macro("RelReturnDir", pct(rm["dirAccuracy"], 1))
macro("RelUpShare", pct(rm["naiveDirAccuracy"], 1))
macro("RelEdge", num(100 * (rm["dirAccuracy"] - rm["naiveDirAccuracy"]), 1, signed=True))
assert abs(nm["dirAccuracy"] + rm["naiveDirAccuracy"] - 1) < 1e-6  # down days + up days

# ----------------------------------------------------------------------
# Tables
# ----------------------------------------------------------------------
def write(name: str, text: str) -> None:
    (TAB / name).write_text(text.strip() + "\n")


write("summary.tex", rf"""
\begin{{tabular}}{{@{{}}lr@{{}}}}
\toprule
\multicolumn{{2}}{{@{{}}l}}{{\textit{{Panel A. Fit of the return forecast}}}} \\
\quad Mean $R^2_{{OS}}$ & {num(df['r2'].mean(), 4)} \\
\quad Median $R^2_{{OS}}$ & {num(df['r2'].median(), 4)} \\
\quad Range & {num(df['r2'].min(), 3)} to {num(df['r2'].max(), 3, signed=True)} \\
\quad Stocks with $R^2_{{OS}} > 0$ & {int((df['r2'] > 0).sum())} of {N} \\
\addlinespace
\multicolumn{{2}}{{@{{}}l}}{{\textit{{Panel B. Direction of the forecast}}}} \\
\quad Mean directional accuracy & {pct(df['acc'].mean())} \\
\quad Range of directional accuracy & {pct(df['acc'].min())} to {pct(df['acc'].max())} \\
\quad Mean share of up days (always-up benchmark) & {pct(df['up'].mean())} \\
\quad Mean edge over always-up (pp) & {num(100 * df['edge'].mean(), 2, signed=True)} \\
\quad Expected edge of an uninformative forecast (pp) & {num(100 * (0.5 - df['up']).mean(), 2, signed=True)} \\
\quad Stocks with a positive edge & {int((df['edge'] > 0).sum())} of {N} \\
\addlinespace
\multicolumn{{2}}{{@{{}}l}}{{\textit{{Panel C. Per-stock inference, 5\% level}}}} \\
\quad Accuracy significantly above 50\% (binomial) & {int((sig & (df['acc'] > .5)).sum())} \\
\quad Accuracy significantly below 50\% (binomial) & {int((sig & (df['acc'] < .5)).sum())} \\
\quad Significant after Benjamini-Hochberg & {int(df['bh'].sum())} \\
\quad Significant Pesaran-Timmermann statistic & {int(ptsig.sum())} \\
\addlinespace
\multicolumn{{2}}{{@{{}}l}}{{\textit{{Panel D. The moving-average ratio}}}} \\
\quad Stocks where \texttt{{ma\_ratio}} has the largest coefficient & {int(counts.get('ma_ratio', 0))} of {N} \\
\quad Positive coefficient & {npos} of {N} \\
\quad Mean absolute coefficient & {num(df['w_ratio'].abs().mean(), 4)} \\
\bottomrule
\end{{tabular}}
""")

caps = (df.groupby("cap")
          .agg(n=("acc", "size"), acc=("acc", "mean"), up=("up", "mean"),
               edge=("edge", "mean"), r2=("r2", "mean"),
               w=("w_ratio", lambda s: s.abs().mean()))
          .reindex(["Large", "Mid", "Small"]))
body = "\n".join(
    rf"{b} & {int(r.n)} & {100*r.acc:.1f} & {100*r.up:.1f} & {100*r.edge:+.2f} & {r.r2:.4f} \\"
    for b, r in caps.iterrows())
write("bycap.tex", rf"""
\begin{{tabular}}{{@{{}}lrrrrr@{{}}}}
\toprule
Band & $n$ & Accuracy (\%) & Up days (\%) & Edge (pp) & Mean $R^2_{{OS}}$ \\
\midrule
{body}
\midrule
All & {N} & {100*df.acc.mean():.1f} & {100*df.up.mean():.1f} & {100*df.edge.mean():+.2f} & {df.r2.mean():.4f} \\
\bottomrule
\end{{tabular}}
""".replace("-0.", "$-$0.").replace("+", "$+$"))

write("reliance.tex", rf"""
\begin{{tabular}}{{@{{}}lrrr@{{}}}}
\toprule
 & Price model & Random walk & Return model \\
\midrule
MAE & \rupee{pm['mae']:.2f} & \rupee{nm['mae']:.2f} & {rm['mae']:.4f} \\
RMSE & \rupee{pm['rmse']:.2f} & \rupee{nm['rmse']:.2f} & {rm['rmse']:.4f} \\
$R^2$ against the test mean & {pm['r2']:.4f} & {nm['r2']:.4f} & $-${abs(rm['r2']):.4f} \\
Directional accuracy (\%) & {100*pm['dirAccuracy']:.1f} & {100*nm['dirAccuracy']:.1f} & {100*rm['dirAccuracy']:.1f} \\
\bottomrule
\end{{tabular}}
""")

ranked = df.sort_values("edge", ascending=False).reset_index(drop=True)
ranked["rank"] = np.arange(1, N + 1)


def edge_row(r) -> str:
    r2 = f"{r.r2:+.3f}".replace("-", "$-$").replace("+", "$+$")
    return (rf"{int(r['rank'])} & {r.ticker} & {r.cap} & {100*r.acc:.1f} & "
            rf"{100*r.up:.1f} & {100*r.edge:+.1f} & {r2} & {r.p_binom:.2f} \\"
            ).replace("& +", "& $+$").replace("& -", "& $-$")


top = "\n".join(edge_row(r) for _, r in ranked.head(8).iterrows())
bot = "\n".join(edge_row(r) for _, r in ranked.tail(8).iterrows())
write("extremes.tex", rf"""
\begin{{tabular}}{{@{{}}rllrrrrr@{{}}}}
\toprule
Rank & Ticker & Band & Accuracy (\%) & Up days (\%) & Edge (pp) & $R^2_{{OS}}$ & Binomial $p$ \\
\midrule
{top}
\addlinespace
\multicolumn{{8}}{{@{{}}c}}{{\textit{{\dots}}}} \\
\addlinespace
{bot}
\bottomrule
\end{{tabular}}
""")

# ----------------------------------------------------------------------
# Figures
# ----------------------------------------------------------------------
# Figure 2: distribution of R^2 and accuracy against the benchmark
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.55),
                           gridspec_kw={"width_ratios": [1, 1.05], "wspace": 0.32})
bins = np.arange(-0.135, 0.0501, 0.005)
h1 = a.hist(df.r2[df.r2 <= 0], bins=bins, color=ORANGE, edgecolor="white", linewidth=0.4)[0]
h2 = a.hist(df.r2[df.r2 > 0], bins=bins, color=BLUE, edgecolor="white", linewidth=0.4)[0]
top_ = max(h1.max(), h2.max())
a.axvline(0, color=INK, lw=0.8)
a.axvline(df.r2.mean(), color=INK, lw=0.8, ls=(0, (2, 2)))
a.annotate(f"mean {df.r2.mean():.4f}".replace("-", "\u2212"), xy=(df.r2.mean(), top_ * 0.92),
           xytext=(-0.085, top_ * 0.92), ha="center", va="center", fontsize=7.5,
           arrowprops=dict(arrowstyle="-", lw=0.5, color=INK))
a.set_xlabel(r"Out-of-sample $R^2$")
a.set_ylabel("Number of stocks")
a.set_ylim(0, top_ * 1.12)
a.set_xticks([-0.12, -0.08, -0.04, 0, 0.04])
a.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
a.grid(axis="x", visible=False)
panel(a, r"Panel A. Distribution of $R^2_{OS}$")

lo, hi = 38, 58
b.plot([lo, hi], [lo, hi], color=GREY, lw=0.7, ls=(0, (3, 2)))
b.axhline(50, color=INK, lw=0.6, ls=(0, (1, 1.5)))
beat = df.acc > df.up
b.scatter(100 * df.up[beat], 100 * df.acc[beat], s=9, color=BLUE, lw=0, label="above benchmark")
b.scatter(100 * df.up[~beat], 100 * df.acc[~beat], s=9, color=ORANGE, lw=0, label="at or below benchmark")
b.text(hi - 0.3, 50.35, "50%", ha="right", va="bottom", fontsize=7)
b.set_xlim(lo, hi)
b.set_ylim(lo, hi)
b.set_xticks(range(40, 60, 5))
b.set_yticks(range(40, 60, 5))
b.set_aspect("equal")
b.set_xlabel("Share of up days in the evaluation window (%)")
b.set_ylabel("Directional accuracy (%)")
b.legend(loc="upper left", handletextpad=0.1, borderaxespad=0.1, labelspacing=0.25)
b.set_ylim(lo, hi + 1.5)
panel(b, "Panel B. Accuracy against the always-up benchmark")
fig.savefig(FIG / "fit_and_direction.pdf")
plt.close(fig)

# Figure 3: model edge against the edge of an uninformative forecast
fig, ax = plt.subplots(figsize=(WIDTH * 0.62, 2.9))
x = 100 * (0.5 - df.up)
y = 100 * df.edge
ax.axhspan(-200 * se, 200 * se, color="#f0f0f0", zorder=0, lw=0)
ax.plot([-8, 14], [-8, 14], color=INK, lw=0.8)
ax.scatter(x, y, s=10, color=BLUE, lw=0, zorder=3)
ax.axhline(0, color=GREY, lw=0.5)
ax.axvline(0, color=GREY, lw=0.5)
ax.set_xlim(-8, 14)
ax.set_ylim(-10, 12)
ax.set_xlabel("Expected edge of an uninformative forecast, $50\\% - b_i$ (pp)")
ax.set_ylabel("Model edge, $\\mathrm{DA}_i - b_i$ (pp)")
ax.text(-7.6, 200 * se + 0.3, r"$\pm 2$ standard errors around zero", fontsize=7,
        color="#555555", va="bottom")
ax.set_xticks(range(-5, 15, 5))
ax.set_yticks(range(-10, 15, 5))
fig.savefig(FIG / "edge_vs_random.pdf")
plt.close(fig)

# Figure 4: parity plots for the level and return models
pp = pm["testPeriodData"]
pa = np.array([r["actual"] for r in pp])
pf = np.array([r["predicted"] for r in pp])
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.75), gridspec_kw={"wspace": 0.33})
lo_, hi_ = math.floor(min(pa.min(), pf.min()) / 50) * 50, math.ceil(max(pa.max(), pf.max()) / 50) * 50
a.plot([lo_, hi_], [lo_, hi_], color=INK, lw=0.7, ls=(0, (3, 2)))
a.scatter(pf, pa, s=6, color=BLUE, alpha=0.75, lw=0)
a.set_xlim(lo_, hi_)
a.set_ylim(lo_, hi_)
a.set_aspect("equal")
a.set_xlabel("Forecast close (INR)")
a.set_ylabel("Realised close (INR)")
panel(a, f"Panel A. Price model ($R^2 = {pm['r2']:.3f}$)")
bound = math.ceil(max(np.abs(act).max(), np.abs(prd).max()) * 100)
b.plot([-bound, bound], [-bound, bound], color=INK, lw=0.7, ls=(0, (3, 2)))
b.scatter(100 * prd, 100 * act, s=6, color=ORANGE, alpha=0.75, lw=0)
b.set_xlim(-bound, bound)
b.set_ylim(-bound, bound)
b.set_aspect("equal")
b.set_xlabel("Forecast return (%)")
b.set_ylabel("Realised return (%)")
panel(b, f"Panel B. Return model ($R^2 = {rm['r2']:.3f}$)")
fig.savefig(FIG / "reliance_parity.pdf")
plt.close(fig)

import matplotlib.dates as mdates  # noqa: E402

# Figure 1: the golden and death cross, from Britannia's closes in 2019
br = prices["BRITANNIA"].dropna()
ma5_b, ma20_b = br.rolling(5).mean(), br.rolling(20).mean()
win = slice("2019-08-01", "2019-11-30")
c_, f5, f20 = br.loc[win], ma5_b.loc[win], ma20_b.loc[win]
fig, ax = plt.subplots(figsize=(WIDTH * 0.62, 2.35))
ax.plot(c_.index, c_, color="#c9c9c9", lw=0.8, label="Daily close")
ax.plot(f5.index, f5, color=BLUE, lw=1.2, label="5-day average")
ax.plot(f20.index, f20, color=INK, lw=1.2, label="20-day average")
sign = np.sign(f5 - f20)
golden = [d for d in sign.index[1:][(sign.diff().iloc[1:] > 0).to_numpy()]]
death = [d for d in sign.index[1:][(sign.diff().iloc[1:] < 0).to_numpy()]]
assert len(golden) == 1 and len(death) == 1, (golden, death)
for d, lab, col, off in [(golden[0], "golden cross", BLUE, (22, -26)), (death[0], "death cross", ORANGE, (16, -30))]:
    ax.scatter([d], [f5.loc[d]], s=30, zorder=4, color=col, edgecolor="white", lw=0.6)
    ax.annotate(lab, (d, f5.loc[d]), xytext=off, textcoords="offset points", ha="left",
                fontsize=7.5, color=col, arrowprops=dict(arrowstyle="-", lw=0.6, color=col,
                shrinkA=0, shrinkB=4))
macro("CrossGolden", golden[0].strftime("%-d %B %Y").replace(" ", "~"))
macro("CrossDeath", death[0].strftime("%-d %B %Y").replace(" ", "~"))
ax.set_ylabel("Price (INR)")
ax.xaxis.set_major_locator(mdates.MonthLocator())
ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
ax.legend(loc="upper left", ncol=3, handlelength=1.4, columnspacing=1.0)
ax.set_ylim(c_.min() * 0.95, c_.max() * 1.1)
fig.savefig(FIG / "cross.pdf")
plt.close(fig)

# Figure: the universe over the sample, and the share of up days per stock
full = [t for t in df.loc[df["full"], "ticker"]]
norm = pd.DataFrame({t: prices[t].dropna() / prices[t].dropna().iloc[0] for t in df["ticker"]})
eval_start = pd.Timestamp(detail["testDateRange"]["start"])
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.6),
                           gridspec_kw={"width_ratios": [1.45, 1], "wspace": 0.3})
for t in norm.columns:
    a.plot(norm.index, norm[t], color="#bdbdbd", lw=0.35, alpha=0.7)
med = norm[full].median(axis=1)
a.plot(med.index, med, color=BLUE, lw=1.4, label="Median stock")
a.axvspan(eval_start, norm.index[-1], color=ORANGE, alpha=0.12, lw=0)
a.text(eval_start + pd.Timedelta(days=15), 1.015, "evaluation", fontsize=7, color="#8a4a17",
       transform=a.get_xaxis_transform(), va="bottom")
a.set_yscale("log")
a.set_yticks([0.25, 0.5, 1, 2, 4, 8, 16])
a.set_yticklabels(["0.25", "0.5", "1", "2", "4", "8", "16"])
a.minorticks_off()
a.set_ylabel("Price relative to first close")
a.legend(loc="upper left")
a.xaxis.set_major_locator(mdates.YearLocator(2))
a.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
panel(a, "Panel A. Price paths of the 98 stocks")
b.hist(100 * df["up"], bins=np.arange(36, 58, 1.5), color=BLUE, edgecolor="white", lw=0.4)
b.axvline(50, color=INK, lw=0.8)
b.axvline(100 * df["up"].mean(), color=ORANGE, lw=1.0, ls=(0, (3, 2)))
b.text(36.3, b.get_ylim()[1] * 0.93, f"mean {100*df['up'].mean():.1f}%",
       ha="left", fontsize=7, color="#8a4a17")
b.set_xlabel("Share of up days in evaluation (%)")
b.set_ylabel("Number of stocks")
b.grid(axis="x", visible=False)
panel(b, "Panel B. Share of up days")
fig.savefig(FIG / "universe.pdf")
plt.close(fig)
macro("MedianFullGrowth", num(med.loc[:eval_start].iloc[-1], 2))

# Figure: per-stock edge, ranked, against the noise band
r_ = df.sort_values("edge").reset_index(drop=True)
fig, ax = plt.subplots(figsize=(WIDTH, 2.4))
ax.axhspan(-200 * se, 200 * se, color="#efefef", lw=0, zorder=0)
ax.bar(np.arange(N), 100 * r_["edge"], width=0.82,
       color=[BLUE if e > 0 else ORANGE for e in r_["edge"]], lw=0)
ax.axhline(0, color=INK, lw=0.6)
ax.axhline(100 * df["edge"].mean(), color=INK, lw=0.7, ls=(0, (3, 2)))
ax.text(1, 200 * se + 0.4, r"$\pm 2$ standard errors", fontsize=7, color="#555555")
ax.text(27, 100 * df["edge"].mean() + 0.45, f"mean {100*df['edge'].mean():+.2f}",
        fontsize=7, ha="left")
ax.set_xlim(-1, N)
ax.set_xticks([0, 24, 49, 74, 97], ["1", "25", "50", "75", "98"])
ax.set_xlabel("Stocks ranked by edge")
ax.set_ylabel("Edge over always-up (pp)")
ax.grid(axis="x", visible=False)
fig.savefig(FIG / "edge_ranked.pdf")
plt.close(fig)

# Figure: the moving-average ratio's coefficient, and all four features compared
W = pd.DataFrame({t: signals[t]["weights"] for t in df["ticker"]}).T[FEATURES]
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.45),
                           gridspec_kw={"width_ratios": [1.5, 1], "wspace": 0.32})
wr = (1e4 * W["ma_ratio"]).sort_values().to_numpy()
a.bar(np.arange(N), wr, width=0.82, color=[BLUE if v > 0 else ORANGE for v in wr], lw=0)
a.axhline(0, color=INK, lw=0.6)
a.set_xlim(-1, N)
a.set_xticks([])
a.set_xlabel("Stocks ranked by coefficient")
a.set_ylabel("Coefficient (bp per SD)")
a.grid(axis="x", visible=False)
panel(a, r"Panel A. Coefficient on $\mathit{ratio}$, by stock")
mabs = 1e4 * W.abs().mean()
labels_ = [r"$\mathit{ma5}$", r"$\mathit{ma20}$", r"$r_t$", r"$\mathit{ratio}$"]
b.bar(range(4), mabs.to_numpy(), color=[GREY, GREY, GREY, BLUE], width=0.6)
for i, f_ in enumerate(FEATURES):
    b.text(i, mabs[f_] + mabs.max() * 0.03, f"largest for\n{int(counts.get(f_, 0))}",
           ha="center", va="bottom", fontsize=6.5)
b.set_xticks(range(4), labels_)
b.set_ylim(0, mabs.max() * 1.35)
b.set_ylabel("Mean |coefficient| (bp per SD)")
b.grid(axis="x", visible=False)
panel(b, "Panel B. All four features")
fig.savefig(FIG / "ratio_coefficients.pdf")
plt.close(fig)
macro("MeanAbsMaFive", num(mabs["ma5"], 1))
macro("MeanAbsMaTwenty", num(mabs["ma20"], 1))
macro("MeanAbsRatioBp", num(mabs["ma_ratio"], 1))

# Figure: results by capitalisation band
bands = ["Large", "Mid", "Small"]
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.3),
                           gridspec_kw={"width_ratios": [1, 1.1], "wspace": 0.35})
for i, band_ in enumerate(bands):
    g_ = df[df["cap"] == band_]
    acc_, up_ = 100 * g_["acc"].mean(), 100 * g_["up"].mean()
    a.plot([up_, acc_], [i, i], color=GREY, lw=1.2, zorder=1)
    a.scatter([up_], [i], s=34, facecolor="white", edgecolor=INK, lw=0.9, zorder=2,
              label="Always-up benchmark" if i == 0 else None)
    a.scatter([acc_], [i], s=34, color=BLUE, zorder=3, label="Model accuracy" if i == 0 else None)
    b.scatter(100 * g_["edge"], np.full(len(g_), i) + np.random.default_rng(i).uniform(-0.18, 0.18, len(g_)),
              s=8, color=BLUE, alpha=0.65, lw=0)
    b.plot([100 * g_["edge"].mean()] * 2, [i - 0.3, i + 0.3], color=INK, lw=1.4)
a.axvline(50, color=INK, lw=0.6, ls=(0, (1, 1.5)))
a.set_yticks(range(3), [f"{b_} ({int((df['cap'] == b_).sum())})" for b_ in bands])
a.set_ylim(-0.45, 3.0)
a.invert_yaxis()
a.set_xlabel("Directional accuracy (%)")
a.legend(loc="lower left", fontsize=6.8, handletextpad=0.2, borderaxespad=0.3,
         labelspacing=0.3)
panel(a, "Panel A. Band means")
b.axvline(0, color=INK, lw=0.6)
b.set_yticks(range(3), bands)
b.set_ylim(-0.45, 3.0)
b.invert_yaxis()
b.set_xlabel("Edge over always-up (pp)")
panel(b, "Panel B. Individual stocks")
fig.savefig(FIG / "by_cap.pdf")
plt.close(fig)

# Figure: Reliance over the evaluation period, levels, returns and residuals
pdts = pd.to_datetime([r["date"] for r in pp])
rdts = pd.to_datetime([r["date"] for r in ret_rows])
resid = np.array([r["residual"] for r in ret_rows])
fig, (a, b, c3) = plt.subplots(3, 1, figsize=(WIDTH, 4.4), sharex=True,
                               gridspec_kw={"height_ratios": [1.15, 1, 0.85], "hspace": 0.28})
a.plot(pdts, pa, color=INK, lw=0.9, label="Realised close")
a.plot(pdts, pf, color=BLUE, lw=0.9, label="Price-model forecast")
a.set_ylabel("Close (INR)")
a.legend(loc="upper left", ncol=2, frameon=True, framealpha=0.92, edgecolor="none")
panel(a, "Panel A. Price model: the forecast tracks the level")
b.plot(rdts, 100 * act, color="#9a9a9a", lw=0.6, label="Realised return")
b.plot(rdts, 100 * prd, color=ORANGE, lw=1.1, label="Return-model forecast")
b.axhline(0, color=INK, lw=0.5)
b.set_ylabel("Daily return (%)")
b.legend(loc="upper left", ncol=2, frameon=True, framealpha=0.92, edgecolor="none")
panel(b, "Panel B. Return model: the forecast stays near zero")
c3.scatter(rdts, 100 * resid, s=4, color=BLUE, alpha=0.7, lw=0)
c3.axhline(0, color=INK, lw=0.5)
c3.set_ylabel("Residual (pp)")
c3.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
panel(c3, "Panel C. Return-model residuals")
fig.savefig(FIG / "reliance_series.pdf")
plt.close(fig)

# Figure: the coefficients of both Reliance models
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.2), gridspec_kw={"wspace": 0.45})
pw = [pm["featureWeights"][f_] for f_ in FEATURES]
rw = [1e4 * rm["featureWeights"][f_] for f_ in FEATURES]
for ax_, vals_, unit, ttl in [(a, pw, "INR per SD", "Panel A. Price model"),
                              (b, rw, "bp of return per SD", "Panel B. Return model")]:
    y_ = np.arange(4)[::-1]
    ax_.barh(y_, vals_, color=[BLUE if v > 0 else ORANGE for v in vals_], height=0.55)
    ax_.axvline(0, color=INK, lw=0.6)
    span_ = max(abs(v) for v in vals_)
    for yi, v in zip(y_, vals_):
        ax_.text(v + (0.04 * span_ if v >= 0 else -0.04 * span_), yi,
                 (f"{v:+.1f}" if abs(v) >= 1 else f"{v:+.2f}").replace("-", "\u2212"),
                 va="center", ha="left" if v >= 0 else "right", fontsize=7)
    ax_.set_yticks(y_, labels_)
    ax_.set_xlim(-span_ * 1.45, span_ * 1.45)
    ax_.set_xlabel(f"Coefficient ({unit})")
    ax_.grid(axis="y", visible=False)
    panel(ax_, ttl)
fig.savefig(FIG / "reliance_coefficients.pdf")
plt.close(fig)

# Figure: a two-feature slice of the fitted return model
from mpl_toolkits.mplot3d import Axes3D  # noqa: E402,F401
x5 = np.array([r["ma5Scaled"] for r in ret_rows])
x20 = np.array([r["ma20Scaled"] for r in ret_rows])
gx, gy = np.meshgrid(np.linspace(x5.min(), x5.max(), 20), np.linspace(x20.min(), x20.max(), 20))
wts = rm["featureWeights"]
gz = 100 * (wts["bias"] + wts["ma5"] * gx + wts["ma20"] * gy)
# Draw the plane only over the band the observations occupy. The two averages
# move together, so the data lie along a narrow diagonal, and the plane far from
# it describes combinations of the features that never occur.
gap = x5 - x20
gz = np.where(((gx - gy) >= gap.min() - 0.05) & ((gx - gy) <= gap.max() + 0.05), gz, np.nan)
fig = plt.figure(figsize=(WIDTH * 0.62, 2.7))
ax = fig.add_subplot(111, projection="3d")
fig.subplots_adjust(left=0, right=1, bottom=0, top=1)
ax.plot_surface(gx, gy, gz, color=BLUE, alpha=0.28, lw=0)
ax.scatter(x5, x20, 100 * act, s=3, color=INK, alpha=0.55, depthshade=False)
ax.set_xlabel(r"$\mathit{ma5}$ (standardised)", labelpad=-2)
ax.set_ylabel(r"$\mathit{ma20}$ (standardised)", labelpad=-2)
ax.set_zlabel("Return (%)", labelpad=-4)
ax.tick_params(pad=-2, labelsize=6.5)
ax.xaxis.set_major_locator(plt.MaxNLocator(4))
ax.yaxis.set_major_locator(plt.MaxNLocator(4))
ax.zaxis.set_major_locator(plt.MaxNLocator(5))
ax.view_init(elev=16, azim=-58)
ax.set_box_aspect((1.3, 1, 0.72), zoom=0.95)
ax.grid(False)
for pane in (ax.xaxis.pane, ax.yaxis.pane, ax.zaxis.pane):
    pane.set_facecolor("white")
    pane.set_edgecolor("#dddddd")
fig.savefig(FIG / "fitted_plane.pdf")
plt.close(fig)


# ======================================================================
# Parts II and III: the monthly strategy and its survivorship-free rerun
# ======================================================================
# These numbers are read from the outputs the strategy pipeline committed
# (scripts/strategy/03 to 07), not recomputed here: the backtests take minutes,
# and the protocol depends on the holdout having been run once. Each figure and
# table below is a view of those files.
import sys  # noqa: E402

sys.path.insert(0, str(ROOT / "scripts" / "strategy"))
import config as SC  # noqa: E402

SD = ROOT / "data" / "strategy"
SR = ROOT / "results" / "strategy"


def jload(p: Path) -> dict:
    return json.loads(p.read_text())


RUN = {k: {"bt": jload(SD / d / "backtest.json"), "rb": jload(SD / d / "robustness.json"),
           "m": pd.read_csv(SR / d / "monthly_returns.csv", index_col="month")}
       for k, d in [("Surv", ""), ("Pit", "pit"), ("PitSurv", "pit-survivors")]}
SV = jload(SD / "survivorship.json")
DEV = jload(SD / "signals-dev.json")
DEVN = jload(SD / "pit" / "signals-dev.json")
DQ = jload(SD / "pit" / "data_quality.json")
P_ = SC.PRIMARY
PER = {"Dev": "development", "Hold": "holdout", "Full": "full"}

# The site and the paper must quote the same figures as the results memo.
assert RUN["Pit"]["bt"]["primary"] == P_ and RUN["Surv"]["bt"]["holdoutUnlocked"]


def row(run: str, period: str, name: str = P_) -> dict:
    return RUN[run]["bt"]["stats"][PER[period]]["rows"][name]


def tstat(x: float) -> str:
    return num(x, 2)


for run in RUN:
    for per in PER:
        s, ew, nf = row(run, per), row(run, per, "EW"), row(run, per, "NIFTY500")
        macro(f"{run}Cagr{per}", pct(s["cagr"]))
        macro(f"{run}EwCagr{per}", pct(ew["cagr"]))
        macro(f"{run}NiftyCagr{per}", pct(nf["cagr"]))
        macro(f"{run}Sharpe{per}", num(s["sharpe"], 2))
        macro(f"{run}EwSharpe{per}", num(ew["sharpe"], 2))
        macro(f"{run}NiftySharpe{per}", num(nf["sharpe"], 2))
        macro(f"{run}MaxDD{per}", pct(s["maxDrawdown"]))
        macro(f"{run}EwMaxDD{per}", pct(ew["maxDrawdown"]))
        macro(f"{run}Active{per}", pct(s["activeReturn"], 1, signed=True))
        macro(f"{run}ActiveT{per}", tstat(s["activeT"]))
        macro(f"{run}Alpha{per}", pct(s["alpha"], 1, signed=True))
        macro(f"{run}AlphaT{per}", tstat(s["alphaT"]))
        macro(f"{run}Dsr{per}", num(s["dsr"], 2))
        macro(f"{run}Cost{per}", pct(s["costDrag"], 1))
        macro(f"{run}Turnover{per}", f"{100 * s['turnover']:.0f}\\%")
        macro(f"{run}BreakEven{per}", num(s["breakEvenCostMultiple"], 1))
        macro(f"{run}Names{per}", f"{s['names']:.0f}")
        lo_, hi_ = s["sharpeCI"]
        macro(f"{run}SharpeLo{per}", num(lo_, 2))
        macro(f"{run}SharpeHi{per}", num(hi_, 2))
        if "NIFTY500_MOM50" in RUN[run]["bt"]["stats"][PER[per]]["rows"]:
            mo = row(run, per, "NIFTY500_MOM50")
            macro(f"{run}MomCagr{per}", pct(mo["cagr"]))
            macro(f"{run}MomSharpe{per}", num(mo["sharpe"], 2))
            macro(f"{run}MomMaxDD{per}", pct(mo["maxDrawdown"]))

# Survivorship: how much the universe moved the strategy and the benchmark.
bias_s = row("Surv", "Full")["cagr"] - row("Pit", "Full")["cagr"]
bias_e = row("Surv", "Full", "EW")["cagr"] - row("Pit", "Full", "EW")["cagr"]
macro("BiasStrategy", num(100 * bias_s, 1))
macro("BiasEw", num(100 * bias_e, 1))
macro("BiasSource", num(100 * (row("Surv", "Full")["cagr"] - row("PitSurv", "Full")["cagr"]), 1))
macro("BiasRounded", f"{round(100 * (bias_s + bias_e) / 2):.0f}")
for k, name in [("survivor", "Surv"), ("pit-survivors", "PitSurv"), ("pit", "Pit")]:
    g = SV["runs"][k]["ewAgainstNifty500EW"]
    macro(f"{name}EwGap", pct(g["ewCagr"] - g["indexCagr"], 1, signed=True))
    macro(f"{name}EwCorr", num(g["corr"], 3))
    macro(f"{name}FactorAlpha", pct(SV["runs"][k]["full"]["factorAlphaActive"], 1, signed=True))
    macro(f"{name}FactorAlphaT", tstat(SV["runs"][k]["full"]["factorAlphaActiveT"]))
    macro(f"{name}Wml", num(SV["runs"][k]["full"]["wmlActive"], 2))
macro("IndexEwCagr", pct(SV["runs"]["pit"]["ewAgainstNifty500EW"]["indexCagr"]))
cen = SV["exitCensus"]
macro("NExitsEval", cen["exits"])
macro("NExitsInEw", cen["inEW"])
macro("NExitsInEwDistress", cen["inEWDistress"])
macro("NExitsInStrategy", cen["inStrategy"])
macro("NExitsInStrategyDistress", cen["inStrategyDistress"])
sens = SV["sensitivity"]
for k, name in [("distress +0%", "DistressZero"), ("distress -100%", "DistressAll"),
                ("top 200", "TopTwoHundred"), ("top 1000", "TopThousand")]:
    for per, pk in [("Full", "full"), ("Hold", "holdout"), ("Dev", "development")]:
        macro(f"{name}Active{per}", pct(sens[k][pk]["activeReturn"], 1, signed=True))
        macro(f"{name}ActiveT{per}", tstat(sens[k][pk]["activeT"]))
        macro(f"{name}Cagr{per}", pct(sens[k][pk]["cagr"]))

# Design and protocol, from the frozen configuration.
macro("NCandidates", len(SC.CANDIDATES))
macro("NSelected", len(SC.SELECTED))
macro("TThreshold", num(SC.IC_T_THRESHOLD, 0))
macro("NWLags", SC.NW_LAGS)
macro("NTrials", RUN["Pit"]["bt"]["stats"]["full"]["trials"])
macro("NRandom", thousands(SC.N_RANDOM))
macro("NPlacebo", SC.N_PLACEBO)
macro("NBoot", thousands(SC.N_BOOT))
macro("BootBlock", SC.BOOT_BLOCK)
macro("CostSTT", f"{100 * SC.STT:.1f}\\%")
macro("CostStamp", f"{100 * SC.STAMP_BUY:.3f}\\%")
macro("SpreadLow", SC.SPREAD_BPS[0])
macro("SpreadMid", SC.SPREAD_BPS[1])
macro("SpreadHigh", SC.SPREAD_BPS[2])
macro("PitTopN", SC.PIT_TOP_N)
macro("PitUniverse", int(SC.PIT_TOP_N * (1 - SC.LIQ_DROP_FRAC)))
macro("DistressReturn", f"{100 * SC.PIT_EXIT_RETURNS['distress']:.0f}\\%".replace("-", "$-$"))
macro("MinTradedPct", f"{100 * SC.MIN_TRADED_FRAC:.0f}\\%")
macro("LiqDropPct", f"{100 * SC.LIQ_DROP_FRAC:.0f}\\%")
for k, name in [("MOM_12_1", "Mom"), ("HIGH52", "High"), ("TREND_200", "Trend"),
                ("VOLSHOCK", "Vol")]:
    macro(f"DevT{name}", num(DEV["signals"][k]["icT"], 2, signed=True))
    macro(f"DevIc{name}", num(DEV["signals"][k]["meanIC"], 3, signed=True))
nse_sel = [k for k, v in DEVN["signals"].items() if v["selected"]]
macro("NSelectedNse", len(nse_sel))
macro("NSurvivorUniverse", len(pd.read_csv(ROOT / "scripts" / "strategy" / "raw" / "adj_close.csv.gz",
                                           nrows=0).columns) - 1)

# Data checks on the NSE panel.
cov = DQ["coverage"]
macro("NSessionsNse", thousands(cov["sessions"][2]))
macro("NStocksNse", thousands(cov["stocks"]))
macro("NEverEligible", thousands(cov["everEligible"]))
ya = DQ["againstYahoo"]
macro("YahooAgree", pct(ya["2010-2026"]["within1pct"], 1))
macro("YahooAgreeEarly", pct(ya["2005-2009 (NSE: price only)"]["within1pct"], 1))
macro("YahooMonths", thousands(ya["2010-2026"]["stockMonths"]))
cal = DQ["splitRuleCalibration"]
rk = [k for k in cal if k.startswith("rule used: 1:2")][0]
hk = [k for k in cal if k.startswith("rule used: any fall")][0]
macro("SplitRuleHit", cal[rk]["recorded"])
macro("SplitRuleN", cal[rk]["flagged"])
macro("HugeRuleHit", cal[hk]["recorded"])
macro("HugeRuleN", cal[hk]["flagged"])
macro("NExitsEver", DQ["exits"]["everEligible"])
gross = DQ["againstNifty500EW"]
macro("PitEwGrossCagr", pct(gross["pit"]["cagr"]))
macro("PitEwGrossCorr", num(gross["pit"]["corr"], 3))
macro("NMissingSplits", sum(1 for line in (ROOT / "scripts" / "strategy" / "corporate_actions_missing.csv")
                              .read_text().splitlines()[1:] if line and not line.startswith("#")) - 1)

# Skill, attribution and weak points (survivorship-free run).
rb = RUN["Pit"]["rb"]
for per in PER:
    pk = PER[per]
    macro(f"PitIc{per}", num(rb["ic"][pk]["meanIC"], 3, signed=True))
    macro(f"PitIcT{per}", tstat(rb["ic"][pk]["t"]))
    macro(f"PitRandomPct{per}", f"{100 * rb['random'][pk]['percentile']:.0f}\\%")
    macro(f"PitRandomTop{per}", num(rb["random"][pk]["randomSharpe95"], 2))
    macro(f"PitGrossSharpe{per}", num(rb["random"][pk]["strategyGrossSharpe"], 2))
    macro(f"PitPlaceboPct{per}", pct(rb["placebo"][pk]["percentile"], 1))
    macro(f"PitCanary{per}", num(rb["canary"][pk]["forwardReturnSharpe"], 1))
    macro(f"PitStale{per}", num(rb["canary"][pk]["oneMonthStaleSharpe"], 2))
macro("PitWmlCorr", num(rb["wmlCheck"]["corr"], 3))
macro("SurvWmlCorr", num(RUN["Surv"]["rb"]["wmlCheck"]["corr"], 3))
att = rb["attribution"]["full"]
macro("FactorEnd", pd.Period(att["end"], "M").strftime("%B %Y"))
macro("PitPrimaryAlpha", pct(att["primary"]["alpha"], 1, signed=True))
macro("PitPrimaryAlphaT", tstat(att["primary"]["alphaT"]))
macro("PitPrimaryWml", num(att["primary"]["WML"], 2))
for i, name in enumerate(["Liquid", "Middle", "Illiquid"]):
    t_ = rb["byTercile"][str(i)]["full"]
    macro(f"Tercile{name}Active", pct(t_["activeReturn"], 1, signed=True))
    macro(f"Tercile{name}ActiveT", tstat(t_["activeT"]))
    macro(f"Tercile{name}Alpha", pct(t_["alpha"], 1, signed=True))
    macro(f"Tercile{name}AlphaT", tstat(t_["alphaT"]))
yrs = rb["byYear"]
for y, name in [("2009", "Nine"), ("2025", "TwentyFive"), ("2016", "Sixteen")]:
    macro(f"Year{name}Strategy", pct(yrs[y]["primary"], 1, signed=True))
    macro(f"Year{name}Ew", pct(yrs[y]["EW"], 1, signed=True))
macro("YearsBehind", sum(1 for v in yrs.values() if v["primary"] < v["EW"]))
macro("YearsTotal", len(yrs))
for name in ("M2_buffer", "M3", "M2_LS"):
    s_ = row("Pit", "Full", name)
    tag = {"M2_buffer": "Buffer", "M3": "Fm", "M2_LS": "Spread"}[name]
    macro(f"Pit{tag}Cagr", pct(s_["cagr"]))
    macro(f"Pit{tag}Sharpe", num(s_["sharpe"], 2))
    macro(f"Pit{tag}MaxDD", pct(s_["maxDrawdown"]))


# ---------------------------------------------------------------- tables
def cell(x: float, d: int = 1, signed: bool = False, percent: bool = True) -> str:
    v = 100 * x if percent else x
    if round(v, d) == 0:
        return f"{0:.{d}f}"
    s = f"{v:+.{d}f}" if signed else f"{v:.{d}f}"
    return s.replace("-", "$-$").replace("+", "$+$") if signed or s.startswith("-") else s


def with_t(x: float, t: float) -> str:
    return f"{cell(x, 1, True)} ({cell(t, 2, False, False)})"


LABEL = {"MOM_12_1": "12-1 momentum", "HIGH52": "Close / 52-week high",
         "TREND_5": "5-day trend", "TREND_20": "20-day trend", "TREND_50": "50-day trend",
         "TREND_100": "100-day trend", "TREND_200": "200-day trend", "LOWVOL": "Low volatility",
         "REV_1M": "1-month reversal", "VOLSHOCK": "Volume shock"}
DEFN = {"MOM_12_1": r"$P_{t-21}/P_{t-252} - 1$", "HIGH52": r"$P_t / \max_{252} P$",
        "TREND_5": r"$\mathrm{MA}_5/P_t$", "TREND_20": r"$\mathrm{MA}_{20}/P_t$",
        "TREND_50": r"$\mathrm{MA}_{50}/P_t$", "TREND_100": r"$\mathrm{MA}_{100}/P_t$",
        "TREND_200": r"$\mathrm{MA}_{200}/P_t$", "LOWVOL": r"$-\sigma_{252}$",
        "REV_1M": r"$-(P_t/P_{t-21} - 1)$", "VOLSHOCK": r"$\log(\overline{V}_{20}/\overline{V}_{252})$"}
body = []
for k in SC.CANDIDATES:
    v = DEV["signals"][k]
    sel = (r"yes, $" + ("+" if v["sign"] > 0 else "-") + "$") if v["selected"] else "no"
    body.append(rf"{LABEL[k]} & {DEFN[k]} & {cell(v['meanIC'], 3, True, False)} & "
                rf"{cell(v['icT'], 2, True, False)} & {sel} \\")
write("signals.tex", r"""
\begin{tabular}{@{}llrrl@{}}
\toprule
Signal & Definition & Mean IC & $t$ & Selected \\
\midrule
""" + "\n".join(body) + r"""
\bottomrule
\end{tabular}
""")


def headline_panel(run: str, index_label: str) -> str:
    out = []
    lines_ = [
        ("Strategy CAGR", lambda p: cell(row(run, p)["cagr"])),
        ("Equal-weight universe (EW) CAGR", lambda p: cell(row(run, p, "EW")["cagr"])),
        (f"{index_label} CAGR", lambda p: cell(row(run, p, "NIFTY500")["cagr"])),
    ]
    if run == "Pit":
        lines_.append(("Nifty500 Momentum 50 CAGR", lambda p: cell(row(run, p, "NIFTY500_MOM50")["cagr"])))
    lines_ += [
        ("Strategy Sharpe ratio", lambda p: cell(row(run, p)["sharpe"], 2, False, False)),
        ("EW Sharpe ratio", lambda p: cell(row(run, p, "EW")["sharpe"], 2, False, False)),
        ("Strategy maximum drawdown", lambda p: cell(row(run, p)["maxDrawdown"])),
        ("Return over EW, a year ($t$)", lambda p: with_t(row(run, p)["activeReturn"], row(run, p)["activeT"])),
        ("Alpha against EW, a year ($t$)", lambda p: with_t(row(run, p)["alpha"], row(run, p)["alphaT"])),
        ("Deflated Sharpe ratio", lambda p: cell(row(run, p)["dsr"], 2, False, False)),
        ("Cost drag, a year", lambda p: cell(row(run, p)["costDrag"], 1)),
    ]
    for lab, f in lines_:
        out.append(rf"\quad {lab} & " + " & ".join(f(p) for p in PER) + r" \\")
    return "\n".join(out)


HEAD = r"""
\begin{tabular}{@{}lrrr@{}}
\toprule
 & Development & Holdout & Full \\
 & 2009--2018 & 2019--2026 & 2009--2026 \\
\midrule
"""
write("headline.tex", HEAD + headline_panel("Surv", "Nifty 500 price index").replace(r"\quad ", "")
      + "\n\\bottomrule\n\\end{tabular}\n")
write("headline_pit.tex", HEAD + headline_panel("Pit", "Nifty 500 total return").replace(r"\quad ", "")
      + "\n\\bottomrule\n\\end{tabular}\n")

dec_rows = []
for k, lab in [("survivor", "Today's Nifty 500, Yahoo prices"),
               ("pit-survivors", "Today's Nifty 500, NSE prices"),
               ("pit", "Every stock trading at the time, NSE")]:
    v = SV["runs"][k]["full"]
    g = SV["runs"][k]["ewAgainstNifty500EW"]
    dec_rows.append(rf"{lab} & {cell(v['cagr'])} & {cell(v['ewCagr'])} & "
                    rf"{with_t(v['activeReturn'], v['activeT'])} & "
                    rf"{with_t(v['factorAlphaActive'], v['factorAlphaActiveT'])} & "
                    rf"{cell(g['ewCagr'] - g['indexCagr'], 1, True)} \\")
write("decomposition.tex", r"""
\begin{tabular}{@{}lrrrrr@{}}
\toprule
 & \multicolumn{2}{c}{CAGR} & Return over & Four-factor alpha & EW minus \\
\cmidrule(lr){2-3}
Universe & Strategy & EW & EW ($t$) & over EW ($t$) & Nifty500 EW \\
\midrule
""" + "\n".join(dec_rows) + r"""
\bottomrule
\end{tabular}
""")

sk = []
for lab, f in [
    ("Mean monthly rank IC of the score ($t$)",
     lambda p: f"{cell(rb['ic'][p]['meanIC'], 3, True, False)} ({cell(rb['ic'][p]['t'], 2, False, False)})"),
    (f"Random portfolios beaten, of {SC.N_RANDOM:,}", lambda p: f"{100 * rb['random'][p]['percentile']:.0f}\\%"),
    ("Strategy Sharpe ratio before costs", lambda p: cell(rb["random"][p]["strategyGrossSharpe"], 2, False, False)),
    ("95th percentile of random Sharpe ratios", lambda p: cell(rb["random"][p]["randomSharpe95"], 2, False, False)),
    (f"Placebo spreads beaten, of {SC.N_PLACEBO}", lambda p: cell(rb["placebo"][p]["percentile"], 1)),
    ("Sharpe ratio ranking on the realised return", lambda p: cell(rb["canary"][p]["forwardReturnSharpe"], 1, False, False)),
    ("Sharpe ratio with scores one month stale", lambda p: cell(rb["canary"][p]["oneMonthStaleSharpe"], 2, False, False)),
]:
    sk.append(rf"{lab} & " + " & ".join(f(PER[p]) for p in PER) + r" \\")
write("skill.tex", r"""
\begin{tabular}{@{}lrrr@{}}
\toprule
 & Development & Holdout & Full \\
\midrule
""" + "\n".join(sk) + r"""
\bottomrule
\end{tabular}
""")

fr = []
for name, lab in [("primary", "Strategy"), ("EW", "Equal-weight universe"), ("active", "Strategy minus EW")]:
    a_ = att[name]
    fr.append(rf"{lab} & {with_t(a_['alpha'], a_['alphaT'])} & {cell(a_['MF'], 2, True, False)} & "
              rf"{cell(a_['SMB'], 2, True, False)} & {cell(a_['HML'], 2, True, False)} & "
              rf"{cell(a_['WML'], 2, True, False)} ({cell(a_['WMLT'], 1, False, False)}) & "
              rf"{cell(a_['r2'], 2, False, False)} \\")
write("factors.tex", r"""
\begin{tabular}{@{}lrrrrrr@{}}
\toprule
 & Alpha, a year ($t$) & Market & Size & Value & Momentum ($t$) & $R^2$ \\
\midrule
""" + "\n".join(fr) + r"""
\bottomrule
\end{tabular}
""")

rr = []
for lab, src in [
        ("Primary: composite, top quintile", ("bt", P_)),
        ("Rank buffer (hold until a name leaves the top 30\\%)", ("bt", "M2_buffer")),
        ("Fama-MacBeth forecast in place of the composite", ("bt", "M3")),
        ("Top decile", ("bt", "M2_decile")),
        ("Top tercile", ("bt", "M2_tercile")),
        ("Momentum over 6 months", ("bt", "M2_mom_lookback_6")),
        ("Momentum without the skipped month", ("bt", "M2_mom_skip_0")),
        ("Costs doubled", ("bt", "M2_cost_x2")),
        ("200 most traded stocks", ("sv", "top 200")),
        ("1,000 most traded stocks", ("sv", "top 1000")),
        ("Distress exits at 0\\%", ("sv", "distress +0%")),
        ("Distress exits at $-$100\\%", ("sv", "distress -100%"))]:
    if src[0] == "bt":
        f_, h_ = row("Pit", "Full", src[1]), row("Pit", "Hold", src[1])
    else:
        f_, h_ = sens[src[1]]["full"], sens[src[1]]["holdout"]
    rr.append(rf"{lab} & {cell(f_['cagr'])} & {cell(f_['sharpe'], 2, False, False)} & "
              rf"{with_t(f_['activeReturn'], f_['activeT'])} & {with_t(h_['activeReturn'], h_['activeT'])} \\")
write("robustness.tex", r"""
\begin{tabular}{@{}lrrrr@{}}
\toprule
 & \multicolumn{3}{c}{Full sample} & Holdout \\
\cmidrule(lr){2-4}\cmidrule(l){5-5}
Variant & CAGR & Sharpe & Over EW ($t$) & Over EW ($t$) \\
\midrule
""" + "\n".join(rr) + r"""
\bottomrule
\end{tabular}
""")


# ---------------------------------------------------------------- figures
def month_index(m: pd.DataFrame) -> pd.DatetimeIndex:
    return pd.PeriodIndex(m.index, freq="M").to_timestamp(how="end")


def shade_holdout(ax, end) -> None:
    ax.axvspan(pd.Timestamp("2019-01-01"), end, color="#f0f0f0", lw=0, zorder=0)
    ax.text(pd.Timestamp("2019-02-15"), 0.98, "holdout", transform=ax.get_xaxis_transform(),
            fontsize=7, color="#666666", va="top")


def end_label(ax, x, y, text, color, dy=0.0) -> None:
    ax.annotate(text, (x, y), xytext=(4, dy), textcoords="offset points", fontsize=7,
                color=color, va="center", ha="left")


def log_axis(ax, ticks) -> None:
    ax.set_yscale("log")
    ax.set_yticks(ticks)
    ax.set_yticklabels([f"{t:g}" for t in ticks])
    ax.minorticks_off()


mp = RUN["Pit"]["m"]
ms = RUN["Surv"]["m"]
idx = month_index(mp)

# Signal selection: the frozen choice (Part II), and the same rule on NSE data (Section 5).
order = sorted(SC.CANDIDATES, key=lambda k: DEV["signals"][k]["icT"])
for src, name, mark in [(DEV, "strategy_signals.pdf", False), (DEVN, "signals_nse.pdf", True)]:
    fig, ax_ = plt.subplots(figsize=(WIDTH * 0.62, 2.75))
    tv = [src["signals"][k]["icT"] for k in order]
    sel = [src["signals"][k]["selected"] for k in order]
    cols = [(BLUE if t_ > 0 else ORANGE) if s_ else "#d4d4d4" for t_, s_ in zip(tv, sel)]
    ax_.barh(range(len(order)), tv, color=cols, height=0.62)
    for x_ in (-SC.IC_T_THRESHOLD, SC.IC_T_THRESHOLD):
        ax_.axvline(x_, color=INK, lw=0.6, ls=(0, (3, 2)))
    ax_.axvline(0, color=INK, lw=0.6)
    for i, t_ in enumerate(tv):
        ax_.text(t_ + (0.12 if t_ >= 0 else -0.12), i, f"{t_:+.2f}".replace("-", "\u2212"),
                 va="center", ha="left" if t_ >= 0 else "right", fontsize=6.5, color="#333333")
    ax_.set_xlim(-5.4, 5.4)
    ax_.set_xticks([-4, -2, 0, 2, 4])
    ax_.set_xlabel("Newey-West $t$ of the mean monthly rank IC")
    ax_.grid(axis="y", visible=False)
    labels = [LABEL[k] + (" *" if mark and DEV["signals"][k]["selected"] else "") for k in order]
    ax_.set_yticks(range(len(order)), labels)
    fig.savefig(FIG / name)
    plt.close(fig)

# Growth of one rupee and drawdowns, survivorship-free run.
fig, (a, b) = plt.subplots(2, 1, figsize=(WIDTH, 4.5), sharex=True,
                           gridspec_kw={"height_ratios": [1.7, 1], "hspace": 0.26})
series = [("Strategy", P_, BLUE, 1.5, "-"), ("Equal-weight universe", "EW", INK, 1.0, "-"),
          ("Nifty500 Momentum 50", "NIFTY500_MOM50", ORANGE, 1.0, (0, (1, 1.2))),
          ("Nifty 500", "NIFTY500", GREY, 1.0, (0, (4, 2)))]
shade_holdout(a, idx[-1])
ends = []
for lab, col, color, lw, ls in series:
    nav = (1 + mp[col]).cumprod()
    a.plot(idx, nav, color=color, lw=lw, ls=ls, label=lab)
    ends.append((nav.iloc[-1], f"{nav.iloc[-1]:.1f}x", color))
ends.sort()
for i, (y_, txt, color) in enumerate(ends):
    end_label(a, idx[-1], y_, txt, color, dy=(i - 1.5) * 2.5)
log_axis(a, [1, 2, 5, 10, 20, 40])
a.set_ylabel("Value of INR 1, net of costs")
a.legend(loc="upper left", ncol=2, handlelength=2.2, columnspacing=1.2)
panel(a, "Panel A. Growth of one rupee invested in March 2009 (log scale)")
shade_holdout(b, idx[-1])
for lab, col, color, lw, ls in series[:2]:
    nav = (1 + mp[col]).cumprod()
    b.plot(idx, 100 * (nav / nav.cummax() - 1), color=color, lw=lw, ls=ls)
b.set_ylabel("Drawdown (%)")
b.set_ylim(-62, 3)
b.xaxis.set_major_locator(mdates.YearLocator(2))
b.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
panel(b, "Panel B. Drawdown from the previous peak, strategy and equal-weight universe")
fig.savefig(FIG / "strategy_growth.pdf")
plt.close(fig)

# Survivorship: today's Nifty 500 against NSE's own equal-weight index (Section 4.1).
fig, a = plt.subplots(figsize=(WIDTH * 0.66, 2.75))
for lab, nav, color, ls in [
        ("EW, today's Nifty 500", (1 + ms["EW"]).cumprod(), ORANGE, "-"),
        ("EW, every stock trading then", (1 + mp["EW"]).cumprod(), INK, "-"),
        ("Nifty500 Equal Weight index", (1 + mp["NIFTY500_EW"]).cumprod(), GREY, (0, (4, 2)))]:
    a.plot(idx, nav, color=color, lw=1.1, ls=ls, label=lab)
    end_label(a, idx[-1], nav.iloc[-1], f"{nav.iloc[-1]:.0f}x", color)
log_axis(a, [1, 2, 5, 10, 20, 40])
a.set_ylabel("Value of INR 1, net of costs")
a.legend(loc="upper left", handlelength=2.0)
a.xaxis.set_major_locator(mdates.YearLocator(4))
a.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
fig.savefig(FIG / "survivorship.pdf")
plt.close(fig)

# Quintile spread and random portfolios.
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.45), gridspec_kw={"wspace": 0.3})
q = [100 * x for x in rb["quintiles"]["full"]]
a.bar(range(1, 6), q, color=[GREY] * 4 + [BLUE], width=0.62)
for i, v in enumerate(q, 1):
    a.text(i, v + 0.04, f"{v:.2f}", ha="center", va="bottom", fontsize=7)
a.set_xticks(range(1, 6), ["Q1\nlowest", "Q2", "Q3", "Q4", "Q5\nhighest"])
a.set_ylim(0, max(q) * 1.2)
a.set_ylabel("Mean next-month return (%)")
a.grid(axis="x", visible=False)
panel(a, "Panel A. Return by quintile of the score")
sh = np.array(rb["random"]["full"]["sharpes"])
b.hist(sh, bins=np.arange(sh.min() - 0.02, sh.max() + 0.05, 0.025), color="#bdbdbd", edgecolor="white", lw=0.3)
sg = rb["random"]["full"]["strategyGrossSharpe"]
b.axvline(sg, color=BLUE, lw=1.4)
b.text(sg - 0.015, b.get_ylim()[1] * 0.93, f"strategy\n{sg:.2f}", color=BLUE, fontsize=7, ha="right", va="top")
b.set_xlim(sh.min() - 0.05, sg + 0.06)
b.set_xlabel("Sharpe ratio before costs, 2009 to 2026")
b.set_ylabel("Random portfolios")
b.grid(axis="x", visible=False)
panel(b, f"Panel B. Against {SC.N_RANDOM:,} random portfolios")
fig.savefig(FIG / "strategy_skill.pdf")
plt.close(fig)

# Where the edge comes from and where it fails.
fig, (a, b) = plt.subplots(1, 2, figsize=(WIDTH, 2.6),
                           gridspec_kw={"width_ratios": [1, 1.25], "wspace": 0.3})
groups = [("Most liquid third", rb["byTercile"]["0"]["full"]), ("Middle third", rb["byTercile"]["1"]["full"]),
          ("Least liquid third", rb["byTercile"]["2"]["full"]),
          ("200 most traded", sens["top 200"]["full"]), ("500 most traded", SV["runs"]["pit"]["full"]),
          ("1,000 most traded", sens["top 1000"]["full"])]
yy = np.array([6.0, 5.0, 4.0, 2.4, 1.4, 0.4])
vals = [100 * g["activeReturn"] for _, g in groups]
ts = [g["activeT"] for _, g in groups]
a.barh(yy, vals, height=0.62, color=[BLUE if v > 0 else ORANGE for v in vals])
for yi, v, t_ in zip(yy, vals, ts):
    a.text(v + 0.25, yi, f"{v:+.1f} ($t$ {t_:.2f})".replace("-", "−"), va="center", fontsize=6.6)
a.axvline(0, color=INK, lw=0.6)
a.set_yticks(yy, [g for g, _ in groups], fontsize=7)
a.text(0.15, 6.62, "Within liquidity terciles", fontsize=6.8, style="italic", color="#555555")
a.text(0.15, 3.02, "By size of universe", fontsize=6.8, style="italic", color="#555555")
a.set_xlim(-1, 12.5)
a.set_ylim(-0.3, 7.0)
a.set_xlabel("Return over the matching EW, a year (%)")
a.grid(axis="y", visible=False)
panel(a, "Panel A. Where the edge is")
yr = sorted(rb["byYear"])
diff = [100 * (rb["byYear"][y]["primary"] - rb["byYear"][y]["EW"]) for y in yr]
floor = -32
b.bar(range(len(yr)), [max(d, floor) for d in diff],
      color=[BLUE if d > 0 else ORANGE for d in diff], width=0.7)
b.axhline(0, color=INK, lw=0.6)
b.set_xticks(range(0, len(yr), 2), ["’" + y[2:] for y in yr[::2]], fontsize=7)
b.set_ylim(floor - 2, 32)
b.annotate(f"{diff[0]:.0f}, March to\nDecember 2009".replace("-", "−"), (0, floor),
           xytext=(14, 6), textcoords="offset points", fontsize=6.5, va="bottom",
           arrowprops=dict(arrowstyle="-", lw=0.5, color=INK))
b.set_ylabel("Strategy minus EW (pp)")
b.grid(axis="x", visible=False)
panel(b, "Panel B. Calendar-year return over EW")
fig.savefig(FIG / "strategy_weak.pdf")
plt.close(fig)


# ----------------------------------------------------------------------
lines = ["% Generated by paper/make_assets.py. Do not edit by hand."]
lines += [f"\\newcommand{{\\{k}}}{{{v}}}" for k, v in MACROS.items()]
(PAPER / "numbers.tex").write_text("\n".join(lines) + "\n")
print(f"{len(MACROS)} numbers, {len(list(TAB.glob('*.tex')))} tables, "
      f"{len(list(FIG.glob('*.pdf')))} figures written; all {N} stocks match "
      f"data/ml-signals.json")
