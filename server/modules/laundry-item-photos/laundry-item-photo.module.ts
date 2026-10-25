import type { z } from 'zod'
import { laundryItemPhotoApiContract } from '../../../contracts/laundry-item-photos/laundry-item-photo-api.schema.js'
import type { laundryItemPhotosRowSchema } from '../../sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'
import type { orderGarmentsRowSchema } from '../../sheets/OrderGarments/OrderGarments.db-contract.js'
import { getOrderGarmentsRepository } from '../../sheets/OrderGarments/OrderGarments.repository.js'
import { getLaundryItemPhotosRepository } from '../../sheets/LaundryItemPhotos/LaundryItemPhotos.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { generateShortId } from '../../shared/utils/id.js'
import { ApiError } from '../../shared/http/api-error.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'

type LaundryItemPhotosDbRow = z.infer<typeof laundryItemPhotosRowSchema>
type OrderGarmentsDbRow = z.infer<typeof orderGarmentsRowSchema>

export const laundryItemPhotoFieldMap = {
  id: 'id',
  laundry_item_id: 'laundryItemId',
  order_id: 'orderId',
  photo_type: 'photoType',
  image_url: 'imageUrl',
  notes: 'notes',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof LaundryItemPhotosDbRow & string, string>

type LaundryItemPhotoApiRow = ApiRowFromFieldMap<LaundryItemPhotosDbRow, typeof laundryItemPhotoFieldMap>
type LaundryItemPhotoListQuery = z.infer<typeof laundryItemPhotoApiContract.query.list>
type LaundryItemPhotoCreate = z.infer<typeof laundryItemPhotoApiContract.request.create>
type LaundryItemPhotoUpdate = z.infer<typeof laundryItemPhotoApiContract.request.update>
type LaundryItemPhotoResponse = z.infer<typeof laundryItemPhotoApiContract.response.list>

export function createLaundryItemPhotoService(
  getRepository: () => Pick<SheetRepositoryContract<LaundryItemPhotosDbRow>, 'read' | 'append' | 'update'> = getLaundryItemPhotosRepository,
  getOrderGarments: () => Pick<SheetRepositoryContract<OrderGarmentsDbRow>, 'read'> = getOrderGarmentsRepository,
) {
  const repository: Pick<SheetRepositoryContract<LaundryItemPhotosDbRow>, 'read' | 'append' | 'update'> = {
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
      if (row.photo_type === 'REGISTRATION') throw ApiError.badRequest('Registration photos cannot be added here')
      if (!isStorageUrl(row.image_url)) throw ApiError.badRequest('Image URL must use https://firebasestorage.googleapis.com')
      if (row.order_id) {
        const links = await getOrderGarments().read(new ReadQueryDTO<Partial<OrderGarmentsDbRow>>({
          where: { laundry_item_id: row.laundry_item_id, order_id: row.order_id },
        }))
        if (!links.some((link) => link.deleted_at == null || link.deleted_at === '')) throw ApiError.badRequest('Garment is not in this order')
      }
      return getRepository().append({ ...row, id: generateShortId() })
    },
    update: (keyValue, patch) => getRepository().update(keyValue, patch),
  }

  return new BaseCrudService<
    LaundryItemPhotoApiRow, LaundryItemPhotoListQuery, LaundryItemPhotoCreate, LaundryItemPhotoUpdate,
    LaundryItemPhotoResponse, LaundryItemPhotoResponse, LaundryItemPhotoResponse, LaundryItemPhotoResponse,
    LaundryItemPhotosDbRow, typeof laundryItemPhotoFieldMap
  >({
    repository,
    api: laundryItemPhotoApiContract,
    searchFields: [],
    fieldMap: laundryItemPhotoFieldMap,
  })
}

function isStorageUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' && url.host === 'firebasestorage.googleapis.com'
  } catch {
    return false
  }
}

export const laundryItemPhotoService = createLaundryItemPhotoService()
export const laundryItemPhotoRoutes = createCrudRoutes(laundryItemPhotoService, laundryItemPhotoApiContract, {
  create: ['createdBy'],
  update: ['updatedBy'],
})
