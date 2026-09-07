import { z } from 'zod'
import {
  afterPhotoApiContract,
  afterPhotoUpdateResponseSchema,
} from '../../../contracts/after-photos/after-photo-api.schema.js'
import { getAfterPhotoRepository } from '../../sheets/AfterPhoto/AfterPhoto.repository.js'
import { afterPhotoRowSchema } from '../../sheets/AfterPhoto/AfterPhoto.db-contract.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { Mapper, type ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { BaseCrudService, mapDbRowToApi } from '../../shared/services/base-crud.service.js'
import { projectResponse, requireSingleRow } from '../../shared/services/crud-helpers.js'
import { generateShortId } from '../../shared/utils/id.js'

type AfterPhotoDbRow = z.infer<typeof afterPhotoRowSchema>
type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>

export const afterPhotoFieldMap = {
  id: 'afterPhotoId',
  order_id: 'orderId',
  orderitem_id: 'orderItemId',
  item_id: 'itemId',
  image_path: 'imagePath',
  image_url: 'imageUrl',
  notes: 'notes',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_by: 'updatedBy',
  updated_at: 'updatedAt',
  checked: 'checked',
  is_active: 'isActive',
  file_id: 'fileId',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof AfterPhotoDbRow & string, string>

type AfterPhotoApiRow = ApiRowFromFieldMap<AfterPhotoDbRow, typeof afterPhotoFieldMap>
type AfterPhotoListQuery = z.infer<typeof afterPhotoApiContract.query.list>
type AfterPhotoCreate = z.infer<typeof afterPhotoApiContract.request.create>
type AfterPhotoUpdate = z.infer<typeof afterPhotoApiContract.request.update>
type AfterPhotoListResponse = z.infer<typeof afterPhotoApiContract.response.list>
type AfterPhotoDetailResponse = z.infer<typeof afterPhotoApiContract.response.detail>
type AfterPhotoCreateResponse = z.infer<typeof afterPhotoApiContract.response.create>
type AfterPhotoUpdateResponse = z.infer<typeof afterPhotoApiContract.response.update>

export interface AfterPhotoServiceOptions {
  repository?: SheetRepositoryContract<AfterPhotoDbRow>
  orderItemFormsRepository?: () => SheetRepositoryContract<OrderItemFormsDbRow>
}

export function createAfterPhotoId(): string {
  return generateShortId()
}

function prepareAfterPhotoAppendRow(row: Partial<AfterPhotoDbRow>): Partial<AfterPhotoDbRow> {
  return {
    ...row,
    id: typeof row.id === 'string' && row.id.trim() !== '' ? row.id : createAfterPhotoId(),
  }
}

export function createAfterPhotoRepository(): SheetRepositoryContract<AfterPhotoDbRow> {
  return {
    read: (query) => getAfterPhotoRepository().read(query),
    append: (row) => getAfterPhotoRepository().append(prepareAfterPhotoAppendRow(row)),
    batchAppend: (rows) =>
      getAfterPhotoRepository().batchAppend(rows.map(prepareAfterPhotoAppendRow)),
    update: (keyValue, patch) => getAfterPhotoRepository().update(keyValue, patch),
    delete: (keyValue, deletedBy) => getAfterPhotoRepository().delete(keyValue, deletedBy),
  }
}

const afterPhotoMapper = new Mapper(afterPhotoFieldMap)

export class AfterPhotoService extends BaseCrudService<
  AfterPhotoApiRow,
  AfterPhotoListQuery,
  AfterPhotoCreate,
  AfterPhotoUpdate,
  AfterPhotoListResponse,
  AfterPhotoDetailResponse,
  AfterPhotoCreateResponse,
  AfterPhotoUpdateResponse,
  AfterPhotoDbRow,
  typeof afterPhotoFieldMap
> {
  private readonly photoRepository: SheetRepositoryContract<AfterPhotoDbRow>
  private readonly orderItemFormsRepository: () => SheetRepositoryContract<OrderItemFormsDbRow>

  constructor(input: AfterPhotoServiceOptions = {}) {
    const repository = input.repository ?? createAfterPhotoRepository()
    super({
      repository,
      api: afterPhotoApiContract,
      searchFields: [],
      fieldMap: afterPhotoFieldMap,
    })
    this.photoRepository = repository
    this.orderItemFormsRepository = input.orderItemFormsRepository ?? getOrderItemFormsRepository
  }

  override async update(id: string, payload: unknown): Promise<AfterPhotoUpdateResponse> {
    const data = parseOrThrow(afterPhotoApiContract.request.update, payload)
    const safeId = id.trim()
    if (safeId === '') {
      throw ApiError.badRequest('id is required')
    }

    const photoRows = await this.photoRepository.read(
      ReadQueryDTO.fromId<Partial<AfterPhotoDbRow>>(safeId),
    )
    const photo = requireSingleRow(photoRows, safeId)
    const itemRows = await this.orderItemFormsRepository().read(
      ReadQueryDTO.fromId<Partial<OrderItemFormsDbRow>>(data.orderItemId),
    )
    const item = requireSingleRow(itemRows, data.orderItemId)

    if (
      typeof photo.order_id !== 'string' ||
      photo.order_id.trim() === '' ||
      typeof item.order_id !== 'string' ||
      item.order_id.trim() === ''
    ) {
      throw ApiError.badRequest('Photo and order item must belong to an order')
    }
    if (photo.order_id !== item.order_id) {
      throw ApiError.badRequest('Photo and order item belong to different orders')
    }

    // Do not patch updated_at: the After sheet stores it as plain DD/MM/YYYY text, and the Sheets
    // API request is USER_ENTERED; this update only changes the reassignment fields and actor.
    const stored = await this.photoRepository.update(safeId, {
      orderitem_id: data.orderItemId,
      item_id: item.item_id,
      updated_by: data.updatedBy,
    })
    const apiRow = mapDbRowToApi(stored, afterPhotoMapper, {})
    return projectResponse<AfterPhotoUpdateResponse>(apiRow, afterPhotoUpdateResponseSchema)
  }
}

export const afterPhotoService = new AfterPhotoService()
export const afterPhotoRoutes = createCrudRoutes(afterPhotoService, afterPhotoApiContract)
