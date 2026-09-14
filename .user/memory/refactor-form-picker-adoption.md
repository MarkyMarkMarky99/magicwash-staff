# refactor/form-picker-adoption

## Status

- `FormPicker.vue` has `searchable` (default true); false hides search and focuses the active option.
- Migrated to FormPicker: customer-package package picker, transaction type, order package usage, price-list category/subcategory/service type, invoice line unit.
- Left unchanged: gallery reassign target (immediate-action sheet, would need a confirm step).

## Open

- User-found bug: dropdown stays open when clicking or tabbing to another field; needs document `pointerdown` outside-close and root `focusout`.
- Browser test brief not yet re-run after the fix; add outside-click and tab-away scenarios.
- Dead CSS `.invoice-line-select` in `InvoiceLineItemsEditor.vue`.
- Cosmetic, report only: price-list required `*` is now plain label text; service picker on the dark price panel; invoice unit dropdown width on mobile.
- Out of scope, not migrated: dev preview selects, date pickers, list filter strips, price-list item search flows.
