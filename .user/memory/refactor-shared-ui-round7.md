# Round 7 inventory (refactor/shared-ui)

Input for the unify round; collected by the extract rounds.

## Not converted in extract rounds
- Section header copies: Packaging `.bag-sec` (centred row, 40px with tilted scan button), Intake `.row-sec` (ellipsis title + close in header), wash options `.sec` (in-flow action).
- Paper: garment detail `.orders-paper`/`.paper-tab` (tab top -13 left 14, 12px/800, no shadow, list pt 8); `AgentCardFrame` (tone, max-w 330, inner padding, z-2 tab).
- `OrderBagRow` status bubble check icon 15px vs `WashQueueRow` 14px.

## Inline notices left (bg-*-container)
- Error `rounded-xl px-4 py-3 font-body text-sm`: AppointmentForm:169, OrderPackageUsageOverlay:90.
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
