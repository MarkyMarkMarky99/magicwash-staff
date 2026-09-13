# Price list browse

The staff price-list page shows one entry per `itemCode`, including codes with only one price row.
Category tab counts count item codes. Search, category, and service filters include a code when any
of its price rows matches; the detail sheet then shows every price row for that code, with a match
for the selected service placed first. A code is in the active section when any matching row is active.

Opening a code uses a route-owned `itemCode` query parameter and the shared `DetailOverlay`, so
browser Back closes the sheet. The sheet identifies each price row by service, amount, unit, active
state, and effective dates. Navigating away while the sheet is open replaces its history entry.
Rows with the same code and service remain separate; edit navigation
uses the price-list row `id`. Each row reveals Edit on a left swipe using `BaseSwipeCard`, and a
visible Edit button provides keyboard and desktop access.
