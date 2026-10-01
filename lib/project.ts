// Site-wide metadata, and the registry of projects the site presents.
//
// This started as a single-study site and is now a hub, so each study owns its
// own title, description and repository while the site keeps one identity
// around them. Client-safe; no secrets.

export const SITE = {
  name: "Quant Research Desk",
  tagline: "Two research studies and one applied system on Indian and global markets",
  description:
    "Quantitative finance projects: a test of whether moving-average features predict next-day returns for 98 NSE stocks, a comparison of minimum-CVaR and other portfolio rules in and out of sample, and a walk-forward evaluation of pairs trading in Indian bank stocks.",
  live: "https://arjun-quant-projects.vercel.app",
  author: "Arjun",
  github: "https://github.com/arjunprashanth6129",
};

export interface ProjectMeta {
  /** Route this project lives at. */
  href: string;
  /** Full name, used as the page title. */
  name: string;
  /** Short name for the nav. */
  navName: string;
  /** One line for the landing card. */
  blurb: string;
  /** The repository that owns the analysis. */
  repo: string;
  /** Method summary for the landing card. Deliberately states no outcome. */
  method: string;
}

export const PROJECTS: ProjectMeta[] = [
  {
    href: "/linear-regression",
    name: "Price prediction with a linear regression model",
    navName: "Linear regression model",
    blurb:
      "A test of whether moving-average features predict next-day returns, using one linear regression per stock for 98 NSE stocks, evaluated out of sample.",
    repo: "https://github.com/arjunprashanth6129/price-prediction-linear-regression",
    method:
      "Four price-derived features, one OLS regression per stock, seven years of daily closes and a chronological 80/20 split, with benchmarks fixed before estimation.",
  },
  {
    href: "/cvar",
    name: "CVaR portfolio optimiser",
    navName: "CVaR portfolio optimiser",
    blurb:
      "Five portfolio construction rules, including minimum CVaR, on twelve assets measured in rupees, evaluated in sample, out of sample and in historical crises.",
    repo: "https://github.com/arjunprashanth6129/cvar-portfolio-optimizer",
    method:
      "Conditional Value-at-Risk minimised as a linear program (Rockafellar-Uryasev), with a walk-forward backtest net of costs, 20,000 simulated scenarios and a replay of 2008.",
  },
  {
    href: "/pairs-trading",
    name: "Pairs-trading backtester",
    navName: "Pairs-trading backtester",
    blurb:
      "A walk-forward evaluation of cointegration-based pairs trading in eleven Indian bank stocks, with parameters fixed on rolling formation periods and costs charged on every leg.",
    repo: "https://github.com/arjunprashanth6129/pairs-trading-backtester",
    method:
      "Engle-Granger pair selection on each formation period, OLS hedge ratios, z-score entry and exit rules, and a backtest charging costs on all four legs of every round trip.",
  },
];

/** Kept for the pages that quote the author or the site repository. */
export const PROJECT = SITE;
