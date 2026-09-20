# TSC order-tag integration

- Branch: feature/tsc-order-tags in both MagicwashInvoice and webapp-vue.
- Webapp order detail sends customerIndex, total item quantity, and ordered tag IDs through the new backend module.
- Print server validates the body and sends TSPL to the TSC queue using the existing tag layout.
- Automated tests and typechecks pass; physical printing is unverified because Windows lists no TSC TE210 printer.
- Deploy the webapp, restart the local print server, then verify a small print and barcode scan once the TSC queue is available.
- The 35 mm design and barcode persistence remain separate follow-up work.
