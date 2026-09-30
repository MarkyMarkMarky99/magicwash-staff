import { z } from 'zod'
import { OVERAGE_THB_PER_CREDIT, overageAmount } from '../../../shared/utils/package-credit.js'
import { bangkokToday, normalizeSheetDate, toNumber } from '../../../shared/utils/bangkok-datetime.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { getCustomerPackagesRepository } from '../../sheets/CustomerPackages/CustomerPackages.repository.js'
import { getPackagesRepository } from '../../sheets/Packages/Packages.repository.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { MAX_ORDER_ITEMS_PER_PAGE } from '../../../contracts/order-items/order-item-api.schema.js'
import { orderItemService } from '../order-items/order-item.module.js'
import { getItemsRepository } from '../../sheets/Items/Items.repository.js'
import { getPriceListRepository } from '../../sheets/PriceList/PriceList.repository.js'
import { getPackageTransactionsRepository } from '../../sheets/PackageTransactions/PackageTransactions.repository.js'
import { getInvoiceItemsRepository } from '../../sheets/InvoiceItems/InvoiceItems.repository.js'
import { getInvoicesRepository } from '../../sheets/Invoices/Invoices.repository.js'
import { buildLedger } from './customer-package-assembly.js'
import { generateShortId } from '../../shared/utils/id.js'

const settleInput = z.object({ customerPackageId: z.string().min(1), invoiceNumber: z.string().min(1), createdBy: z.string().min(1) }).strict()

