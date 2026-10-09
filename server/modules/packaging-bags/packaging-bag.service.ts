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
import { BagLogisticsTicketService } from '../order-images/bag-logistics-ticket.service.js'
import { BagTagPrintService, logBagTagFailure } from '../bag-tag-prints/bag-tag-print.service.js'
import { JobTicketAdvanceService, type JobTicketAdvanceRepository } from '../job-tickets/job-ticket-advance.service.js'
import { findEarlierDepartment } from '../job-tickets/job-ticket-gating.js'

type ImageRepository = Pick<SheetRepositoryContract<z.infer<typeof orderImagesRowSchema>>, 'read' | 'batchAppend'>
type BagRepository = Pick<SheetRepositoryContract<z.infer<typeof bagItemsRowSchema>>, 'read' | 'batchAppend'>

export interface PackagingBagServiceOptions {
  images?: () => ImageRepository
  bagItems?: () => BagRepository
  tickets?: () => Pick<JobTicketAdvanceRepository, 'read'>
  logistics?: Pick<BagLogisticsTicketService, 'provision'>
  advance?: Pick<JobTicketAdvanceService, 'completePackaging'>
  printer?: Pick<BagTagPrintService, 'printBag'>
  now?: () => Date
}

export class PackagingBagService {
  private readonly images
  private readonly bagItems
  private readonly tickets
  private readonly logistics
  private readonly advance
  private readonly printer
  private readonly now

  constructor(input: PackagingBagServiceOptions = {}) {
    this.images = input.images ?? getOrderImagesRepository
    this.bagItems = input.bagItems ?? getBagItemsRepository
    this.tickets = input.tickets ?? getJobTicketsRepository
    this.logistics = input.logistics ?? new BagLogisticsTicketService()
    this.advance = input.advance ?? new JobTicketAdvanceService({ deterministicEarnIds: true })
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
      Promise.all(request.bags.map(bag => images.read({ id: bag.orderImageId }))),
    ])
    const tickets = allTickets.filter(ticket => !ticket.deleted_at)
    const selectedTickets = []
    for (const [index, bag] of request.bags.entries()) {
      const image = existingImages[index]?.[0]
      if (image && (image.order_id !== request.orderId || image.image_type !== 'BAG' || image.image_path !== bag.imagePath)) {
        throw ApiError.conflict(`Bag ${bag.orderImageId} already exists with different order or photo. Reload the order.`)
      }
      const storedGarments = existingItems.filter(item => item.bag_id === bag.orderImageId)
      if (storedGarments.some(item => item.order_id !== request.orderId || !bag.laundryItemIds.includes(item.laundry_item_id ?? ''))) {
        throw ApiError.conflict(`Bag ${bag.orderImageId} is already confirmed with different garments. Reload the order.`)
      }
      for (const garmentId of bag.laundryItemIds) {
        const jobs = tickets.filter(ticket => ticket.order_id === request.orderId && ticket.scope === 'ITEM'
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
          if (ticket.status !== 'Completed' || existingItems.some(item => item.bag_id === bag.orderImageId && item.laundry_item_id === garmentId)) selectedTickets.push(ticket)
        }
      }
    }

    try {
      const missingImages = request.bags.filter((_, index) => !existingImages[index]?.length)
      if (missingImages.length) await images.batchAppend(missingImages.map(bag => ({
        id: bag.orderImageId, order_id: request.orderId, image_type: 'BAG', image_path: bag.imagePath,
        quantity: null, created_by: request.createdBy,
      })))
      const missingItems = request.bags.flatMap(bag => bag.laundryItemIds
        .filter(id => !existingItems.some(item => item.bag_id === bag.orderImageId && item.laundry_item_id === id))
        .map(id => ({ id: `${bag.orderImageId}-${id}`, bag_id: bag.orderImageId, order_id: request.orderId,
          laundry_item_id: id, created_by: request.createdBy })))
      if (missingItems.length) await bagItems.batchAppend(missingItems)
      for (const bag of request.bags) await this.logistics.provision({
        orderId: request.orderId, orderImageId: bag.orderImageId, imagePath: bag.imagePath, createdBy: request.createdBy,
      })
      for (let offset = 0; offset < selectedTickets.length; offset += 200) {
        await this.advance.completePackaging({ department: 'Packaging', fromStatus: 'In Progress', scannedBy: request.createdBy,
          tickets: selectedTickets.slice(offset, offset + 200).map(ticket => ({ ticketId: ticket.id, orderId: request.orderId })) })
      }
    } catch (error) {
      console.error('Packaging bag confirmation write failed', error)
      throw ApiError.internal('Bags were not fully saved. Keep the bags and press Confirm again.')
    }

    const packedAt = formatBangkokTimestamp(this.now())
    const results = []
    for (const bag of request.bags) {
      let printed = false
      try {
        printed = await this.printer.printBag({ orderId: request.orderId, orderImageId: bag.orderImageId,
          customerId: null, weightKg: null, itemCount: bag.laundryItemIds.length, packedAt })
      } catch {
        logBagTagFailure('unexpected_error')
      }
      results.push({ orderImageId: bag.orderImageId, printed })
    }
    return { bags: results }
  }
}
