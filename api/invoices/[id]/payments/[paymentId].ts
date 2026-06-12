import { invoiceService } from '../../../modules/invoices/services/invoice.service'
import { ApiHandler, ok } from '../../../shared/http'

// /api/invoices/:id/payments/:paymentId  — verify/correct a payment.
export default new ApiHandler({
  PATCH: async (req) =>
    ok(await invoiceService.updatePayment(req.params.id, req.params.paymentId, req.body)),
}).handle
