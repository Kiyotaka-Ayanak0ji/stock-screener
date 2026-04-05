

## Problem

The "Add Stocks" step (step 2) in the demo modal has no rendering block — there is no `{currentStep.id === "add-stock" && (...)}` section in the JSX. That's why it shows a blank area.

## Solution

Add an interactive "Add Stock" UI block inside the `AnimatePresence` section of `DemoModal.tsx`:

### File: `src/components/DemoModal.tsx`

1. **Add the `"add-stock"` step UI** — a search input + a list of stocks not yet in the watchlist (filtered from `DEMO_STOCKS`), each with an "Add" button that appends to `addedStocks` state.

2. **Search filtering** — the existing `searchVal` state is already defined but unused. Wire it to filter the available stocks list by ticker or company name.

3. **UI structure**:
   - Search input at the top with the `Search` icon (already imported)
   - List of available stocks (those NOT in `addedStocks`) filtered by `searchVal`
   - Each row shows ticker, name, exchange badge, price, and a `Plus` button to add
   - When a stock is added, it moves to the watchlist and disappears from the add list
   - Show a message when all stocks have been added

This uses only existing state (`searchVal`, `addedStocks`) and existing imports (`Search`, `Plus`, `Check`, `Badge`). No new dependencies needed.

