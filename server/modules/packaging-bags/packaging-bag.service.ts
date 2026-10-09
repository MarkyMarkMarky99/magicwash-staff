import type { z } from 'zod'
import { packagingBagConfirmRequestSchema, type PackagingBagConfirmResponse } from '../../../contracts/packaging-bags/packaging-bag-api.schema.js'
import { getOrderImagesRepository } from '../../sheets/OrderImages/OrderImages.repository.js'
import { getBagItemsRepository } from '../../sheets/BagItems/BagItems.repository.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { orderImagesRowSchema } from '../../sheets/OrderImages/OrderImages.db-contract.js'
import type { bagItemsRowSchema } from '../../sheets/BagItems/BagItems.db-contract.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { buildBagLogisticsTicket } from '../order-images/bag-logistics-ticket.service.js'
import { BagTagPrintService, logBagTagFailure } from '../bag-tag-prints/bag-tag-print.service.js'
import { JobTicketTransitionService, type JobTicketAdvanceRepository } from '../job-tickets/job-ticket-transition.service.js'
import { findEarlierDepartment } from '../job-tickets/job-ticket-gating.js'

type ImageRepository = Pick<SheetRepositoryContract<z.infer<typeof orderImagesRowSchema>>, 'read' | 'batchAppend'>
type BagRepository = Pick<SheetRepositoryContract<z.infer<typeof bagItemsRowSchema>>, 'read' | 'batchAppend'>

export interface PackagingBagServiceOptions {
  images?: () => ImageRepository
  bagItems?: () => BagRepository
  tickets?: () => Pick<JobTicketAdvanceRepository, 'read'> & { batchAppend(rows: Parameters<ReturnType<typeof getJobTicketsRepository>['batchAppend']>[0]): Promise<unknown> }
  transition?: Pick<JobTicketTransitionService, 'transition'>
  printer?: Pick<BagTagPrintService, 'printBag' | 'resolveCustomerIndex'>
  now?: () => Date
}

export class PackagingBagService {
  private readonly images
  private readonly bagItems
  private readonly tickets
  private readonly transition
  private readonly printer
  private readonly now

  constructor(input: PackagingBagServiceOptions = {}) {
    this.images = input.images ?? getOrderImagesRepository
    this.bagItems = input.bagItems ?? getBagItemsRepository
    this.tickets = input.tickets ?? getJobTicketsRepository
    this.transition = input.transition ?? new JobTicketTransitionService()
    this.printer = input.printer ?? new BagTagPrintService()
    this.now = input.now ?? (() => new Date())
  }

