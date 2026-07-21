import { customerService } from '../../server/modules/customers/customer.module.js'
import { ApiHandler, created, okPaged } from '../../server/shared/http/index.js'

// /api/customers
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await customerService.list(req.query)
    return okPaged(items, pagination)
  },
  POST: async (req) => created(await customerService.create(req.body)),
}).handle
