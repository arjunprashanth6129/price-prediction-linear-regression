// Ticker -> company name for the stocks the pipeline was pointed at.
//
// The same file is the input to scripts/ml/01_fetch_data.py, so the app and the
// pipeline can never disagree about which stocks are in scope. Coverage in
// data/ml-signals.json is a subset: names that could not be modelled are listed
// in data/ml-missing.json with the reason.

import universeJson from "@/data/universe.json";

const NAMES = universeJson as Record<string, string>;

export const TICKERS = Object.keys(NAMES).sort();

/** Display name for a ticker, falling back to the ticker itself. */
export function companyName(ticker: string): string {
  return NAMES[ticker] ?? ticker;
}
