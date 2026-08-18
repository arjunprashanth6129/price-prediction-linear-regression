// Site-wide metadata, and the registry of projects the site presents.
//
// This started as a single-study site and is now a hub, so each study owns its
// own title, description and repository while the site keeps one identity
// around them. Client-safe; no secrets.

export const SITE = {
  name: "Quant Projects",
  tagline: "Two studies in quantitative finance, on Indian and global markets",
  description:
    "Two quantitative finance studies: whether momentum signals predict next-day returns across 98 NSE stocks, and a CVaR portfolio optimiser tested against fat tails, a walk-forward backtest and the 2008 crash.",
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
  /** Method summary for the landing card. */
  method: string;
  /** The single result the project is actually about. */
  finding: string;
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
      "Four price-derived features, one linear regression per stock, seven years of daily closes, a strict chronological 80/20 split.",
    finding:
      "It predicts nothing. R² of -0.02 on returns and direction correct 49.6% of the time, below a coin flip. The golden cross was never the heaviest feature for any stock.",
  },
  {
    href: "/cvar",
    name: "CVaR portfolio optimiser",
    navName: "CVaR portfolio optimiser",
    blurb:
      "Building a portfolio around the worst days rather than the average one. Twelve assets in rupees, five strategies, and a walk-forward test that never sees the future.",
    repo: "https://github.com/arjunprashanth6129/cvar-portfolio-optimizer",
    method:
      "Conditional Value-at-Risk minimised as a linear program via Rockafellar-Uryasev, stress-tested on 20,000 simulated scenarios and replayed through 2008.",
    finding:
      "The optimiser lost to splitting evenly. Equal weight had the best risk-adjusted return out of sample, though min CVaR had the shallowest drawdown and made money through Lehman.",
  },
];

/** Kept for the pages that quote the author or the site repository. */
export const PROJECT = SITE;