export class PackageBillingService {
  constructor(private readonly repositories = {
    packages: getCustomerPackagesRepository, plans: getPackagesRepository,
    orders: getOrderFormRepository, orderItems: () => orderItemService,
    items: getItemsRepository, prices: getPriceListRepository,
    transactions: getPackageTransactionsRepository, invoiceItems: getInvoiceItemsRepository,
    invoices: getInvoicesRepository,
  }) {}
  async preview(customerPackageId: string) {
    if (!customerPackageId.trim()) throw ApiError.badRequest('Customer package id is required')
    const pkg = (await this.repositories.packages().read({ where: { id: customerPackageId } }))
      .find((row) => row.id === customerPackageId)
    if (!pkg) throw ApiError.notFound('Customer package not found')
    const [plans, orders, transactions] = await Promise.all([
      this.repositories.plans().read(),
      this.repositories.orders().read({ where: { customer_id: pkg.customer_id } }),
      this.repositories.transactions().read({ where: { customer_package_id: customerPackageId } }),
    ])
    const plan = plans.find((row) => row.package_code === pkg.package_code)
    if (!plan) throw ApiError.validation('Package catalog entry not found')
    const start = normalizeSheetDate(pkg.start_date)
    const end = normalizeSheetDate(pkg.expiry_date)
    if (!start || !end) throw ApiError.validation('Package needs start and expiry dates')
    const packageTransactions = transactions.filter((row) => row.customer_package_id === customerPackageId)
    const ledger = buildLedger(packageTransactions)
    const usedCredit = ledger.usedCredit
    const carriedIn = packageTransactions.filter((row) => row.type === 'TRANSFER' && toNumber(row.credit_change) > 0).reduce((sum, row) => sum + toNumber(row.credit_change), 0)
    const carriedOut = -packageTransactions.filter((row) => row.type === 'TRANSFER' && toNumber(row.credit_change) < 0).reduce((sum, row) => sum + toNumber(row.credit_change), 0) || 0
    const overage = Math.max(0, -ledger.remainingCredit)
    const today = bangkokToday()
    const eligibleOrders = orders.filter((order) => order.customer_id === pkg.customer_id
      && order.status !== 'CANCELLED'
      && (normalizeSheetDate(order.received_date) ?? '') >= start && (normalizeSheetDate(order.received_date) ?? '') <= end)
    const coveredByManualUsage = eligibleOrders.flatMap((order) => {
      const usage = packageTransactions.filter((row) => row.type === 'USAGE' && row.reference_source === 'ORDER' && row.reference_id === order.id)
      return usage.length ? [{ orderId: order.id!, credits: -usage.reduce((sum, row) => sum + toNumber(row.credit_change), 0) }] : []
    })
    const manualUsageOrders = new Set(coveredByManualUsage.map((row) => row.orderId))
    const orderIds = eligibleOrders.map((order) => order.id).filter((id): id is string => !!id)
    const [orderItemResults, items, prices, invoiceItemResults, feeMarkers, overageMarkers, invoices] = await Promise.all([
      Promise.all(orderIds.map((orderId) => this.repositories.orderItems().list({ orderId, page: 1, perPage: MAX_ORDER_ITEMS_PER_PAGE }))),
      this.repositories.items().read(), this.repositories.prices().read(),
      Promise.all(orderIds.map((source_order_id) => this.repositories.invoiceItems().read({ where: { source_order_id } }))),
      this.repositories.invoiceItems().read({ where: { sku: `PKG-FEE:${customerPackageId}` } }),
      this.repositories.invoiceItems().read({ where: { sku: `PKG-OVERAGE:${customerPackageId}` } }),
      this.repositories.invoices().read(),
    ])
    const orderItems = orderItemResults.flatMap((result) => result.items)
    const invoiceItems = invoiceItemResults.flat()
    const activeInvoices = new Set(invoices.filter((row) => row.status !== 'VOID' && row.status !== 'CANCELLED').map((row) => row.invoice_number))
    const billedItems = new Set(invoiceItems.filter((row) => activeInvoices.has(row.invoice_number)).map((row) => row.source_item_id))
    const alreadyInvoicedOrders = eligibleOrders.flatMap((order) => {
      const invoiceNumber = invoiceItems.find((row) => row.source_order_id === order.id && !row.source_item_id
        && activeInvoices.has(row.invoice_number) && !invoiceItems.some((other) => other.source_order_id === order.id
          && other.invoice_number === row.invoice_number && !!other.source_item_id))?.invoice_number
      return invoiceNumber ? [{ orderId: order.id!, invoiceNumber }] : []
    })
    const legacyBilledOrders = new Set(alreadyInvoicedOrders.map((row) => row.orderId))
    const feeInvoiceId = String(pkg.invoice_id ?? '').trim() || null
    const activeFeeMarker = feeMarkers.find((row) => activeInvoices.has(row.invoice_number))
    const linkedFeeInvoice = invoices.find((row) => row.invoice_number === feeInvoiceId)
    const feeInvoiceNumber = (feeInvoiceId && linkedFeeInvoice && linkedFeeInvoice.status !== 'VOID' && linkedFeeInvoice.status !== 'CANCELLED'
      ? feeInvoiceId : activeFeeMarker?.invoice_number) ?? null
    const feeAlreadyInvoiced = feeInvoiceNumber !== null
    const pendingOverageLine = overageMarkers.find((row) => activeInvoices.has(row.invoice_number)
      && !packageTransactions.some((transaction) => transaction.type === 'ADJUSTMENT' && transaction.reference_source === 'Invoices'))
    const overageAlreadyInvoiced = overageMarkers.some((row) => activeInvoices.has(row.invoice_number))
    const unpricedItems: Array<{ sourceItemId: string; reason: string }> = []
    const creditTotals = new Map<string, number>()
    const cashLines = eligibleOrders.filter((order) => !legacyBilledOrders.has(order.id!) && !manualUsageOrders.has(order.id!)).flatMap((order) => orderItems.filter((row) => row.orderId === order.id && !billedItems.has(row.orderItemId)).flatMap((row) => {
      const item = items.find((candidate) => candidate.id === row.itemId)
      if (!item) { unpricedItems.push({ sourceItemId: row.orderItemId, reason: 'Item master record unavailable' }); return [] }
      const activePrices = prices.filter((price) => price.item_code === item.item_code && price.service_type === order.service_type
        && price.active === true && (normalizeSheetDate(price.effective_from) ?? '') <= today
        && (!price.effective_to || (normalizeSheetDate(price.effective_to) ?? '') >= today))
      const creditRate = activePrices.filter((price) => price.price_group === 'CREDIT')
        .sort((a, b) => (normalizeSheetDate(b.effective_from) ?? '').localeCompare(normalizeSheetDate(a.effective_from) ?? ''))[0]
      if (creditRate) {
        creditTotals.set(order.id!, (creditTotals.get(order.id!) ?? 0) + toNumber(creditRate.price) * toNumber(row.quantity))
        return []
      }
      const regular = activePrices.filter((price) => price.price_group === 'DEFAULT')
        .sort((a, b) => (normalizeSheetDate(b.effective_from) ?? '').localeCompare(normalizeSheetDate(a.effective_from) ?? ''))[0]
      if (!regular) { unpricedItems.push({ sourceItemId: row.orderItemId, reason: 'No active DEFAULT price' }); return [] }
      return [{ description: row.description || item.display_name_th, quantity: toNumber(row.quantity), unit: regular.unit || 'piece',
        unitPrice: toNumber(regular.price), sourceOrderId: order.id!, sourceItemId: row.orderItemId, serviceType: order.service_type! }]
    }))
    const creditOrdersWithoutUsage = [...creditTotals].filter(([orderId]) => !packageTransactions.some((row) => row.type === 'USAGE'
      && (row.reference_source === 'Orders' || row.reference_source === 'ORDER') && row.reference_id === orderId))
      .map(([orderId, totalCredits]) => ({ orderId, totalCredits }))
    return {
      customerId: pkg.customer_id, billingPeriodStart: start, billingPeriodEnd: end,
      allowance: toNumber(plan.included_credit), usedCredit, carriedIn, carriedOut,
      balance: ledger.remainingCredit, overage,
      feeAlreadyInvoiced, feeInvoiceNumber,
      feeLine: feeAlreadyInvoiced ? null : { description: `${plan.name} (${plan.package_code})`, quantity: 1, unit: 'package', unitPrice: toNumber(plan.price), packageFeeId: customerPackageId },
      overageLine: overage > 0 && !overageAlreadyInvoiced ? { description: `ใช้เกิน ${overage} เครดิต × ${OVERAGE_THB_PER_CREDIT}`, quantity: 1, unit: 'package', unitPrice: overageAmount(overage), packageOverageId: customerPackageId } : null,
      pendingOverage: pendingOverageLine ? { invoiceNumber: pendingOverageLine.invoice_number, credits: toNumber(pendingOverageLine.unit_price) / OVERAGE_THB_PER_CREDIT } : null,
      cashLines, unpricedItems, creditOrdersWithoutUsage, alreadyInvoicedOrders, coveredByManualUsage,
    }
  }

