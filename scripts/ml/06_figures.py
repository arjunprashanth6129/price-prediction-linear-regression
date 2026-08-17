#!/usr/bin/env python3
"""Stage 6: render every findings chart to a high-resolution PNG.

The website draws these interactively. The README and results/ need them as
static images, and a screenshot of the site would not be reproducible - so they
are re-rendered here from the same JSON the site reads. Change the pipeline and
one command regenerates every figure in the write-up, which is the only way the
prose and the pictures stay in agreement.

Every figure lands in docs/figures/ at 300 dpi.

    python3 scripts/ml/06_figures.py
"""
import json

import numpy as np

from pathlib import Path

import figstyle as fs
from figstyle import (AXIS, BLUE, GRID, INK, INK_MUTED, INK_SECONDARY, ORANGE,
                      SEQ_DARK, SEQ_LIGHT)

fs.use_style()

import matplotlib.colors as mcolors
import matplotlib.dates as mdates
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SIGNALS = ROOT / "data" / "ml-signals.json"
DETAIL = ROOT / "data" / "reliance-model-detail.json"
OUT = ROOT / "docs" / "figures"

FEATURES = ["ma5", "ma20", "ret", "ma_ratio"]
EXAMPLE = "RELIANCE"

# Single-hue ramp for magnitude shading (residual size). Light to dark, so it is
# monotonic in lightness and survives being printed in greyscale.
SEQ = mcolors.LinearSegmentedColormap.from_list("seq", [SEQ_LIGHT, SEQ_DARK])


# ----------------------------------------------------------------------
# 1. R2 distribution
# ----------------------------------------------------------------------
def fig_r2_distribution(rows: list[dict]) -> None:
    r2s = np.array([r["r2Return"] for r in rows])
    above = int((r2s > 0).sum())

    # A real histogram over the observed range rather than five wide buckets.
    # Every one of these R2 values falls between -0.25 and +0.25, so coarse
    # bucketing collapses the whole distribution into two bars and hides the
    # thing worth seeing: it is a tight pile centred just below zero.
    lo = np.floor(r2s.min() * 100) / 100
    hi = np.ceil(r2s.max() * 100) / 100
    bins = np.linspace(lo, hi, 41)

    fig, ax = plt.subplots(figsize=(10, 5))
    fs.style(ax, grid_axis="y")

    # Split at zero so each bar's colour matches which side of the line it is
    # on. Colour is redundant with horizontal position here, as it should be.
    counts, edges = np.histogram(r2s, bins=bins)
    centres = (edges[:-1] + edges[1:]) / 2
    width = (edges[1] - edges[0]) * 0.9
    ax.bar(centres, counts, width=width,
           color=[BLUE if c >= 0 else ORANGE for c in centres])

    ax.axvline(0, color=INK_MUTED, linewidth=1.4)
    ax.annotate(
        f"R² = 0\n{above} of {len(rows)} to the right",
        xy=(0, counts.max()), xytext=(8, -4), textcoords="offset points",
        color=INK_SECONDARY, fontsize=9.5, va="top", ha="left",
    )
    # The mean, which is the figure quoted in the abstract.
    ax.axvline(r2s.mean(), color=INK_MUTED, linestyle=":", linewidth=1.2)
    ax.annotate(
        f"mean {r2s.mean():.4f}",
        xy=(r2s.mean(), counts.max()), xytext=(-8, -4),
        textcoords="offset points",
        color=INK_SECONDARY, fontsize=9.5, va="top", ha="right",
    )

    ax.set_xlabel("R² on next-day returns", color=INK_MUTED)
    ax.set_ylabel("Number of stocks", color=INK_MUTED)
    ax.set_ylim(0, counts.max() * 1.18)
    fs.title(
        ax,
        f"R² on next-day returns, {len(rows)} NSE stocks",
        f"Every stock lands between {lo:.2f} and {hi:.2f} - a tight pile just below "
        f"zero. Left of the line the model did worse than guessing the mean return "
        f"every day.",
    )
    fs.save(fig, OUT / "r2-distribution.png")


