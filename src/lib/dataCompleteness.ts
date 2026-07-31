import { Stock } from "@/lib/stockData";
import { looksLikeIndexTicker } from "@/lib/growwApi";

export type DataCompleteness = "complete" | "partial";

/**
 * Fields that must carry a real (positive, finite) value for a stock to count
 * as having "complete" data. Indices genuinely have no volume / market cap /
 * P/E from the upstream feeds, so those are excluded for them.
 */
export function missingDataFields(stock: Stock): string[] {
  const isIndex = !!stock.isIndex || looksLikeIndexTicker(stock.ticker, stock.yahooSymbol);
  const checks: { label: string; value: number }[] = [
    { label: "Price", value: stock.price },
    { label: "Prev. Close", value: stock.previousClose },
    { label: "Open", value: stock.open },
    { label: "High", value: stock.high },
    { label: "Low", value: stock.low },
  ];

  if (!isIndex) {
    checks.push(
      { label: "Volume", value: stock.volume },
      { label: "Market Cap", value: stock.marketCap },
      { label: "P/E", value: stock.pe },
    );
  }

  return checks
    .filter(c => !(typeof c.value === "number" && Number.isFinite(c.value) && c.value > 0))
    .map(c => c.label);
}

export function getDataCompleteness(stock: Stock): DataCompleteness {
  return missingDataFields(stock).length === 0 ? "complete" : "partial";
}

export function isCompleteData(stock: Stock): boolean {
  return getDataCompleteness(stock) === "complete";
}
