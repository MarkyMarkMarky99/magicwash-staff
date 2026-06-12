import { invoiceService } from '../modules/invoices/services/invoice.service'
import { ApiHandler, created, okPaginated } from '../shared/http'

// /api/invoices
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await invoiceService.listInvoices(req.query)
    return okPaginated(items, pagination)
  },
  POST: async (req) => created(await invoiceService.createInvoice(req.body)),
}).handle
