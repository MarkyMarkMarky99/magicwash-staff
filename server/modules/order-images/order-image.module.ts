import { z } from 'zod'
import { BagTagPrintService, logBagTagFailure } from '../bag-tag-prints/bag-tag-print.service.js'
import { WeightPhotoTicketService } from './weight-photo-ticket.service.js'
import { orderImageApiContract } from '../../../contracts/order-images/order-image-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type {
  ApiRowFromFieldMap,
  RepositoryTransformer,
} from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { generateShortId } from '../../shared/utils/id.js'
import { orderImagesRowSchema } from '../../sheets/OrderImages/OrderImages.db-contract.js'
import { getOrderImagesRepository } from '../../sheets/OrderImages/OrderImages.repository.js'

type OrderImagesDbRow = z.infer<typeof orderImagesRowSchema>

export const orderImageFieldMap = {
  id: 'orderImageId',
  customer_id: 'customerId',
  delivery_id: 'deliveryId',
  order_id: 'orderId',
  image_type: 'imageType',
  image_path: 'imagePath',
  notes: 'notes',
  quantity: 'quantity',
  created_at: 'createdAt',
  created_by: 'createdBy',
} as const satisfies Record<keyof OrderImagesDbRow & string, string>

type OrderImageApiRow = ApiRowFromFieldMap<OrderImagesDbRow, typeof orderImageFieldMap>
type OrderImageListQuery = z.infer<typeof orderImageApiContract.query.list>
type OrderImageCreate = z.infer<typeof orderImageApiContract.request.create>
type OrderImageListResponse = z.infer<typeof orderImageApiContract.response.list>
type OrderImageDetailResponse = z.infer<typeof orderImageApiContract.response.detail>
type OrderImageCreateResponse = z.infer<typeof orderImageApiContract.response.create>

export interface OrderImageServiceOptions {
  repository?: SheetRepositoryContract<OrderImagesDbRow>
  bagTagPrintService?: Pick<BagTagPrintService, 'print'>
  weightPhotoTicketService?: Pick<WeightPhotoTicketService, 'provision'>
}

export function createOrderImageId(): string {
  return generateShortId()
}

function prepareOrderImageAppendRow(
  row: Partial<OrderImagesDbRow>,
): Partial<OrderImagesDbRow> {
  const rowWithId = {
    ...row,
    id: typeof row.id === 'string' && row.id.trim() !== '' ? row.id : createOrderImageId(),
  }
  if (rowWithId.delivery_id !== null) {
    return rowWithId
  }

  const { delivery_id: _deliveryId, ...rowWithoutDeliveryId } = rowWithId
  return rowWithoutDeliveryId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createOrderImageTransformer(): RepositoryTransformer {
  return {
    request(request) {
      if (
        request.operation !== 'create' ||
        !isRecord(request.data) ||
        request.data.delivery_id !== null
      ) {
        return request
      }

      const { delivery_id: _deliveryId, ...data } = request.data
      return { ...request, data }
    },
  }
}

export function createOrderImageRepository(): SheetRepositoryContract<OrderImagesDbRow> {
  return {
    read: (query) => getOrderImagesRepository().read(query),
    append: (row) => getOrderImagesRepository().append(prepareOrderImageAppendRow(row)),
    batchAppend: (rows) =>
      getOrderImagesRepository().batchAppend(rows.map(prepareOrderImageAppendRow)),
    update: (keyValue, patch) => getOrderImagesRepository().update(keyValue, patch),
    delete: (keyValue, deletedBy) => getOrderImagesRepository().delete(keyValue, deletedBy),
  }
}

export class OrderImageService extends BaseCrudService<
  OrderImageApiRow,
  OrderImageListQuery,
  OrderImageCreate,
  never,
  OrderImageListResponse,
  OrderImageDetailResponse,
  OrderImageCreateResponse,
  never,
  OrderImagesDbRow,
  typeof orderImageFieldMap
> {
  private readonly bagTagPrintService: Pick<BagTagPrintService, 'print'>
  private readonly weightPhotoTicketService: Pick<WeightPhotoTicketService, 'provision'>

  constructor(input: OrderImageServiceOptions = {}) {
    super({
      repository: input.repository ?? createOrderImageRepository(),
      api: orderImageApiContract,
      searchFields: [],
      fieldMap: orderImageFieldMap,
      transformer: createOrderImageTransformer(),
    })
    this.bagTagPrintService = input.bagTagPrintService ?? new BagTagPrintService()
    this.weightPhotoTicketService = input.weightPhotoTicketService ?? new WeightPhotoTicketService()
  }

  override async create(payload: unknown): Promise<OrderImageCreateResponse> {
    const image = await super.create(payload)
    if (image.imageType === 'WEIGHT') {
      try {
        await this.weightPhotoTicketService.provision(image)
      } catch (error) {
        console.error('Failed to provision weight photo ticket', error)
      }
      try {
        await this.bagTagPrintService.print(image)
      } catch {
        logBagTagFailure('unexpected_error')
      }
    }
    return image
  }
}

export const orderImageService = new OrderImageService()
export const orderImageRoutes = createCrudRoutes(orderImageService, orderImageApiContract)
