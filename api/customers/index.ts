import { customerService } from '../../server/modules/customers/customer.module'
import { ApiHandler, created, okPaged } from '../../server/shared/http'

// /api/customers
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await customerService.list(req.query)
    return okPaged(items, pagination)
  },
  POST: async (req) => created(await customerService.create(req.body)),
}).handle
