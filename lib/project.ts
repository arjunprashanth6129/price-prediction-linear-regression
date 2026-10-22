// Site-wide metadata, and the registry of projects the site presents.
//
// This started as a single-study site and is now a hub, so each study owns its
// own title, description and repository while the site keeps one identity
// around them. Client-safe; no secrets.

export const SITE = {
  name: "Alpha & Error",
  tagline: "Out-of-sample tests of price signals, portfolio risk and pairs trading in Indian and global markets",
  description:
    "Quantitative finance research by Arjun Prashanth: whether price signals beat the Indian market once costs and survivorship bias are accounted for, whether a portfolio can be held to a tail-loss budget, and whether cointegrated pairs of Indian bank stocks keep converging.",
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
  /** One-sentence description, used as the study page meta description. */
  blurb: string;
  /** The repository that owns the analysis. */
  repo: string;
  /** The paper, served by this site so it opens without a GitHub account. */
  paper: string;
}

export const PROJECTS: ProjectMeta[] = [
  {
    href: "/linear-regression",
    name: "Price signals on NSE stocks",
    navName: "Price signals and momentum",
    blurb:
      "A daily regression on 98 NSE stocks, then a monthly momentum strategy tested net of Indian costs, with a holdout run once and a survivorship-free rebuild from NSE's own records.",
    repo: "https://github.com/arjunprashanth6129/price-prediction-linear-regression",
    paper: "/papers/moving-average-signals.pdf",
  },
  {
    href: "/cvar",
    name: "CVaR and tail-risk budgets",
    navName: "CVaR and tail-risk budgets",
    blurb:
      "Five portfolio rules on twelve assets, then expected-shortfall forecasts tested out of sample and a rupee portfolio run to a tail-loss budget, audited and replicated on a century of data it had not seen.",
    repo: "https://github.com/arjunprashanth6129/cvar-portfolio-optimizer",
    paper: "/papers/min-cvar-portfolios.pdf",
  },
  {
    href: "/pairs-trading",
    name: "Pairs-trading backtester",
    navName: "Pairs-trading backtester",
    blurb:
      "A walk-forward evaluation of cointegration-based pairs trading in eleven Indian bank stocks, with parameters fixed on rolling formation periods and costs charged on every leg.",
    repo: "https://github.com/arjunprashanth6129/pairs-trading-backtester",
    paper: "/papers/pairs-trading-indian-banks.pdf",
  },
];

/** Kept for the pages that quote the author or the site repository. */
export const PROJECT = SITE;
