import { customerContract } from './customer.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getCustomerRepository } from './customer.repository.js'

// ── API behavior: BaseCrudService validates the request, builds the read query
//    (ReadQueryDTO.fromQuery with searchFields), calls the repository, and
//    projects each response by its schema shape. No hooks: phone is already
//    stored as text with its leading 0, so customers needs no read-time
//    normalization or other write-time business logic.
//
//    customerType defaults to null (no filter); fromQuery preserves it and the
//    GViz builder drops null/''/undefined where values, so no clause is built. ──
export const customerService = new BaseCrudService({
  repository: getCustomerRepository(),
  api: customerContract.api,
  searchFields: ['customerIndex', 'customerName', 'address'],
})

export const customerRoutes = createCrudRoutes(customerService, customerContract.api)
