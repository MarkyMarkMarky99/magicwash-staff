# Price list browse

The staff price-list page shows one entry per `itemCode` with at least one active price row, including
codes with only one active price row. Inactive rows never appear in browse cards or their price sheet.
The category tabs use names from the loaded rows. ALL comes first, followed by CLOTHING, BEDDING,
HOUSEHOLD, OTHERS when present, then any other categories. Opening a URL without a category replaces
it with `category=CLOTHING`; choosing ALL stores `category=ALL`. A horizontal row of image tiles
shows ALL and the distinct subcategories among active rows in the selected category. Each tile uses
an image from those rows, an uppercase label, and the original value as its filter key. The
row is hidden for category ALL or when the selected category has no subcategories.
Changing category resets subcategory to ALL. Search, category, subcategory, and service filters
include a code when any of its active price rows matches. Tab counts count active item codes from
the full loaded collection, independently of search and service filters. Categories with no active
rows remain available as zero-count tabs, so an explicit `category=CLOTHING` still selects CLOTHING
even when that category has no active prices. Its empty state explains that no active items exist.
The price sheet shows every active price row for that code, with a match for the selected service
placed first. Main cards use a two-column image-led grid and the same generic `ImageContentCard` as
the price-list picker's item-type grid. The shared image frame slightly crops source-photo margins
so photos fill the card edge. Both a single price and a minimum–maximum range across active rows
appear as text at the top right of the image, with a light text shadow for contrast and no
background panel. Equal prices display once. The card has no separate status line.

Every main-list card uses `BaseSwipeCard`: swiping left reveals Edit underneath the card. For a
single-price code, Edit opens that row's form directly. Tapping a multi-price card or choosing its
Edit action opens a compact,
content-height bottom sheet using the shared `DetailOverlay`. Each price is a choice that opens
the matching price-list row `id` for editing. The sheet shows only details needed to distinguish
choices: service and unit when they differ, row details and ID when prices otherwise duplicate, and
inactive status when applicable.

The sheet uses a route-owned `itemCode` query parameter, so browser Back closes it. Navigating away
while it is open replaces its history entry. A direct link to a single-price code goes to that row's
edit form without opening a sheet.
