import { portalInvoicesApi, portalOrdersApi } from '../../../contracts/portal/portal-api.schema.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { getInvoicesRepository } from '../../sheets/Invoices/Invoices.repository.js'
import { getInvoiceItemsRepository } from '../../sheets/InvoiceItems/InvoiceItems.repository.js'
import { getPaymentsRepository } from '../../sheets/Payments/Payments.repository.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { assemblePortalInvoices, assemblePortalOrders, type SourceRow } from './portal.mapper.js'

type Reader = { read(): Promise<SourceRow[]> }

export class PortalService {
  constructor(private readonly sources = {
    orders: (): Reader => ({ read: () => getOrderFormRepository().readSourceRows() }),
    orderItems: (): Reader => ({ read: () => getOrderItemFormsRepository().readSourceRows() }),
    invoices: (): Reader => ({ read: () => getInvoicesRepository().readSourceRows() }),
    invoiceItems: (): Reader => ({ read: () => getInvoiceItemsRepository().readSourceRows() }),
    payments: (): Reader => ({ read: () => getPaymentsRepository().readSourceRows() }),
  }, private readonly now = () => new Date()) {}

  async orders(input: unknown) {
    const query = parseOrThrow(portalOrdersApi.query.list, input)
    const [orders, items] = await Promise.all([this.sources.orders().read(), this.sources.orderItems().read()])
    return assemblePortalOrders(orders, items, this.now()).filter((row) =>
      (query.customerId === undefined || row.customerId === query.customerId)
      && (query.orderId === undefined || row.orderId === query.orderId))
  }

  async invoices(input: unknown) {
    const query = parseOrThrow(portalInvoicesApi.query.list, input)
    const [invoices, items, payments] = await Promise.all([
      this.sources.invoices().read(), this.sources.invoiceItems().read(), this.sources.payments().read(),
    ])
    return assemblePortalInvoices(invoices, items, payments, this.now()).filter((row) =>
      (query.customerId === undefined || row.customerId === query.customerId)
      && (query.invoiceNumber === undefined || row.invoiceNumber === query.invoiceNumber))
  }
}
