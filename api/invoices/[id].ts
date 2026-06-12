import { invoiceService } from '../modules/invoices/services/invoice.service'
import { ApiHandler, ok } from '../shared/http'

// /api/invoices/:id  — invoices are immutable (no PATCH); soft-delete deferred.
export default new ApiHandler({
  GET: async (req) => ok(await invoiceService.getInvoice(req.params.id)),
}).handle