# ----------------------------------------------------------------------
# 2. Model accuracy against the naive baseline
# ----------------------------------------------------------------------
def fig_accuracy_vs_baseline(signals: dict) -> None:
    naive = np.array([r["naiveBaseline"] for r in signals.values()]) * 100
    model = np.array([r["dirAccuracy"] for r in signals.values()]) * 100
    beats = model > naive

    # Domain from the data, padded and snapped to a round step, rather than a
    # fixed 35-70 that left half the canvas empty. Both axes take the SAME
    # domain, which is what makes the diagonal a true 45 degrees.
    lo = np.floor(min(naive.min(), model.min()) / 2.5) * 2.5 - 1
    hi = np.ceil(max(naive.max(), model.max()) / 2.5) * 2.5 + 1

    fig, ax = plt.subplots(figsize=(7.4, 7.4))
    fs.style(ax)

    # y = x. Both axes share one domain and the aspect is locked, so this line
    # is a true 45 degrees - give each axis its own range and the "diagonal"
    # becomes a lie about how close the two quantities are.
    ax.plot([lo, hi], [lo, hi], color=AXIS, linestyle="--", linewidth=1.3,
            zorder=1)
    ax.text(lo + 0.6, lo + 1.4, "model = naive baseline", color=INK_MUTED,
            fontsize=9.5, rotation=45, rotation_mode="anchor")

    ax.scatter(naive[beats], model[beats], s=42, color=BLUE, alpha=0.75,
               linewidths=0.6, edgecolors=fs.SURFACE, zorder=3,
               label=f"above baseline ({int(beats.sum())})")
    ax.scatter(naive[~beats], model[~beats], s=42, color=ORANGE, alpha=0.75,
               linewidths=0.6, edgecolors=fs.SURFACE, zorder=3,
               label=f"below baseline ({int((~beats).sum())})")

    # A coin flip, for reference - the number the model should be compared to
    # before it is compared to anything else.
    ax.axhline(50, color=INK_MUTED, linewidth=1, linestyle=":", zorder=1)
    ax.text(hi - 0.3, 50.3, "coin flip", color=INK_MUTED, fontsize=9,
            ha="right")

    ax.set_xlim(lo, hi)
    ax.set_ylim(lo, hi)
    ax.set_aspect("equal")
    ax.set_xlabel("Naive always-up baseline accuracy (%)", color=INK_MUTED)
    ax.set_ylabel("Model directional accuracy (%)", color=INK_MUTED)
    fs.legend(ax, loc="upper left")
    fs.title(
        ax,
        "Model against its own baseline, one dot per stock",
        f"The cluster straddles the diagonal rather than sitting above it, and "
        f"averages {model.mean():.1f}% - under the coin flip. The dots left of "
        f"centre clear a baseline that was itself weak.",
    )
    fs.save(fig, OUT / "accuracy-vs-baseline.png")


# ----------------------------------------------------------------------
# 3. Directional edge, ranked
# ----------------------------------------------------------------------
def fig_edge_ranked(signals: dict) -> None:
    pairs = sorted(((t, r["mlEdge"] * 100) for t, r in signals.items()),
                   key=lambda kv: kv[1])
    edges = np.array([e for _, e in pairs])
    mean_test = float(np.mean([r["testDays"] for r in signals.values()]))
    band = 2 * (0.5 / np.sqrt(mean_test)) * 100
    negative = int((edges <= 0).sum())

    outside = int((np.abs(edges) > band).sum())

    fig, ax = plt.subplots(figsize=(9, 10))
    fs.style(ax, grid_axis="x")

    y = np.arange(len(edges))
    ax.barh(y, edges, height=0.82,
            color=[BLUE if e > 0 else ORANGE for e in edges])

    # The band inside which an edge is indistinguishable from chance. Drawn
    # rather than described, because it covers most of the chart.
    ax.axvspan(-band, band, color=GRID, alpha=0.55, zorder=0)
    ax.axvline(0, color=INK_MUTED, linewidth=1.1)

    # Symmetric limits so the zero line sits centred, with room for the
    # annotation in the upper-left, which the sort order leaves empty.
    lim = np.ceil(np.abs(edges).max()) + 1.5
    ax.set_xlim(-lim, lim)
    ax.text(-lim + 0.4, len(edges) * 0.99,
            f"shaded = ±{band:.1f} pts, two standard errors\n"
            f"on ~{mean_test:.0f} test days per stock.\n"
            f"Only {outside} of {len(edges)} bars clear it.",
            color=INK_SECONDARY, fontsize=9.5, va="top", ha="left")

    # 98 tick labels would be illegible; every sixth ticker is readable and the
    # shape is what the chart is for.
    step = 6
    ax.set_yticks(y[::step])
    ax.set_yticklabels([t for t, _ in pairs][::step], fontsize=7.5)
    ax.set_ylim(-1, len(edges))
    ax.set_xlabel("Directional edge over the naive baseline (percentage points)",
                  color=INK_MUTED)
    fs.title(
        ax,
        "Directional edge per stock, sorted ascending",
        f"{negative} of {len(edges)} stocks finished at or below their own "
        f"baseline, and only {outside} landed outside the band where chance alone "
        f"explains the result.",
    )
    fs.save(fig, OUT / "edge-ranked.png")


