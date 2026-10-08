import type { z } from 'zod'
import { bagItemApiContract } from '../../../contracts/bag-items/bag-item-api.schema.js'
import type { bagItemsRowSchema } from '../../sheets/BagItems/BagItems.db-contract.js'
import { getBagItemsRepository } from '../../sheets/BagItems/BagItems.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { generateShortId } from '../../shared/utils/id.js'

type BagItemsDbRow = z.infer<typeof bagItemsRowSchema>

export const bagItemFieldMap = {
  id: 'bagItemId',
  bag_id: 'bagId',
  order_id: 'orderId',
  laundry_item_id: 'laundryItemId',
  created_at: 'createdAt',
  created_by: 'createdBy',
} as const satisfies Record<keyof BagItemsDbRow & string, string>

type BagItemApiRow = ApiRowFromFieldMap<BagItemsDbRow, typeof bagItemFieldMap>
type BagItemListQuery = z.infer<typeof bagItemApiContract.query.list>
type BagItemCreate = z.infer<typeof bagItemApiContract.request.create>
type BagItemResponse = z.infer<typeof bagItemApiContract.response.list>

export function createBagItemService(
  getRepository: () => SheetRepositoryContract<BagItemsDbRow> = getBagItemsRepository,
) {
  const repository: SheetRepositoryContract<BagItemsDbRow> = {
    read: (query) => getRepository().read(query),
    append: async (row) => {
      const source = getRepository()
      const [existing] = await source.read(new ReadQueryDTO<Partial<BagItemsDbRow>>({
        where: { bag_id: row.bag_id, laundry_item_id: row.laundry_item_id },
      }))
      if (existing !== undefined) return existing as BagItemsDbRow
      return source.append({ ...row, id: generateShortId() })
    },
    batchAppend: (rows) => getRepository().batchAppend(rows),
    update: (keyValue, patch) => getRepository().update(keyValue, patch),
    delete: (keyValue, deletedBy) => getRepository().delete(keyValue, deletedBy),
  }

  return new BaseCrudService<
    BagItemApiRow, BagItemListQuery, BagItemCreate, never,
    BagItemResponse, never, BagItemResponse, never,
    BagItemsDbRow, typeof bagItemFieldMap
  >({
    repository,
    api: bagItemApiContract,
    searchFields: ['bagItemId', 'bagId', 'orderId', 'laundryItemId'],
    fieldMap: bagItemFieldMap,
  })
}

export const bagItemService = createBagItemService()
export const bagItemRoutes = createCrudRoutes(bagItemService, bagItemApiContract)
