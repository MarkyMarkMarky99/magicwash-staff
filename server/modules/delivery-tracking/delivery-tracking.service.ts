import type { z } from 'zod'
import type { deliveryTrackingResponseSchema } from '../../../contracts/delivery-tracking/delivery-tracking-api.schema.js'
import { normalizeSheetDate, normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { ApiError } from '../../shared/http/api-error.js'
import type { appointmentsRowSchema } from '../../sheets/Appointments/Appointments.db-contract.js'
import { getAppointmentsRepository } from '../../sheets/Appointments/Appointments.repository.js'
import type { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import type { orderImagesRowSchema } from '../../sheets/OrderImages/OrderImages.db-contract.js'
import { getOrderImagesRepository } from '../../sheets/OrderImages/OrderImages.repository.js'
import { customerService } from '../customers/customer.module.js'

type DeliveryTrackingResponse = z.infer<typeof deliveryTrackingResponseSchema>
type OrderImageRow = Partial<z.infer<typeof orderImagesRowSchema>>
type OrderFormRow = Partial<z.infer<typeof orderFormRowSchema>>
type AppointmentRow = Partial<z.infer<typeof appointmentsRowSchema>>

export interface DeliveryTrackingServiceOptions {
  readImages?: (where: { id: string } | { order_id: string }) => Promise<OrderImageRow[]>
  readOrder?: (orderId: string) => Promise<OrderFormRow | undefined>
  readDeliveryAppointments?: (orderId: string) => Promise<AppointmentRow[]>
  readCustomerIndex?: (customerId: string) => Promise<unknown>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Received',
  RECEIVED: 'Received',
  SUBMITTED: 'Received',
  APPROVED: 'Being cleaned',
  COMPLETED: 'Ready for delivery',
  CANCELLED: 'Cancelled',
}

const NOT_FOUND = 'Bag tag not found'

export class DeliveryTrackingService {
  private readonly readImages
  private readonly readOrder
  private readonly readDeliveryAppointments
  private readonly readCustomerIndex

  constructor(input: DeliveryTrackingServiceOptions = {}) {
    this.readImages = input.readImages
      ?? ((where) => 'id' in where
        ? getOrderImagesRepository().read({ id: where.id })
        : getOrderImagesRepository().read({ where }))
    this.readOrder = input.readOrder
      ?? (async (orderId) => (await getOrderFormRepository().read({ id: orderId }))[0])
    this.readDeliveryAppointments = input.readDeliveryAppointments
      ?? ((orderId) => getAppointmentsRepository().read({ where: { DeliveryOrderID: orderId } }))
    this.readCustomerIndex = input.readCustomerIndex
      ?? (async (customerId) => (await customerService.getById(customerId))?.customerIndex)
  }

  async get(orderImageId: string): Promise<DeliveryTrackingResponse> {
    const image = (await this.readImages({ id: orderImageId })).find((row) => row.id === orderImageId)
    if (!image || !isWeight(image) || !image.order_id) throw ApiError.notFound(NOT_FOUND)
    const orderId = image.order_id

    const [siblings, order, appointments] = await Promise.all([
      this.readImages({ order_id: orderId }),
      this.readOrder(orderId),
      this.readDeliveryAppointments(orderId),
    ])
    if (!order) throw ApiError.notFound(NOT_FOUND)

    const bags = siblings
      .filter((row) => row.order_id === orderId && isWeight(row) && typeof row.id === 'string')
      .map((row) => ({ row, weighedAt: normalizeSheetTimestamp(row.created_at) }))
      .sort((a, b) => a.weighedAt.localeCompare(b.weighedAt) || String(a.row.id).localeCompare(String(b.row.id)))
    if (!bags.some(({ row }) => row.id === orderImageId)) bags.push({ row: image, weighedAt: normalizeSheetTimestamp(image.created_at) })

    const position = bags.findIndex(({ row }) => row.id === orderImageId)
    const delivered = appointments.find((row) => row.Status === 'COMPLETED' && !row.DeletedAt)
    const customerIndex = order.customer_id ? await this.readCustomerIndexSafely(order.customer_id) : null

    return {
      orderImageId,
      weightPhoto: {
        url: toImageUrl(image.image_path),
        weightKg: toWeight(image.quantity),
        weighedAt: bags[position]!.weighedAt,
        note: typeof image.notes === 'string' && image.notes.trim() !== '' ? image.notes : null,
      },
      bagIndex: position + 1,
      bagCount: bags.length,
      otherBags: bags
        .map(({ row }, index) => ({
          orderImageId: String(row.id),
          bagIndex: index + 1,
          weightKg: toWeight(row.quantity),
          thumbnailUrl: toImageUrl(row.image_path),
        }))
        .filter((bag) => bag.orderImageId !== orderImageId),
      customerIndex: customerIndex ?? '—',
      orderId,
      receivedDate: normalizeSheetDate(order.received_date) ?? '',
      statusLabel: delivered ? 'Delivered' : STATUS_LABELS[String(order.status)] ?? 'Received',
      // Temporary until Appointments has a DeliveredAt column: the completed appointment's last update.
      deliveredAt: delivered ? normalizeSheetTimestamp(delivered.UpdatedAt) || null : null,
      proofOfDeliveryUrl: null,
    }
  }

  private async readCustomerIndexSafely(customerId: string): Promise<string | null> {
    try {
      const value = await this.readCustomerIndex(customerId)
      // GViz returns a numeric-looking CustomerIndex column as a number.
      if (typeof value === 'number' && Number.isFinite(value)) return String(value)
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
    } catch {
      return null
    }
  }
}

function isWeight(row: OrderImageRow): boolean {
  return typeof row.image_type === 'string' && row.image_type.trim().toUpperCase() === 'WEIGHT'
}

function toWeight(value: unknown): number {
  const weight = Number(value)
  return Number.isFinite(weight) ? weight : 0
}

// Legacy rows hold relative paths that are not servable; only full URLs are shown.
function toImageUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\//.test(value.trim()) ? value.trim() : null
}
