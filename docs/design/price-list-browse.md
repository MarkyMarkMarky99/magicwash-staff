# Price list browse

The staff price-list page shows one entry per `itemCode`, including codes with only one price row.
Category tab counts count item codes. Search, category, and service filters include a code when any
of its price rows matches; the price sheet then shows every price row for that code, with a match
for the selected service placed first. A code is in the active section when any matching row is active.

Codes with one price row open that row's edit form directly. Codes with multiple rows open a compact,
content-height bottom sheet using the shared `DetailOverlay`. Each price is a choice that opens
the matching price-list row `id` for editing. The sheet shows only details needed to distinguish
choices: service and unit when they differ, row details and ID when prices otherwise duplicate, and
inactive status when applicable.

The sheet uses a route-owned `itemCode` query parameter, so browser Back closes it. Navigating away
while it is open replaces its history entry. A direct link to a single-price code goes to that row's
edit form without opening a sheet.
