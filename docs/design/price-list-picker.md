# Price list picker

Order and invoice both render `PriceListItemPicker` from the price-list feature. The owning page
loads and filters API rows, controls the route-owned open state, and handles the selected row. The
picker owns only local search and category and subcategory selection. Its price mode also owns a
two-step bottom sheet.

The picker uses the shared `PickerOverlay` at full height, matching the form overlay's height. The
compact order header shows only a title and search field; the invoice header also shows its
price-list context. The order header reuses the translucent mint circle from Order Detail and
ends in a static white `rounded-t-2xl` edge like the customer order detail sheet. It has no drag
handle and fades in without a bottom-sheet slide. Below the header are category icon tiles and subcategory chips. Price mode
groups the filtered rows by the tuple
`(category, subcategory, itemType)`, since an `itemType` string can occur in unrelated subcategories.
The two-column item grid shows a contained product image, an English item-type title with an
add-to-cart icon beside it, and a Thai description on the next line. The card does not show a price.
The picker's headings, controls, status text, and service labels are English; Thai product descriptions
from the PriceList sheet stay as supplied.
Order item mode shows a `NEW ITEM` text link at the right of the Items heading. It is disabled
until a category and subcategory are both selected, then opens the new item form in the
price-list feature through a shared form route builder. The existing Order picker route remains
in browser history, so closing the form returns to the picker. The chosen category and
subcategory are carried in the route query and validated against Items in the form.
Saving creates an Items row without a price and returns to the picker, whose shared Items store
retains the returned row while the sheet read catches up.
In invoice price mode, the icon and card open the same item selection flow; they do not add a row
before its variant and price are chosen. Selecting an item type opens a draggable
`DetailOverlay` bottom sheet already used by customer order history. The first sheet step lists
its distinct variants; selecting one slides the sheet content right-to-left to the available price
rows. A null variant is labelled `General`. Every
price row remains selectable, including two active rows with the same code and variant but
different prices.

Order loads item identities from `/api/items`, including inactive rows and items without any price.
In item mode each card represents one
code and selects it immediately, without a variant, service, or price step. Each order card shows
its code on the image so similarly named items stay distinguishable. Order then opens its quantity
form and saves the selected row's `id` with `price: null`; service type remains on the
order header. Invoice passes active, DEFAULT-group rows across services and uses price mode. It
copies the selected row's description, unit, and price into a line item. The picker does not own
either workflow.
