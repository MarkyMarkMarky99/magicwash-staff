import type { z } from 'zod'
import { orderGarmentApiContract } from '../../../contracts/order-garments/order-garment-api.schema.js'
import type { orderGarmentsRowSchema } from '../../sheets/OrderGarments/OrderGarments.db-contract.js'
import { getOrderGarmentsRepository } from '../../sheets/OrderGarments/OrderGarments.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { generateShortId } from '../../shared/utils/id.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'

type OrderGarmentsDbRow = z.infer<typeof orderGarmentsRowSchema>

export const orderGarmentFieldMap = {
  id: 'id',
  order_id: 'orderId',
  laundry_item_id: 'laundryItemId',
  orderitem_id: 'orderitemId',
  notes: 'notes',
  status: 'status',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof OrderGarmentsDbRow & string, string>

type OrderGarmentApiRow = ApiRowFromFieldMap<OrderGarmentsDbRow, typeof orderGarmentFieldMap>
type OrderGarmentListQuery = z.infer<typeof orderGarmentApiContract.query.list>
type OrderGarmentCreate = z.infer<typeof orderGarmentApiContract.request.create>
type OrderGarmentUpdate = z.infer<typeof orderGarmentApiContract.request.update>
type OrderGarmentResponse = z.infer<typeof orderGarmentApiContract.response.list>

export function createOrderGarmentService(
  getRepository: () => Pick<SheetRepositoryContract<OrderGarmentsDbRow>, 'read' | 'append' | 'update'> = getOrderGarmentsRepository,
) {
  const repository: Pick<SheetRepositoryContract<OrderGarmentsDbRow>, 'read' | 'append' | 'update'> = {
    read: async (query) => {
      const source = getRepository()
      if (query?.id !== undefined) return source.read(query)

      // Filter before paging so deleted rows never consume a list page slot.
      const rows = await source.read(new ReadQueryDTO({ ...query, pagination: undefined }))
      const liveRows = rows.filter((row) => row.deleted_at == null || row.deleted_at === '')
      if (query?.pagination === undefined) return liveRows
      const { page, perPage } = query.pagination
      return liveRows.slice((page - 1) * perPage, page * perPage)
    },
    append: (row) => getRepository().append({ ...row, id: generateShortId() }),
    update: (keyValue, patch) => getRepository().update(keyValue, patch),
  }

  return new BaseCrudService<
    OrderGarmentApiRow, OrderGarmentListQuery, OrderGarmentCreate, OrderGarmentUpdate,
    OrderGarmentResponse, OrderGarmentResponse, OrderGarmentResponse, OrderGarmentResponse,
    OrderGarmentsDbRow, typeof orderGarmentFieldMap
  >({
    repository,
    api: orderGarmentApiContract,
    searchFields: [],
    fieldMap: orderGarmentFieldMap,
  })
}

export const orderGarmentService = createOrderGarmentService()
export const orderGarmentRoutes = createCrudRoutes(orderGarmentService, orderGarmentApiContract, {
  create: ['createdBy'],
  update: ['updatedBy'],
})
