import { invoiceService } from '../../../modules/invoices/services/invoice.service'
import { ApiHandler, created } from '../../../shared/http'

// /api/invoices/:id/payments
export default new ApiHandler({
  POST: async (req) => created(await invoiceService.recordPayment(req.params.id, req.body)),
}).handle
