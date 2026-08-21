// Site-wide metadata, and the registry of projects the site presents.
//
// This started as a single-study site and is now a hub, so each study owns its
// own title, description and repository while the site keeps one identity
// around them. Client-safe; no secrets.

export const SITE = {
  name: "Quant Research Desk",
  tagline: "Two research studies and one applied system, on Indian and global markets",
  description:
    "Quantitative finance work: whether momentum signals predict next-day returns across 98 NSE stocks, a CVaR portfolio optimiser tested against fat tails and the 2008 crash, and a market-neutral pairs-trading backtester.",
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
      "Can price momentum predict tomorrow's return? A linear regression across 98 NSE stocks, and what the answer says about market efficiency.",
    repo: "https://github.com/arjunprashanth6129/price-prediction-linear-regression",
    method:
      "Four price-derived features, one linear regression per stock, seven years of daily closes, and a strict chronological 80/20 split with the benchmark chosen before the score.",
  },
  {
    href: "/cvar",
    name: "CVaR portfolio optimiser",
    navName: "CVaR portfolio optimiser",
    blurb:
      "Building a portfolio around the worst days rather than the average one. Twelve assets in rupees, five strategies, and a walk-forward test that never sees the future.",
    repo: "https://github.com/arjunprashanth6129/cvar-portfolio-optimizer",
    method:
      "Conditional Value-at-Risk minimised as a linear program via Rockafellar-Uryasev, stress-tested on 20,000 simulated scenarios, walk-forward tested and replayed through 2008.",
  },
  {
    href: "/pairs-trading",
    name: "Pairs-trading backtester",
    navName: "Pairs-trading backtester",
    blurb:
      "A market-neutral statistical arbitrage system on Indian banks: cointegration selects the pairs, a rolling formation window fixes the parameters, and a walk-forward backtest charges every leg of every trade.",
    repo: "https://github.com/arjunprashanth6129/pairs-trading-backtester",
    method:
      "Engle-Granger cointegration on each formation window, OLS hedge ratio, z-score entries and exits, and a walk-forward backtest charging costs on all four legs of every round trip.",
  },
];

/** Kept for the pages that quote the author or the site repository. */
export const PROJECT = SITE;
