# Price list picker

Order and invoice both render `PriceListItemPicker` from the price-list feature. The owning page
loads and filters API rows, controls the route-owned open state, and handles the selected row. The
picker owns only local search, category selection, and its two-step bottom sheet.

The picker uses the shared `PickerOverlay` at full height, matching the form overlay's height. Its first screen groups
available rows by `category` and then by the tuple `(category, subcategory, itemType)`, since an
`itemType` string can occur in unrelated subcategories. Selecting an item type opens a draggable
`DetailOverlay` bottom sheet already used by customer order history. The first sheet step lists
its distinct variants; selecting one slides the sheet content right-to-left to the available price
rows. A null variant is labelled `ทั่วไป`. Every
price row remains selectable, including two active rows with the same code and variant but
different prices.

Order passes only active, DEFAULT-group rows matching its service type. Invoice passes active,
DEFAULT-group rows across services. The picker emits the exact selected API row. Order then opens
its quantity form and saves that row's `id`; invoice copies the description, unit, and price into
a line item and closes its picker. The picker does not own either workflow.
