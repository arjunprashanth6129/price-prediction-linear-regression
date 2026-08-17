// Shared project metadata. Client-safe; no secrets.
export const PROJECT = {
  name: "Price prediction with a linear regression model",
  shortName: "Price Prediction",
  tagline: "Do momentum signals forecast tomorrow's return?",
  description:
    "A linear regression study across 98 NSE stocks testing whether moving averages, the golden cross and lagged returns carry any information about next-day returns.",
  github:
    "https://github.com/arjunprashanth6129/price-prediction-linear-regression",
  live: "https://quant-projects.vercel.app",
  author: "Arjun",
};

/** Fixed parameters of the study, quoted in the header and footer. */
export const STUDY = {
  windowStart: "June 2019",
  windowEnd: "June 2026",
  trainFrac: 0.8,
  features: ["ma5", "ma20", "ret", "ma_ratio"],
  workedExample: "RELIANCE",
};