# ----------------------------------------------------------------------
# 4. Golden-cross coefficient sign
# ----------------------------------------------------------------------
def fig_ma_ratio_signs(rows: list[dict]) -> None:
    weights = [r["maRatioWeight"] for r in rows]
    pos = sum(1 for w in weights if w > 0)
    neg = sum(1 for w in weights if w < 0)
    mean_abs = float(np.mean([abs(w) for w in weights]))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))

    # Left: the sign split.
    fs.style(ax1, grid_axis="y")
    bars = ax1.bar(["Positive weight", "Negative weight"], [pos, neg],
                   color=[BLUE, ORANGE], width=0.52)
    ax1.bar_label(bars, padding=4, color=INK_SECONDARY, fontsize=10)
    ax1.set_ylabel("Number of stocks", color=INK_MUTED)
    ax1.set_ylim(0, max(pos, neg) * 1.18)
    fs.title(ax1, "Which way ma_ratio points",
             f"{max(pos, neg) / len(rows):.0%} lean one way, the rest the other.")

    # Right: the magnitude, which is the more damning half. A signal that
    # mattered would sit far from zero; these are a spike at zero.
    fs.style(ax2, grid_axis="y")
    ax2.hist(weights, bins=26, color=BLUE, alpha=0.85)
    ax2.axvline(0, color=INK_MUTED, linewidth=1.1)
    ax2.set_xlabel("ma_ratio coefficient", color=INK_MUTED)
    ax2.set_ylabel("Number of stocks", color=INK_MUTED)
    fs.title(ax2, "How much it matters",
             f"Mean absolute weight {mean_abs:.5f} - effectively ignored.")

    fig.tight_layout()
    fs.save(fig, OUT / "ma-ratio-signs.png")


