# Price list form

`PriceListFormPage` uses `FormOverlay` for both creating and editing a price-list row. Its dark
price section gives the service selector a full row, then pairs the amount with the billing unit.
The unit belongs to that price row: Invoice copies it to the selected line, and seeds an invoice
line's unit from the linked price-list row when it is created from an order. Order items are always
counted in whole pieces and never read this unit.

`PriceListItemCreatePage` is a UI-only routed preview for creating an item without pricing. It
reuses the form shell but exposes only item type and variant fields.
When opened from the Order picker, its selected category and subcategory are shown as fixed
context from the route query, without category or subcategory inputs. Staff can edit the item
type and variant only. Closing a direct Order link returns to its item picker.
Its save action stays disabled until the item data contract and write workflow are defined.

Price groups are not editable in this form yet. New price rows use `DEFAULT`; update payloads omit
`priceGroup` so editing an existing row preserves its stored group. The API and sheet still retain
the `priceGroup` field until a separate group-pricing workflow is designed.
