import { machinesApiContract } from '../../../contracts/machines/machines-api.schema.js'
import { toNullableString } from '../../../shared/utils/bangkok-datetime.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { ok } from '../../shared/http/response.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { getMachinesRepository } from '../../sheets/Machines/Machines.repository.js'

export const machinesRoutes = {
  collection: new ApiHandler({
    GET: async (req) => {
      parseOrThrow(machinesApiContract.query.list, req.query)
      const rows = (await getMachinesRepository().read())
        .filter((row) => row.status === 'ACTIVE')
        .map((row) => ({
          id: String(row.id ?? ''),
          type: row.type!,
          name: String(row.name ?? ''),
          capacityKg: row.capacity_kg ?? null,
          status: row.status!,
          sortOrder: row.sort_order ?? null,
          note: toNullableString(row.note),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'WSH' ? -1 : 1
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
