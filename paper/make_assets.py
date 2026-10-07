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
macro("RelTrainStart", detail["trainDateRange"]["start"])
macro("RelTrainEnd", detail["trainDateRange"]["end"])
macro("RelTestStart", detail["testDateRange"]["start"])
macro("RelTestEnd", detail["testDateRange"]["end"])
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
macro("RelMeanClose", thousands(round(pm["meanTestClose"])))
macro("RelMeanAbsMove",
      f"{round(pm['meanTestClose'] * np.abs(act).mean())}")

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
a.annotate(f"mean {df.r2.mean():.4f}", xy=(df.r2.mean(), top_ * 0.92),
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

# ----------------------------------------------------------------------
lines = ["% Generated by paper/make_assets.py. Do not edit by hand."]
lines += [f"\\newcommand{{\\{k}}}{{{v}}}" for k, v in MACROS.items()]
(PAPER / "numbers.tex").write_text("\n".join(lines) + "\n")
print(f"{len(MACROS)} numbers, {len(list(TAB.glob('*.tex')))} tables, "
      f"{len(list(FIG.glob('*.pdf')))} figures written; all {N} stocks match "
      f"data/ml-signals.json")
