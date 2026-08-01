import { invoiceViewContract } from './invoice-view.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getInvoiceViewRepository } from './invoice-view.repository.js'

export const invoiceViewService = new BaseCrudService({
  repository: getInvoiceViewRepository(),
  api: invoiceViewContract.api,
  // invoiceNumber/customerId are the only flat, searchable columns — the rest
  // of the row (customer, items, adjustments, payments) is serialized JSON.
  searchFields: ['invoiceNumber', 'customerId'],
})

export const invoiceViewRoutes = createCrudRoutes(invoiceViewService, invoiceViewContract.api)
