# chore/drop-customer-package-view

- Runtime reads left the view in merge `bfa0df11`; this branch deletes the dead sheet code, fixtures and stale comments.
- Still outside webapp-vue, undecided: `appscript/MagicwashPortal/CustomerPackageView*` (6 files) and the live `CustomerPackageView` sheet in the Portal workbook.
- `customerPackagePortalRowSchema` keeps its view-era "Portal" name; rename not scoped.
- `column-order.dry-test.ts` failure is the pre-existing OrderItemForms `update` mismatch, not this branch.