  async confirm(payload: unknown): Promise<PackagingBagConfirmResponse> {
    const request = parseOrThrow(packagingBagConfirmRequestSchema, payload)
    const images = this.images()
    const bagItems = this.bagItems()
    const [allTickets, existingItems, existingImages] = await Promise.all([
      this.tickets().read({ where: { order_id: request.orderId } }),
      bagItems.read({ where: { order_id: request.orderId } }),
      images.read({ where: { order_id: request.orderId } }),
    ])
    const tickets = allTickets.filter(ticket => !ticket.deleted_at)
    const selectedTickets = []
    for (const bag of request.bags) {
      const image = existingImages.find(image => image.id === bag.orderImageId)
      if (image && (String(image.order_id) !== request.orderId || image.image_type !== 'BAG' || image.image_path !== bag.imagePath)) {
        throw ApiError.conflict(`Bag ${bag.orderImageId} already exists with different order or photo. Reload the order.`)
      }
      const storedGarments = existingItems.filter(item => item.bag_id === bag.orderImageId)
      if (storedGarments.some(item => item.order_id !== request.orderId || !bag.laundryItemIds.includes(item.laundry_item_id ?? ''))) {
        throw ApiError.conflict(`Bag ${bag.orderImageId} is already confirmed with different garments. Reload the order.`)
      }
      for (const garmentId of bag.laundryItemIds) {
        const jobs = tickets.filter(ticket => String(ticket.order_id) === request.orderId && ticket.scope === 'ITEM'
          && ticket.department === 'Packaging' && ticket.laundry_item_id === garmentId)
        if (!jobs.length) throw ApiError.validation(`Garment ${garmentId} has no Packaging ticket in this order.`)
        if (existingItems.some(item => item.laundry_item_id === garmentId && (item.bag_id !== bag.orderImageId || item.order_id !== request.orderId))) {
          throw ApiError.conflict(`Garment ${garmentId} is already in another bag.`)
        }
        for (const ticket of jobs) {
          const blocker = findEarlierDepartment(ticket, tickets)
          if (blocker) throw ApiError.conflict(`Garment ${garmentId} is waiting for ${blocker}.`)
          if (typeof ticket.step_no !== 'number' || !ticket.id || !['Pending', 'In Progress', 'Completed'].includes(ticket.status ?? '')) {
            throw ApiError.conflict(`Garment ${garmentId} cannot be completed. Check its Packaging ticket.`)
          }
          if (ticket.status !== 'Completed') selectedTickets.push(ticket)
        }
      }
    }

    try {
      const missingImages = request.bags.filter(bag => !existingImages.some(image => image.id === bag.orderImageId))
      if (missingImages.length) await images.batchAppend(missingImages.map(bag => ({
        id: bag.orderImageId, order_id: request.orderId, image_type: 'BAG', image_path: bag.imagePath,
        quantity: null, created_by: request.createdBy,
      })))
      const missingItems = request.bags.flatMap(bag => bag.laundryItemIds
        .filter(id => !existingItems.some(item => item.bag_id === bag.orderImageId && item.laundry_item_id === id))
        .map(id => ({ id: `${bag.orderImageId}-${id}`, bag_id: bag.orderImageId, order_id: request.orderId,
          laundry_item_id: id, created_by: request.createdBy })))
      if (missingItems.length) await bagItems.batchAppend(missingItems)
      const metadata = tickets.find(ticket => String(ticket.order_id) === request.orderId)
      const missingLogistics = request.bags
        .filter(bag => !allTickets.some(ticket => ticket.id === `LOG-${request.orderId}-${bag.orderImageId}-LOG-BAG`))
        .map(bag => buildBagLogisticsTicket({ orderId: request.orderId, orderImageId: bag.orderImageId,
          imagePath: bag.imagePath, createdBy: request.createdBy }, metadata))
      if (missingLogistics.length) await this.tickets().batchAppend(missingLogistics)
      const result = await this.transition.transition({ department: 'Packaging', targetStatus: 'Completed',
        allowedSourceStatuses: ['Pending', 'In Progress'], scannedBy: request.createdBy,
        tickets: selectedTickets.map(ticket => ({ ticketId: ticket.id, orderId: request.orderId })),
      }, allTickets)
      // A failed score write is logged by the transition; the tickets are Completed, so it does not fail Confirm.
      if (result.kind !== 'completed' || result.blocked.length || result.skipped.length) {
        throw ApiError.internal('Packaging work was not fully saved. Press Confirm again.')
      }
    } catch (error) {
      console.error('Packaging bag confirmation write failed', error)
      throw ApiError.internal('Bags were not fully saved. Keep the bags and press Confirm again.')
    }

    const packedAt = formatBangkokTimestamp(this.now())
    const customerId = tickets.find(ticket => String(ticket.order_id) === request.orderId && ticket.customer_id)?.customer_id ?? null
    const customerIndex = await this.printer.resolveCustomerIndex(customerId)
    const results = []
    for (const bag of request.bags) {
      let printed = false
      try {
        printed = await this.printer.printBag({ orderId: request.orderId, orderImageId: bag.orderImageId,
          customerId, customerIndex, weightKg: null, itemCount: bag.laundryItemIds.length, packedAt })
      } catch {
        logBagTagFailure('unexpected_error')
      }
      results.push({ orderImageId: bag.orderImageId, printed })
    }
    return { bags: results }
  }
}
