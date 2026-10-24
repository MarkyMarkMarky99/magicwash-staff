# Shared UI — left for later design work

Collected during the shared UI consolidation (plan `docs/plans/shared-ui-consolidation.md`).

## Not converted in extract rounds
- Section header copies: Packaging `.bag-sec` (centred row, 40px with tilted scan button), Intake `.row-sec` (ellipsis title + close in header), wash options `.sec` (in-flow action).

## Inline notices left (bg-*-container)
- Error `rounded-lg px-3 py-2 text-sm` role alert: IssueReportDetailPage:128, IssueReportFormPage:92 & :126, StaffFormPage:226.
- Error `rounded-xl px-3 py-2 text-sm`: OrderReportPage:131, StaffProfilePage:223.
- Error `rounded-xl px-3 py-2 text-xs`: InvoiceDetailPage:286, OrderTagPrintConfirmDialog:91, OrderTagPrintAction:29.
- Error bordered `/30`: OrderItemForm:64-65, OrderCreatePage:194 (x3).
- Error panels `/20 p-5`: CustomerPackageCreatePage:218, InvoiceCreatePage:437 & :456.
- Error other: App.vue:180 toast, LaundryItemDetailView:54 & :72, OrderDetailPage:596 floating, PackageFormPage:78, TagScannerPrototypePage:280, GarmentRegistrationCamera:328 & :332.
- Warning: GarmentRegistrationCamera:327, WashQueueDetailSheet:150, DepartmentWorkPage:491 strip, CustomerListPage:90 & PriceListItemPicker:168 strips, OrderDetailSheet:129 & :137, InvoiceCreatePage:344, :477, :496, CustomerPackageCreatePage:219-221.
- Success: InvoiceDetailPage:279, OrderTagPrintAction:28, OrderBagsView:249.
- Info: OrderBagsView:322.
- Mixed tone: OrderDetailPage:594, OrderBagsView:256, :288, :290, ScanResultCard:47.

## Dry-tests already failing before the refactor (at bbd010a6)
architecture frontend-data-boundaries, customer-package.service, agent-chat.store, pending-appointments-page, appointment.store, customer-order-history-race, job-tickets complete-order/job-ticket-store/scan-workflow, order-image-weight-query, order.store, list-page-layout, form-route-integrations.