# ----------------------------------------------------------------------
# 5. Edge by market cap
# ----------------------------------------------------------------------
def fig_by_market_cap(rows: list[dict]) -> None:
    cats = ["Large", "Mid", "Small"]
    groups = {c: [r for r in rows if r["marketCapCategory"] == c] for c in cats}
    groups = {c: g for c, g in groups.items() if g}

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))

    # A dumbbell rather than paired bars. The interesting range is 46-51%, and
    # bars on that range would need a truncated baseline - which breaks the
    # "length is the value" contract a bar makes and visually inflates a
    # two-point gap into a doubling. Dots carry position, not length, so a
    # non-zero scale is honest, and the connecting line shows the edge itself.
    fs.style(ax1, grid_axis="x")
    labels = [f"{c}  (n={len(g)})" for c, g in groups.items()]
    acc = [np.mean([r["dirAccuracy"] for r in g]) * 100 for g in groups.values()]
    naive = [np.mean([r["naiveBaseline"] for r in g]) * 100
             for g in groups.values()]
    y = np.arange(len(groups))

    for yi, a, n in zip(y, acc, naive):
        ax1.plot([n, a], [yi, yi], color=AXIS, linewidth=2, zorder=1,
                 solid_capstyle="round")
    ax1.scatter(naive, y, s=150, color=ORANGE, zorder=3, label="naive baseline")
    ax1.scatter(acc, y, s=150, color=BLUE, zorder=3, label="model")
    for yi, a, n in zip(y, acc, naive):
        ax1.annotate(f"{n:.1f}", (n, yi), xytext=(0, -17),
                     textcoords="offset points", ha="center",
                     color=INK_SECONDARY, fontsize=9)
        ax1.annotate(f"{a:.1f}", (a, yi), xytext=(0, 13),
                     textcoords="offset points", ha="center",
                     color=INK_SECONDARY, fontsize=9)

    ax1.axvline(50, color=INK_MUTED, linestyle=":", linewidth=1)
    # Bottom of the line, not the top - the top is where the "Small" value
    # label sits and the two collide there.
    ax1.text(50.1, -0.5, "coin flip", color=INK_MUTED, fontsize=9, va="center")
    ax1.set_yticks(y, labels)
    ax1.set_ylim(-0.6, len(groups) - 0.3)
    ax1.set_xlim(45.5, 51.2)
    ax1.set_xlabel("Directional accuracy (%)", color=INK_MUTED)
    fs.legend(ax1, loc="lower left", ncol=2)
    fs.title(ax1, "Accuracy by size",
             "The model clears its baseline in every band and still sits at or "
             "below a coin flip in every band.")

    # Right: the spread of individual edges, which is what makes the group
    # averages unreliable. A box plot shows that directly.
    fs.style(ax2, grid_axis="y")
    data = [[r["mlEdge"] * 100 for r in g] for g in groups.values()]
    bp = ax2.boxplot(data, tick_labels=list(groups), widths=0.5,
                     patch_artist=True, medianprops={"color": INK, "linewidth": 1.6},
                     flierprops={"marker": "o", "markersize": 3.5,
                                 "markerfacecolor": INK_MUTED,
                                 "markeredgecolor": "none", "alpha": 0.6})
    for patch in bp["boxes"]:
        patch.set_facecolor(BLUE)
        patch.set_alpha(0.28)
        patch.set_edgecolor(BLUE)
    for element in ("whiskers", "caps"):
        for line in bp[element]:
            line.set_color(AXIS)
    ax2.axhline(0, color=INK_MUTED, linewidth=1.1)
    ax2.set_ylabel("Directional edge (percentage points)", color=INK_MUTED)
    fs.title(ax2, "Spread of individual edges",
             "The within-group spread dwarfs the between-group difference.")

    fig.tight_layout()
    fs.save(fig, OUT / "edge-by-market-cap.png")


# ----------------------------------------------------------------------
# 6. Parity plots: the same model asked two different questions
# ----------------------------------------------------------------------
def fig_parity(detail: dict) -> None:
    price = detail["priceModel"]["testPeriodData"]
    ret = detail["returnModel"]["testPeriodData"]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.4, 5.8))

    # --- price ---
    pa = np.array([r["actual"] for r in price])
    pp = np.array([r["predicted"] for r in price])
    lo = np.floor(min(pa.min(), pp.min()) / 25) * 25
    hi = np.ceil(max(pa.max(), pp.max()) / 25) * 25
    fs.style(ax1)
    ax1.plot([lo, hi], [lo, hi], color=AXIS, linestyle="--", linewidth=1.3)
    ax1.scatter(pp, pa, s=16, color=BLUE, alpha=0.4, linewidths=0)
    ax1.set_xlim(lo, hi)
    ax1.set_ylim(lo, hi)
    ax1.set_aspect("equal")
    ax1.set_xlabel("Predicted close (₹)", color=INK_MUTED)
    ax1.set_ylabel("Actual close (₹)", color=INK_MUTED)
    fs.title(ax1, "Price model",
             f"R² {detail['priceModel']['r2']:.3f} - and worthless.")

    # --- return ---
    ra = np.array([r["actualReturn"] for r in ret]) * 100
    rp = np.array([r["predictedReturn"] for r in ret]) * 100
    bound = np.ceil(max(np.abs(ra).max(), np.abs(rp).max()))
    fs.style(ax2)
    ax2.plot([-bound, bound], [-bound, bound], color=AXIS, linestyle="--",
             linewidth=1.3)
    ax2.axhline(0, color=GRID, linewidth=1)
    ax2.axvline(0, color=GRID, linewidth=1)
    ax2.scatter(rp, ra, s=16, color=ORANGE, alpha=0.45, linewidths=0)
    ax2.set_xlim(-bound, bound)
    ax2.set_ylim(-bound, bound)
    ax2.set_aspect("equal")
    ax2.set_xlabel("Predicted return (%)", color=INK_MUTED)
    ax2.set_ylabel("Actual return (%)", color=INK_MUTED)
    fs.title(ax2, "Return model",
             f"R² {detail['returnModel']['r2']:.3f} - and honest.")

    fig.suptitle(
        f"{EXAMPLE}: predicted against actual, same features, same "
        f"{len(ret)} test days",
        color=INK, fontsize=14, fontweight="bold", x=0.005, ha="left",
    )
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    fs.save(fig, OUT / "parity-price-vs-return.png")


