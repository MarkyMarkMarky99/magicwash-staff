import { z } from 'zod'
import { orderCreditUsageRequestSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { bangkokToday, normalizeSheetDate, toNumber } from '../../../shared/utils/bangkok-datetime.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { generateShortId } from '../../shared/utils/id.js'
import { getCustomerPackagesRepository } from '../../sheets/CustomerPackages/CustomerPackages.repository.js'
import { getPackagesRepository } from '../../sheets/Packages/Packages.repository.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { MAX_ORDER_ITEMS_PER_PAGE } from '../../../contracts/order-items/order-item-api.schema.js'
import { orderItemService } from '../order-items/order-item.module.js'
import { getItemsRepository } from '../../sheets/Items/Items.repository.js'
import { getPriceListRepository } from '../../sheets/PriceList/PriceList.repository.js'
import { getPackageTransactionsRepository } from '../../sheets/PackageTransactions/PackageTransactions.repository.js'
import { buildLedger } from './customer-package-assembly.js'

const previewInput = orderCreditUsageRequestSchema.omit({ createdBy: true, manualCredits: true })

export class OrderCreditUsageService {
  constructor(private readonly repositories = {
    packages: getCustomerPackagesRepository, catalog: getPackagesRepository,
    orders: getOrderFormRepository, orderItems: () => orderItemService,
    items: getItemsRepository, prices: getPriceListRepository,
    transactions: getPackageTransactionsRepository,
  }) {}
  async preview(input: unknown) {
    const { customerPackageId, orderId } = parseOrThrow(previewInput, input)
    const { customerId: _customerId, ...preview } = await this.calculate(customerPackageId, orderId)
    return preview
  }

  private async calculate(customerPackageId: string, orderId: string) {
    const [packages, orders, orderItems, transactions] = await Promise.all([
      this.repositories.packages().read({ where: { id: customerPackageId } }),
      this.repositories.orders().read({ where: { id: orderId } }),
      this.repositories.orderItems().list({ orderId, page: 1, perPage: MAX_ORDER_ITEMS_PER_PAGE }),
      this.repositories.transactions().read({ where: { customer_package_id: customerPackageId } }),
    ])
    const pkg = packages.find((row) => row.id === customerPackageId)
    const order = orders.find((row) => row.id === orderId)
    if (!pkg) throw ApiError.notFound('Customer package not found')
    if (!order) throw ApiError.notFound('Order not found')
    if (order.status === 'CANCELLED') throw ApiError.validation('Cancelled orders cannot use package credits')
    const plan = (await this.repositories.catalog().read())
      .find((row) => row.package_code === pkg.package_code)
    if (pkg.customer_id !== order.customer_id) throw ApiError.validation('Package and order must belong to the same customer')
    if (!plan || plan.eligible_service !== order.service_type) throw ApiError.validation('Package eligible service does not match order service type')
    const start = normalizeSheetDate(pkg.start_date)
    const end = normalizeSheetDate(pkg.expiry_date)
    const received = normalizeSheetDate(order.received_date)
    if (!start || !end || !received || received < start || received > end) {
      throw ApiError.validation('Order received date is outside this package month')
    }
    const [items, prices] = await Promise.all([this.repositories.items().read(), this.repositories.prices().read()])
    const today = bangkokToday()
    const lines = orderItems.items.filter((row) => row.orderId === orderId).map((row) => {
      const item = items.find((candidate) => candidate.id === row.itemId)
      const rate = item && prices.filter((price) => price.item_code === item.item_code
        && price.service_type === order.service_type && price.price_group === 'CREDIT'
        && price.active === true && (normalizeSheetDate(price.effective_from) ?? '') <= today
        && (!price.effective_to || (normalizeSheetDate(price.effective_to) ?? '') >= today))
        .sort((a, b) => (normalizeSheetDate(b.effective_from) ?? '').localeCompare(normalizeSheetDate(a.effective_from) ?? ''))[0]
      const quantity = toNumber(row.quantity)
      return {
        sourceItemId: row.orderItemId, itemId: row.itemId ?? null,
        description: row.description ?? item?.display_name_th ?? null,
        quantity, unit: rate?.unit ?? null,
        creditsPerUnit: rate ? toNumber(rate.price) : null,
        credits: rate ? quantity * toNumber(rate.price) : null,
        noRateReason: rate ? null : !row.itemId ? 'Order item has no item ID' : !item ? 'Item not found' : 'No active CREDIT rate for this service today',
      }
    })
    const ledgerRows = transactions.filter((row) => row.customer_package_id === customerPackageId)
    return {
      customerId: pkg.customer_id, customerPackageId, orderId, balance: buildLedger(ledgerRows).remainingCredit,
      totalCredits: lines.reduce((sum, line) => sum + (line.credits ?? 0), 0),
      alreadyUsed: ledgerRows.some((row) => row.type === 'USAGE'
        && (row.reference_source === 'Orders' || row.reference_source === 'ORDER') && row.reference_id === orderId),
      items: lines,
    }
  }

  async confirm(input: unknown) {
    const request = parseOrThrow(orderCreditUsageRequestSchema, input)
    const preview = await this.calculate(request.customerPackageId, request.orderId)
    if (preview.alreadyUsed) throw ApiError.conflict('This package already has USAGE for this order; correct it with an ADJUSTMENT referencing the original USAGE')
    if (request.manualCredits !== undefined && !preview.items.some((item) => item.noRateReason)) {
      throw ApiError.validation('Manual credits require an order item without a CREDIT rate')
    }
    const credits = request.manualCredits ?? preview.totalCredits
    if (credits <= 0) throw ApiError.validation('Order has no positive credit usage')
    const row = await this.repositories.transactions().append({
      id: generateShortId(), customer_package_id: request.customerPackageId,
      customer_id: preview.customerId,
      type: 'USAGE', credit_change: -credits,
      reference_source: request.manualCredits === undefined ? 'Orders' : 'ORDER', reference_id: request.orderId,
      notes: request.manualCredits === undefined ? null : 'manual credits', created_by: request.createdBy,
    })
    return { transactionId: row.id, creditChange: -credits }
  }
}

export const orderCreditUsageService = new OrderCreditUsageService()
