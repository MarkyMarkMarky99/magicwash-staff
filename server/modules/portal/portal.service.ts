import { portalCustomerIdSchema, portalInvoicesApi, portalOrdersApi } from '../../../contracts/portal/portal-api.schema.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { ApiError } from '../../shared/http/api-error.js'
import { assemblePortalInvoices, assemblePortalOrders, type SourceRow } from './portal.mapper.js'
import { portalSources, type PortalSources } from './portal-source-reader.js'
import { assemblePortalPackages } from './portal-package.mapper.js'
import { appointmentFields, customerFields, projectPortalProfile } from './portal-profile.mapper.js'

function selectRows(rows: SourceRow[], field: string, value: string | undefined) {
  return value === undefined ? rows : rows.filter((row) => row[field] !== '' && row[field] != null
    && (typeof row[field] === 'number' ? String(row[field]).replace('e', 'E') : String(row[field])) === value)
}

function relatedRows(rows: SourceRow[], field: string, parents: SourceRow[], parentField: string) {
  const keys = new Set(parents.map((row) => String(row[parentField] || '').trim()))
  return rows.filter((row) => keys.has(String(row[field] || '').trim()))
}

export class PortalService {
  constructor(private readonly sources: PortalSources = portalSources, private readonly now = () => new Date()) {}

  async orders(input: unknown) {
    const query = parseOrThrow(portalOrdersApi.query.list, input)
    const [allOrders, items] = await Promise.all([this.sources.orders().read(), this.sources.orderItems().read()])
    const orders = selectRows(selectRows(allOrders, 'customer_id', query.customerId), 'id', query.orderId)
    return assemblePortalOrders(orders, relatedRows(items, 'order_id', orders, 'id'), this.now())
  }

  async invoices(input: unknown) {
    const query = parseOrThrow(portalInvoicesApi.query.list, input)
    const [allInvoices, items, payments] = await Promise.all([
      this.sources.invoices().read(), this.sources.invoiceItems().read(), this.sources.payments().read(),
    ])
    const invoices = selectRows(selectRows(allInvoices, 'customer_id', query.customerId), 'invoice_number', query.invoiceNumber)
    return assemblePortalInvoices(invoices, relatedRows(items, 'invoice_number', invoices, 'invoice_number'),
      relatedRows(payments, 'invoice_number', invoices, 'invoice_number'), this.now())
  }

  async customer(input: unknown) {
    const customerId = parseOrThrow(portalCustomerIdSchema, input)
    const [customers, appointments, memberships, packages, transactions, orders, invoices] = await Promise.all([
      this.sources.customers().read(), this.sources.appointments().read(), this.sources.customerPackages().read(),
      this.sources.packages().read(), this.sources.packageTransactions().read(),
      this.orders({ customerId }), this.invoices({ customerId }),
    ])
    const customer = customers.find((row) => String(row.CustomerID ?? '') === customerId)
    if (!customer) throw ApiError.notFound('Customer not found')
    const customerPackages = selectRows(memberships, 'customer_id', customerId)
    return {
      customer: projectPortalProfile(customer, customerFields), orders, invoices,
      appointments: selectRows(appointments, 'CustomerID', customerId).map((row) => projectPortalProfile(row, appointmentFields)),
      packages: assemblePortalPackages(customerPackages, packages, customers,
        relatedRows(transactions, 'customer_package_id', customerPackages, 'id'), this.now()),
    }
  }
}
