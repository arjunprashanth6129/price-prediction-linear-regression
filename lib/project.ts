// Site-wide metadata, and the registry of projects the site presents.
//
// This started as a single-study site and is now a hub, so each study owns its
// own title, description and repository while the site keeps one identity
// around them. Client-safe; no secrets.

export const SITE = {
  name: "Alpha & Error",
  tagline: "Out-of-sample tests of return prediction, portfolio risk and pairs trading in Indian and global markets",
  description:
    "Quantitative finance research by Arjun Prashanth: out-of-sample tests of whether moving averages predict next-day returns for 98 NSE stocks, how minimum-CVaR portfolios compare with other allocation rules, and whether cointegrated pairs of Indian bank stocks keep converging.",
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
}

export const PROJECTS: ProjectMeta[] = [
  {
    href: "/linear-regression",
    name: "Price prediction with a linear regression model",
    navName: "Linear regression model",
    blurb:
      "A test of whether moving-average features predict next-day returns, using one linear regression per stock for 98 NSE stocks, evaluated out of sample.",
    repo: "https://github.com/arjunprashanth6129/price-prediction-linear-regression",
  },
  {
    href: "/cvar",
    name: "CVaR portfolio optimiser",
    navName: "CVaR portfolio optimiser",
    blurb:
      "Five portfolio construction rules, including minimum CVaR, on twelve assets measured in rupees, evaluated in sample, out of sample and in historical crises.",
    repo: "https://github.com/arjunprashanth6129/cvar-portfolio-optimizer",
  },
  {
    href: "/pairs-trading",
    name: "Pairs-trading backtester",
    navName: "Pairs-trading backtester",
    blurb:
      "A walk-forward evaluation of cointegration-based pairs trading in eleven Indian bank stocks, with parameters fixed on rolling formation periods and costs charged on every leg.",
    repo: "https://github.com/arjunprashanth6129/pairs-trading-backtester",
  },
];

/** Kept for the pages that quote the author or the site repository. */
export const PROJECT = SITE;
