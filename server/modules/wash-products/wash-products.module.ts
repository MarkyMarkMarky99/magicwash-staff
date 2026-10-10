import { washProductsApiContract } from '../../../contracts/wash-products/wash-products-api.schema.js'
import { toNullableString } from '../../../shared/utils/bangkok-datetime.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { ok } from '../../shared/http/response.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { getWashProductsRepository } from '../../sheets/WashProducts/WashProducts.repository.js'

export const washProductsRoutes = {
  collection: new ApiHandler({
    GET: async (req) => {
      parseOrThrow(washProductsApiContract.query.list, req.query)
      const rows = (await getWashProductsRepository().read())
        .map((row) => ({
          id: String(row.id ?? ''),
          type: row.type!,
          name: String(row.name ?? ''),
          status: row.status!,
          sortOrder: row.sort_order ?? null,
          note: toNullableString(row.note),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type)
          if (a.sortOrder !== b.sortOrder) {
            if (a.sortOrder === null) return 1
            if (b.sortOrder === null) return -1
            return a.sortOrder - b.sortOrder
          }
          return a.id.localeCompare(b.id)
        })
      return ok(rows)
    },
  }),
}