# ----------------------------------------------------------------------
# 7. Residuals over time
# ----------------------------------------------------------------------
def fig_residuals(detail: dict) -> None:
    ret = detail["returnModel"]["testPeriodData"]
    dates = np.array([np.datetime64(r["date"]) for r in ret])
    resid = np.array([r["residual"] for r in ret]) * 100
    worst = np.abs(resid).max()

    fig, ax = plt.subplots(figsize=(11.4, 4.8))
    fs.style(ax)

    ax.axhline(0, color=INK_MUTED, linewidth=1.1)
    # Bigger misses read darker. Redundant with vertical position, so shading is
    # emphasis rather than the only channel carrying magnitude.
    ax.scatter(dates, resid, s=26, c=np.abs(resid), cmap=SEQ,
               vmin=0, vmax=worst, alpha=0.85, linewidths=0)

    ax.set_ylim(-np.ceil(worst), np.ceil(worst))
    ax.set_ylabel("Residual: actual minus predicted (%)", color=INK_MUTED)
    locator = mdates.AutoDateLocator()
    ax.xaxis.set_major_locator(locator)
    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))
    fs.title(
        ax,
        f"{EXAMPLE}: what the model missed by, day by day",
        "The errors span the whole range of daily moves, because the prediction "
        "was near zero every day - so the residuals are essentially the returns.",
    )
    fs.save(fig, OUT / "residuals.png")


# ----------------------------------------------------------------------
# 8. Feature weights, both models, one shared axis
# ----------------------------------------------------------------------
def fig_feature_weights(detail: dict) -> None:
    pw = detail["priceModel"]["featureWeights"]
    rw = detail["returnModel"]["featureWeights"]
    price = [pw.get(f, 0.0) for f in FEATURES]
    ret = [rw.get(f, 0.0) for f in FEATURES]

    # One shared, symmetric domain from the price model. Letting each panel
    # autoscale would blow the return model's coefficients up to full width and
    # destroy the entire comparison - that scaling IS the finding.
    bound = np.ceil(max(abs(v) for v in price) / 50) * 50
    # The visible range is wider than the data range so the value labels get
    # their own gutter on the right instead of sitting on top of the longest
    # bar. Widening symmetrically keeps the zero line centred, which the
    # comparison depends on.
    view = bound * 1.34
    y = np.arange(len(FEATURES))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.4, 4.2), sharey=True)

    for ax, vals, name, unit in (
        (ax1, price, "Price model", "₹ per standard deviation"),
        (ax2, ret, "Return model", "fraction of price per standard deviation"),
    ):
        fs.style(ax, grid_axis="x")
        ax.barh(y, vals, height=0.56,
                color=[BLUE if v >= 0 else ORANGE for v in vals])
        ax.axvline(0, color=INK_MUTED, linewidth=1.1)
        ax.set_xlim(-view, view)
        ax.set_xticks(np.arange(-bound, bound + 1, bound / 3))
        ax.set_yticks(y, FEATURES)
        ax.set_xlabel(f"Coefficient · {unit}", color=INK_MUTED)
        # Values are labelled directly because the return model's bars are too
        # short to read off the axis, which is the whole point of the pairing.
        for yi, v in zip(y, vals):
            ax.text(view * 0.99, yi, f"{v:+.4f}" if abs(v) < 1 else f"{v:+.1f}",
                    va="center", ha="right", color=INK_SECONDARY, fontsize=9)
        fs.title(ax, name)

    fig.suptitle(
        f"{EXAMPLE}: what each model leaned on, drawn on one shared axis",
        color=INK, fontsize=14, fontweight="bold", x=0.005, ha="left",
    )
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    fs.save(fig, OUT / "feature-weights.png")


