import type { z } from 'zod'
import { laundryItemApiContract } from '../../../contracts/laundry-items/laundry-item-api.schema.js'
import { laundryTagIdSchema } from '../../../contracts/laundry-tag-prints/laundry-tag-print.schema.js'
import type { laundryItemsRowSchema } from '../../sheets/LaundryItems/LaundryItems.db-contract.js'
import { getLaundryItemsRepository } from '../../sheets/LaundryItems/LaundryItems.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { ApiError } from '../../shared/http/api-error.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'

type LaundryItemsDbRow = z.infer<typeof laundryItemsRowSchema>

export const laundryItemFieldMap = {
  id: 'id',
  customer_id: 'customerId',
  item_id: 'itemId',
  wash_program: 'washProgram',
  notes: 'notes',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
  image_url: 'imageUrl',
} as const satisfies Record<keyof LaundryItemsDbRow & string, string>

type LaundryItemApiRow = ApiRowFromFieldMap<LaundryItemsDbRow, typeof laundryItemFieldMap>
type LaundryItemListQuery = z.infer<typeof laundryItemApiContract.query.list>
type LaundryItemCreate = z.infer<typeof laundryItemApiContract.request.create>
type LaundryItemUpdate = z.infer<typeof laundryItemApiContract.request.update>
type LaundryItemResponse = z.infer<typeof laundryItemApiContract.response.list>

class LaundryItemService extends BaseCrudService<
  LaundryItemApiRow, LaundryItemListQuery, LaundryItemCreate, LaundryItemUpdate,
  LaundryItemResponse, LaundryItemResponse, LaundryItemResponse, LaundryItemResponse,
  LaundryItemsDbRow, typeof laundryItemFieldMap
> {
  override async getById(id: string) {
    return super.getById(parseOrThrow(laundryTagIdSchema, id))
  }

  override async update(id: string, payload: unknown) {
    return super.update(parseOrThrow(laundryTagIdSchema, id), payload)
  }
}

export function createLaundryItemService(
  getRepository: () => Pick<SheetRepositoryContract<LaundryItemsDbRow>, 'read' | 'append' | 'update'> = getLaundryItemsRepository,
) {
  const repository: Pick<SheetRepositoryContract<LaundryItemsDbRow>, 'read' | 'append' | 'update'> = {
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
    append: async (row) => {
      const source = getRepository()
      const existing = await source.read(new ReadQueryDTO<Partial<LaundryItemsDbRow>>({ id: row.id }))
      if (existing.length > 0) throw ApiError.conflict(`Laundry item '${row.id}' already exists`)
      return source.append(row)
    },
    update: (keyValue, patch) => getRepository().update(keyValue, patch),
  }

  return new LaundryItemService({
    repository,
    api: laundryItemApiContract,
    searchFields: ['id', 'customerId', 'itemId', 'washProgram', 'notes'],
    fieldMap: laundryItemFieldMap,
  })
}

export const laundryItemService = createLaundryItemService()
export const laundryItemRoutes = createCrudRoutes(laundryItemService, laundryItemApiContract, {
  create: ['createdBy'],
  update: ['updatedBy'],
})
