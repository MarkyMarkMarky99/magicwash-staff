# Mixed-service orders — future branch

## Decision

- Do not add multiple service types to one order on `feat/price-list-image-url` or its release branch.
- Start a separate branch after the price-list photo work is closed.

## Findings to resume

- `OrderCreatePage` requires one header `serviceType`; `OrderDetailPage` uses it to limit the Order price-list picker to one service.
- `workOrderCreateItemSchema` and `orderItemCreateSchema` do not accept a per-item `serviceType`.
- `WorkOrderService` writes the header service to every new item; `OrderItemService.create` derives service from the parent order.
- Backend verifies that a chosen `itemId` exists but does not check its PriceList service against the order header. Opening the picker to all services without changing backend could silently mislabel an item.
- `OrderItemForms` already has a `service_type` column, so the main change is contract and write logic, not adding an item column.
- Invoice create lines currently omit service type, and the backend writes `InvoiceItems.service_type` as `null`.

## Decisions and scope for that branch

- Define whether `OrderForm.service_type` remains the primary/default service or becomes a summary when items differ.
- Update create-order and add-item contracts, backend mapping and service validation, Order picker/form, and item/header displays together.
- Decide whether invoice lines and package-credit attribution must preserve the item's service type.
- Verify the external Apps Script materialization of `OrdersView` and `InvoicesView`; it is not established by this repository.
