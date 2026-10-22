# Price list browse

The staff price-list page is a read-only price table, not a photo grid. It has no images, no search
box, and no per-card summary lines. All text is English except the Thai item name.

## Data shown

Only retail prices appear: rows that are active and whose `priceGroup` is `DEFAULT`. Inactive rows and
every other price group, such as corporate prices, never appear. The page filters the rows the price-list
store already loads; it makes no extra request.

## Category tabs and heading

The category tabs use names from the loaded rows. ALL comes first, followed by CLOTHING, BEDDING,
HOUSEHOLD, OTHERS when present, then any other categories. Opening a URL without a category replaces it
with `category=CLOTHING`; choosing ALL stores `category=ALL`. The default category redirect runs only
while the price-list route is active. Each tab shows a count pill of the table rows that category
displays, independent of the service filter. A category that has rows but no retail price stays as a
zero-count tab.

Under the tabs, the heading has a lime left bar, the title "Price list" (with the category name when one
is selected), and a small-caps subtitle with the number of rows shown and the selected service ("All
services" or its name). An add button at the right opens the price-list create form for the selected
category.

## Cards and rows

Rows are grouped into one card per subcategory, in the order the subcategories first appear in the data.
A card has a green frame, an offset shadow, and a tilted orange tab at its top left holding the
subcategory name. There is no header row and no summary line.

Each row is one item. Its first line is the bold dark-green Thai name. The variant is not shown
separately, because the Thai display name already includes it. Its second line is small grey text made of the
English name and the unit in short form: `(pc)` for piece, `(set)` for set, `(pr)` for pair, and any
other unit in brackets. A missing English name or unit is left out of the line.

Rows that share the same Thai name and variant across services merge into one row. When two active
rows carry the same Thai name, variant, and service, the second one is a separate row rather than
overwriting the first.

## Service columns

With the service pill on All, each card has one price column per service that at least one of its rows
has, in the fixed order Wash Iron, Wash, Dry Clean, Iron. A thin label row over the price columns names
each service in grey small caps, right-aligned over fixed-width columns, and a label may wrap onto two
lines. A row with no price for a column shows a muted dash. Prices are bold dark green with a baht sign.

With one service selected, each card has a single price column and no label row, and only rows that have
that service appear.

Tapping a price opens the edit form for that exact price row. The picker, the form, and the API are unchanged.

## Service pill

A floating dark-green pill at the bottom of the page switches between All, Wash Iron, Wash, Dry Clean,
and Iron. The selected option sits on a lime slider. The choice is stored in the `serviceType` query
parameter, so it survives reload and Back. Choosing All removes the parameter.

## States

While rows load, two placeholder cards show. A load failure or a response over 1,000 rows shows its message
in place of the cards. When the selected category has no retail rows, a short message says so.
