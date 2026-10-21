"""The pre-registered specification of the cross-sectional strategy study.

Every choice that could be tuned to flatter a result is fixed here, before any
strategy return has been computed: the universe rules, the candidate signals,
the rule that selects among them, the models, the portfolio construction and
the cost schedule. The stage scripts import these values and define none of
their own.

The sample is divided into two periods.

    development   Mar 2009 to Dec 2018   signals are studied and selected here
    holdout       Jan 2019 to Jun 2026   run once, after this file is frozen

Until HOLDOUT_UNLOCKED is set to True, in a commit that follows the commit
freezing this file, the loaders truncate the price panel at DEV_END, so no
holdout price can reach a signal, a regression or a portfolio. The git log
therefore records that the specification came first.

Deviations from the approved plan are recorded here rather than made silently:

  - The plan's price floor of Rs 10 is not applied. Yahoo serves only
    split-adjusted closes, so a historical close embeds every later split, and
    filtering on it would use future information. Traded value (close x
    volume) is invariant to split adjustment, so liquidity is screened on that
    alone.
  - Evaluation starts in March 2009, not January. The primary model needs 36
    completed monthly regressions, and the first signal date is January 2006
    (252 sessions after the January 2005 start of the data).
  - The primary model is M2, not M3. The freeze commit (46472c0) named M3.
    On the development period M3's forecasts had a mean rank IC of -0.015
    (t = -0.8): its walk-forward slopes on three collinear signals were
    dominated by the 2008-09 crash and rebound in their burn-in, and early on
    they put a large negative weight on HIGH52. The equal-weight composite M2
    had a mean rank IC of +0.046 (t = 2.18). The switch was made on
    development data alone, before the holdout was unlocked, and M3 is still
    reported. The sensitivity runs apply to whichever model is primary.
"""

# ----------------------------------------------------------------------
# Dates
# ----------------------------------------------------------------------
FETCH_START = "2005-01-01"
FETCH_END = "2026-07-01"          # exclusive: the last session is 30 June 2026

EVAL_START = "2009-03"            # first holding month in which every model is live
DEV_END = "2018-12-31"            # last day of the development period
HOLDOUT_START = "2019-01"
EVAL_END = "2026-06"

HOLDOUT_UNLOCKED = True

# ----------------------------------------------------------------------
# Universe: point-in-time eligibility at each month-end signal date
# ----------------------------------------------------------------------
MIN_HISTORY = 252                 # sessions of price history
TRADED_WINDOW = 252
MIN_TRADED_FRAC = 0.90            # share of the last 252 sessions with a trade
LIQ_WINDOW = 126                  # sessions for median traded value
LIQ_DROP_FRAC = 0.20              # drop the least liquid 20% of the remainder
LIQ_TERCILES = 3                  # traded-value bands, also used for spread costs

# ----------------------------------------------------------------------
# Candidate signals. Each is oriented so that the literature expects a
# positive relation with the next month's return, except TREND_L, whose sign
# the literature finds to differ by horizon (short averages act as reversal,
# long ones as trend), so its sign is left to the development data.
# ----------------------------------------------------------------------
TREND_LAGS = (5, 20, 50, 100, 200)
CANDIDATES = (
    "MOM_12_1",                   # return from t-252 to t-21 sessions
    "HIGH52",                     # close / 252-session high
    *(f"TREND_{L}" for L in TREND_LAGS),   # L-session moving average / close
    "LOWVOL",                     # minus the 252-session volatility
    "REV_1M",                     # minus the 21-session return
    "VOLSHOCK",                   # log(20-session / 252-session mean traded value)
)
WINSOR = (0.01, 0.99)             # cross-sectional, per signal date, signals and
                                  # the forward returns the regressions are fitted to
IC_HORIZONS = (1, 3, 6, 12)       # months, for the decay of each signal's IC

# Selection rule, applied once on the development period.
IC_T_THRESHOLD = 2.0              # |Newey-West t| of the mean monthly rank IC
NW_LAGS = 6

# The outcome of the rule on Jan 2006 - Oct 2018 signal dates, copied from
# data/strategy/signals-dev.json by the freeze commit. Signs are those of the
# mean IC: TREND_200 enters negatively, so a close above its 200-session
# average scores well.
SELECTED: dict[str, int] = {"MOM_12_1": +1, "HIGH52": +1, "TREND_200": -1, "VOLSHOCK": +1}

# ----------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------
FM_MIN_MONTHS = 36                # completed cross-sectional regressions before M3 trades
FM_ROLLING = 60                   # sensitivity only; the primary uses an expanding mean

# ----------------------------------------------------------------------
# Portfolios
# ----------------------------------------------------------------------
QUANTILES = 5                     # long-only holds the top quintile, equal weight
EXEC_LAG = 1                      # fill at the close one session after the signal
BUFFER_EXIT = 0.30                # variant: hold a name until it leaves the top 30%
VOL_TARGET = 0.12                 # variant: Barroso & Santa-Clara volatility scaling
VOL_WINDOW = 126
MAX_LEVERAGE = 2.0

# ----------------------------------------------------------------------
# Costs per side, as fractions of traded value. Delivery equity on NSE,
# schedule in force from 1 Oct 2024, applied to the whole sample.
# ----------------------------------------------------------------------
STT = 0.001                       # buy and sell
STAMP_BUY = 0.00015               # buy only
EXCHANGE = 0.0000297              # NSE transaction charge
SEBI_FEE = 0.000001               # Rs 10 per crore
GST = 0.18                        # on brokerage and the two charges above
BROKERAGE = 0.0                   # discount-broker delivery
SPREAD_BPS = (5, 15, 35)          # by traded-value tercile, most liquid first

# ----------------------------------------------------------------------
# What is reported. The primary strategy is PRIMARY, long-only, top
# quintile. Every long-only configuration counts as a trial for the Deflated
# Sharpe Ratio. The sensitivity runs change one setting of the primary at a
# time; they are reported, never used to choose.
# ----------------------------------------------------------------------
PRIMARY = "M2"
SENSITIVITY = {
    "mom_lookback_6": {"mom": (126, 21)},
    "mom_lookback_9": {"mom": (189, 21)},
    "mom_skip_0": {"mom": (252, 0)},
    "decile": {"q": 10},
    "tercile": {"q": 3},
    "cost_x2": {"cost_mult": 2.0},
}

# ----------------------------------------------------------------------
# Inference
# ----------------------------------------------------------------------
SEED = 20261021
N_RANDOM = 1000                   # random portfolios
N_PLACEBO = 500                   # cross-sectional shuffles of the forecast
BOOT_BLOCK = 6                    # months, stationary bootstrap
N_BOOT = 5000