  async settleOverage(input: unknown) {
    const { customerPackageId, invoiceNumber, createdBy } = parseOrThrow(settleInput, input)
    const [packages, transactions, invoiceItems, invoices] = await Promise.all([
      this.repositories.packages().read({ where: { id: customerPackageId } }),
      this.repositories.transactions().read({ where: { customer_package_id: customerPackageId } }),
      this.repositories.invoiceItems().read({ where: { invoice_number: invoiceNumber } }),
      this.repositories.invoices().read(),
    ])
    const pkg = packages.find((row) => row.id === customerPackageId)
    const invoice = invoices.find((row) => row.invoice_number === invoiceNumber && row.customer_id === pkg?.customer_id && row.status !== 'VOID' && row.status !== 'CANCELLED')
    if (!pkg || !invoice) throw ApiError.validation('Invoice and package must belong to the same customer')
    if (transactions.some((row) => row.customer_package_id === customerPackageId && row.type === 'ADJUSTMENT' && row.reference_source === 'Invoices')) throw ApiError.conflict('Overage adjustment already recorded for this package')
    const line = invoiceItems.find((row) => row.invoice_number === invoiceNumber && row.sku === `PKG-OVERAGE:${customerPackageId}`)
    if (!line) throw ApiError.validation('Invoice has no overage line for this package')
    const credits = Math.max(0, -buildLedger(transactions.filter((row) => row.customer_package_id === customerPackageId)).remainingCredit)
    if (credits <= 0 || toNumber(line.quantity) !== 1 || toNumber(line.unit_price) !== overageAmount(credits)) {
      throw ApiError.validation('Overage line must equal the current negative balance times the credit rate')
    }
    const row = await this.repositories.transactions().append({ id: generateShortId(), customer_package_id: customerPackageId,
      customer_id: pkg.customer_id, type: 'ADJUSTMENT', credit_change: credits,
      reference_source: 'Invoices', reference_id: invoiceNumber, notes: 'Overage billed', created_by: createdBy })
    return { transactionId: row.id, creditChange: credits }
  }
}

export const packageBillingService = new PackageBillingService()
