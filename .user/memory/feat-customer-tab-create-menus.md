# feat/customer-tab-create-menus

- Customer detail tabs: ORDERS / PACKAGES / INVOICES / APPOINTMENTS; APPOINTMENTS is display only.
- Each tab's `ListContainer` actions slot holds a `CreateDropdownMenu` (customers feature) labelled with the list count, e.g. `101 ORDERS`.
- Pill button is shared `DropdownPillTrigger`; `InvoicePaymentsMenu` uses it too.
- Invoices menu lists the customer's orders; picking one opens invoice create (create page shows the duplicate-invoice warning).
- All tab rows use `CustomerRecordCard`; no leading icon, and no customer name, phone, id or address in rows.
- Package row: name + status + `X left`; line 2 `Start … · Expiry …` like invoice `Issued … · Due …`.
- Removed: Order History refresh button and collapse; New Order / Schedule Pickup buttons from the customer card.
- Customer appointments store now applies `onFresh` results.
- Pre-existing failing dry-tests, also failing on `main`: `customer-order-history-race`, `customer-scoped-store-reloads`, `appointment.store`, `form-route-integrations` (editOrder).
- Codex implement session: `01a0e29b-b482-7481-8dac-c8707fc02ed1`.