# ----------------------------------------------------------------------
# 9. The fitted plane, as a static slice
# ----------------------------------------------------------------------
def fig_hyperplane(detail: dict) -> None:
    ret = detail["returnModel"]["testPeriodData"]
    w = detail["returnModel"]["featureWeights"]

    xs = np.array([r["ma5Scaled"] for r in ret])
    ys = np.array([r["ma20Scaled"] for r in ret])
    zs = np.array([r["actualReturn"] for r in ret]) * 100

    gx = np.linspace(xs.min() - 0.1, xs.max() + 0.1, 30)
    gy = np.linspace(ys.min() - 0.1, ys.max() + 0.1, 30)
    GX, GY = np.meshgrid(gx, gy)
    # ret and ma_ratio held at 0, which after standardisation is their mean, so
    # this is a genuine slice of the four-dimensional fit rather than a
    # separately fitted two-feature model.
    GZ = (w.get("ma5", 0) * GX + w.get("ma20", 0) * GY + w.get("bias", 0)) * 100

    # ma5 and ma20 correlate at about 0.92, so real observations lie along a
    # thin diagonal ridge. The two coefficients are near-equal and opposite, so
    # they cancel along that ridge and diverge sharply in the empty corners.
    # Drawing the full rectangle would render half a plane of pure
    # extrapolation and exaggerate the tilt several times over, showing a steep
    # surface where the model is almost flat everywhere it has data.
    keep = np.min(
        np.hypot(GX[..., None] - xs, GY[..., None] - ys), axis=-1
    ) <= 0.28
    GZ = np.where(keep, GZ, np.nan)

    fig = plt.figure(figsize=(9.5, 6.6))
    ax = fig.add_subplot(111, projection="3d")
    # A 3D axes leaves large empty margins at its default box aspect; flattening
    # the z box and widening the frame puts the plot where the space is.
    ax.set_box_aspect((1.35, 1.35, 0.72), zoom=1.14)
    ax.set_facecolor(fs.SURFACE)
    ax.xaxis.set_pane_color((1, 1, 1, 0))
    ax.yaxis.set_pane_color((1, 1, 1, 0))
    ax.zaxis.set_pane_color((1, 1, 1, 0))
    for axis in (ax.xaxis, ax.yaxis, ax.zaxis):
        axis._axinfo["grid"].update(color=GRID, linewidth=0.7)
        axis.label.set_color(INK_MUTED)
    ax.tick_params(colors=INK_MUTED, labelsize=8)

    ax.plot_surface(GX, GY, GZ, color=BLUE, alpha=0.3, linewidth=0,
                    antialiased=True, shade=False)
    ax.scatter(xs, ys, zs, s=7, color=INK_SECONDARY, alpha=0.55, linewidths=0)

    ax.set_xlabel("ma5 (scaled)", labelpad=8)
    ax.set_ylabel("ma20 (scaled)", labelpad=8)
    ax.set_zlabel("Actual next-day return (%)", labelpad=8)
    ax.view_init(elev=16, azim=-58)
    fs.title(
        ax,
        f"{EXAMPLE}: a two-feature slice of the fitted plane",
        "ret and ma_ratio are held at their means, so this is a slice of the real "
        "four-feature fit. The surface is nearly level and the days scatter far "
        "above and below it - the same result as the near-zero coefficients, seen "
        "from another angle.",
    )
    fs.save(fig, OUT / "hyperplane-slice.png")


def main() -> int:
    if not SIGNALS.exists() or not DETAIL.exists():
        raise SystemExit("Missing results - run stages 1-5 first.")

    OUT.mkdir(parents=True, exist_ok=True)
    signals = json.loads(SIGNALS.read_text())
    detail = json.loads(DETAIL.read_text())
    rows = list(signals.values())

    print(f"Rendering figures for {len(rows)} stocks at {fs.DPI} dpi -> "
          f"{OUT.relative_to(ROOT)}/")

    fig_r2_distribution(rows)
    fig_accuracy_vs_baseline(signals)
    fig_edge_ranked(signals)
    fig_ma_ratio_signs(rows)
    fig_by_market_cap(rows)
    fig_parity(detail)
    fig_residuals(detail)
    fig_feature_weights(detail)
    fig_hyperplane(detail)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
