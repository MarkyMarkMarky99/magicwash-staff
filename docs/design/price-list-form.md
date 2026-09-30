# Price list form

`PriceListFormPage` uses `FormOverlay` for both creating and editing a price-list row. Its dark
price section gives the service selector a full row, then pairs the amount with the billing unit.
The unit belongs to that price row: Invoice copies it to the selected line, and seeds an invoice
line's unit from the linked price-list row when it is created from an order. Order items are always
counted in whole pieces and never read this unit.

`PriceListItemCreatePage` creates an item without pricing through the Items workflow and reuses
the form shell. Its optional photo sits above item type, variant, Thai display name, and English
display name inputs. When opened from the Order picker, the selected category and subcategory
arrive through the route query but have no visible or editable inputs. Closing a direct Order link
returns to its item picker. The save action is disabled until the route context and required item
details are valid; the form stays unavailable while the item is saving.

Creating a price row offers `DEFAULT` and `CREDIT` price groups. The credit view preselects
`CREDIT`. A `CREDIT` row's amount label and suffix say เครดิต; its amount is credits per
stored unit rather than baht. Editing preserves the stored group because update payloads omit
`priceGroup`. The API still accepts a free string for the group.

PriceList creation adds a price row only when `itemCode` already exists in Items. The existing
"new item" form mode omits `itemCode` and cannot save through PriceList POST; item creation
belongs to the Items workflow.
