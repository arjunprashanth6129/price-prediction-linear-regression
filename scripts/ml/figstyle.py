"""One figure style for every stage that draws something.

Kept in a module rather than duplicated per script so the whole figure set reads
as one system: same surface, same palette, same axis treatment, same DPI.

Why a light "paper" surface when the website is dark
---------------------------------------------------
These figures are the printable artifact - they sit in the README and in
results/, get dropped into slides, and get read on GitHub in either colour
scheme. A light surface behaves predictably in all of those; a dark PNG with a
transparent background does not. The site keeps its own dark styling.

Why blue and orange rather than green and red
---------------------------------------------
Most of these charts encode a polarity: edge above or below zero, R2 above or
below zero, a coefficient positive or negative. Green/red is the obvious
choice and the wrong one - #2fbf71 against #f1566a separates by only ΔE 3.5
under deuteranopia, meaning roughly one man in twelve cannot tell the two bar
colours apart. Blue against orange separates by ΔE 24.7 in the worst CVD case
and clears contrast against the surface, so the same figure works for everyone.
Polarity is additionally encoded by position in every chart here (which side of
the zero line or the diagonal a mark falls on), so colour is reinforcement
rather than the only channel.
"""
import textwrap

import matplotlib
import matplotlib.pyplot as plt

# Surfaces and ink.
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#6b6a66"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"

# The two data hues. POSITIVE/ACTUAL is blue, NEGATIVE/PREDICTED is orange.
BLUE = "#2a78d6"
ORANGE = "#eb6834"

# Sequential ramp for magnitude shading, single hue, light to dark.
SEQ_LIGHT = "#bcd4f2"
SEQ_DARK = "#1a4f91"

DPI = 300


def use_style() -> None:
    """Global rcParams. Call once at the top of a figure script."""
    matplotlib.use("Agg")  # write a PNG; never try to open a window
    plt.rcParams.update({
        "figure.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "savefig.dpi": DPI,
        "savefig.bbox": "tight",
        "font.size": 10,
        "axes.titlesize": 13,
        "axes.titleweight": "bold",
        "axes.labelsize": 10,
        "legend.fontsize": 9,
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
    })


def style(ax, grid_axis: str = "both") -> None:
    """Recessive grid, two spines, muted ticks - the same on every figure."""
    ax.set_facecolor(SURFACE)
    if grid_axis != "none":
        ax.grid(True, axis=grid_axis, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(AXIS)
    ax.tick_params(colors=INK_MUTED, labelsize=9)


def title(ax, text: str, subtitle: str | None = None, wrap: int = 88) -> None:
    """Left-aligned bold title with an optional muted deck beneath it.

    The deck is wrapped rather than trusted to fit: an over-long subtitle
    silently runs off the right edge of the figure, since axes text is not
    clipped to the axes. `pad` is derived from the wrapped line count so the
    title always clears the deck no matter how many lines it takes.
    """
    lines = textwrap.wrap(subtitle, wrap) if subtitle else []
    # 10pt of clearance per deck line, plus the usual gap above the axes.
    ax.set_title(text, color=INK, loc="left", pad=10 + 11.5 * len(lines))
    for i, line in enumerate(lines):
        # Stacked downward from the top, so the last line sits nearest the axes.
        ax.annotate(
            line,
            xy=(0, 1), xycoords="axes fraction",
            xytext=(0, 6 + 11.5 * (len(lines) - 1 - i)), textcoords="offset points",
            ha="left", va="bottom", color=INK_MUTED, fontsize=9.5,
            annotation_clip=False,
        )


def legend(ax, **kw):
    """Legend with no frame and muted label ink, never the series colour."""
    lg = ax.legend(frameon=False, **kw)
    for text in lg.get_texts():
        text.set_color(INK_SECONDARY)
    return lg


def save(fig, path) -> None:
    fig.savefig(path)
    plt.close(fig)
    print(f"  wrote {path.name}")
