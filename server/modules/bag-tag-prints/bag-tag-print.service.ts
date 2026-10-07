import type { z } from 'zod'
import type { orderImageResponseSchema } from '../../../contracts/order-images/order-image-api.schema.js'
import { bagTagCustomerIndexSchema } from '../../../contracts/bag-tag-prints/bag-tag-print.schema.js'
import { normalizeSheetTimestamp } from '../../../shared/utils/bangkok-datetime.js'
import { customerService } from '../customers/customer.module.js'
import { requestBagTagPrint } from './bag-tag-print-client.js'

type OrderImage = z.infer<typeof orderImageResponseSchema>

export interface BagTagPrintServiceOptions {
  customerReader?: (customerId: string) => Promise<{ customerIndex: unknown } | null>
  printClient?: typeof requestBagTagPrint
}

export function logBagTagFailure(failureKind: string): void {
  console.error(JSON.stringify({ event: 'bag_tag_print_failure', failureKind }))
}

export class BagTagPrintService {
  private readonly customerReader
  private readonly printClient

  constructor(input: BagTagPrintServiceOptions = {}) {
    this.customerReader = input.customerReader ?? ((id) => customerService.getById(id))
    this.printClient = input.printClient ?? requestBagTagPrint
  }

  async print(image: OrderImage): Promise<void> {
    if (process.env.BAG_TAG_PRINT_ENABLED !== 'true' || image.imageType !== 'WEIGHT') return

    const weightKg = typeof image.quantity === 'number' || typeof image.quantity === 'string'
      ? Number(image.quantity) : NaN
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg >= 1000) {
      logBagTagFailure('invalid_quantity')
      return
    }

    let customerIndex: string | null = null
    try {
      const customer = image.customerId ? await this.customerReader(image.customerId) : null
      if (!customer) {
        logBagTagFailure('customer_not_found')
      } else {
        // GViz returns a numeric-looking CustomerIndex column as a number.
        const raw = typeof customer.customerIndex === 'number' && Number.isFinite(customer.customerIndex)
          ? String(customer.customerIndex)
          : customer.customerIndex
        const parsed = bagTagCustomerIndexSchema.safeParse(raw)
        if (parsed.success) customerIndex = parsed.data.trim() === '' ? null : parsed.data
        else logBagTagFailure('invalid_customer_index')
      }
    } catch {
      logBagTagFailure('customer_lookup_error')
    }

    const request = {
      qrValue: `${process.env.BAG_TAG_TRACKING_URL_BASE ?? ''}${image.orderImageId}`,
      barcodeValue: image.orderImageId,
      customerIndex,
      weightKg,
      weighedAt: normalizeSheetTimestamp(image.createdAt),
    }
    await this.printClient(request)
  }
}
