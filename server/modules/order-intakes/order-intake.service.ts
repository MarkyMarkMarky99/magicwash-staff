import { z } from 'zod'
import { orderIntakeCreateSchema, type orderIntakeCreateResponseSchema } from '../../../contracts/order-intakes/order-intake-api.schema.js'
import type { itemsRowSchema } from '../../sheets/Items/Items.db-contract.js'
import type { laundryItemsRowSchema } from '../../sheets/LaundryItems/LaundryItems.db-contract.js'
import type { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import type { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import type { orderGarmentsRowSchema } from '../../sheets/OrderGarments/OrderGarments.db-contract.js'
import type { orderImagesRowSchema } from '../../sheets/OrderImages/OrderImages.db-contract.js'
import type { SheetRepositoryContract, SheetBatchUpdateContract } from '../../shared/repositories/sheet-repository.contract.js'
import type { StaffMember } from '../../shared/auth/staff-list.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { createOrderId, toOrderHeaderRow, toOrderItemRow, type JobTicketProvisioningRepository, type WorkTransactionWriter } from '../work-orders/work-order.service.js'
import { createOrderItemId } from '../order-items/order-item.module.js'
import { provisionOrderTickets } from '../work-orders/provision-order-tickets.js'
import { readWorkRates, type WorkRateReader } from '../work-orders/work-rate-lookup.js'

type LaundryItemRow = z.infer<typeof laundryItemsRowSchema>
type BatchWriter<Row extends object> = Pick<SheetRepositoryContract<Row>, 'batchAppend'>

export interface OrderIntakeDependencies {
  items: Pick<SheetRepositoryContract<z.infer<typeof itemsRowSchema>>, 'read'>
  laundryItems: Pick<SheetRepositoryContract<LaundryItemRow>, 'read'> & SheetBatchUpdateContract<LaundryItemRow>
  findTags: (tags: string[]) => Promise<Array<Partial<LaundryItemRow>>>
  orders: BatchWriter<z.infer<typeof orderFormRowSchema>> & Pick<SheetRepositoryContract<z.infer<typeof orderFormRowSchema>>, 'update'>
  lines: BatchWriter<z.infer<typeof orderItemFormsRowSchema>>
  garments: BatchWriter<z.infer<typeof orderGarmentsRowSchema>>
  images: BatchWriter<z.infer<typeof orderImagesRowSchema>>
  jobTickets: Pick<JobTicketProvisioningRepository, 'batchAppend'>
  workTransactions: WorkTransactionWriter
  workRates: () => WorkRateReader
  staff: () => Promise<Map<string, StaffMember>>
  now: () => Date
}

export class OrderIntakeService {
  constructor(private readonly dependencies: OrderIntakeDependencies) {}

  async create(payload: unknown, actor: unknown): Promise<z.infer<typeof orderIntakeCreateResponseSchema>> {
    const data = parseOrThrow(orderIntakeCreateSchema, payload)
    const staffId = parseOrThrow(z.string().trim().min(1), actor)
    const deps = this.dependencies
    const items = await deps.items.read()
    const itemIds = new Set(items.map(item => item.id))
    const itemNames = new Map(items.map(item => [item.id, item.display_name_th ?? null]))
    const unknownItems = data.items.filter(item => !itemIds.has(item.itemId)).map(item => item.itemId)
    if (unknownItems.length > 0) throw ApiError.badRequest(`Unknown items: ${unknownItems.join(', ')}`)
    const registered = (await deps.laundryItems.read({ where: { customer_id: data.customerId } })).filter(row => !row.deleted_at)
    const byTag = new Map(registered.map(row => [row.id, row]))
    const tags = data.items.flatMap(item => item.tags)
    const missingTags = tags.filter(tag => !byTag.has(tag))
    if (missingTags.length > 0) {
      const otherGarments = (await deps.findTags(missingTags)).filter(row => !row.deleted_at)
      const conflictingTags = missingTags.filter(tag => otherGarments.some(row => row.id === tag && row.customer_id !== data.customerId))
      if (conflictingTags.length > 0) throw ApiError.conflict(`Tags belong to another customer: ${conflictingTags.join(', ')}`, { conflictingTags })
      const unregisteredTags = missingTags.filter(tag => !otherGarments.some(row => row.id === tag))
      if (unregisteredTags.length > 0) throw ApiError.badRequest(`Unregistered tags: ${unregisteredTags.join(', ')}`, { unregisteredTags })
      for (const row of otherGarments) byTag.set(row.id, row)
    }
    const typeMismatchTags = data.items.flatMap(item => item.tags.filter(tag => {
      const registeredType = byTag.get(tag)?.item_id
      return registeredType != null && registeredType !== '' && registeredType !== item.itemId
    }))
    if (typeMismatchTags.length > 0) throw ApiError.badRequest(`Registered type differs for tags: ${typeMismatchTags.join(', ')}`, { typeMismatchTags })
    for (const image of data.images) {
      let url: URL
      try { url = new URL(image.imageUrl) } catch { throw ApiError.badRequest('Invalid image URL') }
      if (url.protocol !== 'https:' || url.host !== 'firebasestorage.googleapis.com') throw ApiError.badRequest('Image URL must use https://firebasestorage.googleapis.com')
    }
    const [rates, staff] = await Promise.all([
      readWorkRates(deps.workRates),
      deps.staff().catch(error => {
        console.error('Failed to read staff list for Tagging', error)
        return new Map<string, StaffMember>()
      }),
    ])
    const typeUpdates = data.items.flatMap(item => item.tags.filter(tag => !byTag.get(tag)?.item_id).map(tag => ({
      keyValue: tag, patch: { item_id: item.itemId, updated_by: staffId },
    })))
    if (typeUpdates.length > 0) await deps.laundryItems.updateMany(typeUpdates)
    const orderId = createOrderId()
    const orderData = {
      ...data, createdBy: staffId, quantity: tags.length, orderDescription: null,
      items: data.items.map(item => ({ itemId: item.itemId, quantity: item.tags.length, price: null, description: itemNames.get(item.itemId) ?? null, specialInstructions: null })),
    }
    const header = toOrderHeaderRow(orderData, orderId)
    const lines = orderData.items.map(item => ({ ...toOrderItemRow(item, orderId, orderData), id: createOrderItemId() }))
    const timestamp = formatBangkokTimestamp(deps.now())
    const garments = data.items.flatMap((item, index) => item.tags.map(tag => ({
      id: createOrderItemId(), order_id: orderId, laundry_item_id: tag, orderitem_id: lines[index]!.id,
      status: 'RECEIVED' as const, notes: null, created_at: timestamp, created_by: staffId,
      updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
    })))
    await deps.orders.batchAppend([header])
    try { await deps.lines.batchAppend(lines) } catch { return { orderId, status: 'PENDING', ticketsCreated: 0, failed: ['OrderItemForms', 'OrderGarments'] } }
    try { await deps.garments.batchAppend(garments) } catch { return { orderId, status: 'PENDING', ticketsCreated: 0, failed: ['OrderGarments'] } }
    const failed: string[] = []
    if (data.images.length > 0) {
      try {
        await deps.images.batchAppend(data.images.map(image => ({
          id: createOrderItemId(), customer_id: data.customerId, delivery_id: null, order_id: orderId,
          image_type: image.imageType, image_path: image.imageUrl, notes: null, quantity: null, created_by: staffId,
        })))
      } catch { failed.push('OrderImages') }
    }
    const result = await provisionOrderTickets({
      order: { orderId, customerId: data.customerId, orderName: data.orderName, dueDate: data.dueDate, notes: data.note, createdBy: staffId, completedAt: timestamp },
      lines, garments: garments.map(garment => ({
        laundryItemId: garment.laundry_item_id, taggedBy: staffId, serviceType: data.serviceType,
        specialInstructions: null, photoEvidenceUrl: byTag.get(garment.laundry_item_id)?.image_url ?? null,
      })),
      existingTickets: [], rates, staff, actor: staffId, jobTickets: deps.jobTickets, workTransactions: deps.workTransactions,
    })
    if (result.failure) return { orderId, status: 'PENDING', ticketsCreated: 0, failed: [...failed, 'JobTickets'] }
    if (result.scoreFailed > 0) failed.push('WorkTransactions')
    try {
      await deps.orders.update(orderId, { status: 'APPROVED', updated_by: staffId })
    } catch {
      return { orderId, status: 'PENDING', ticketsCreated: result.ticketsCreated, failed: [...failed, 'OrderForm status'] }
    }
    return { orderId, status: 'APPROVED', ticketsCreated: result.ticketsCreated, failed }
  }
}
