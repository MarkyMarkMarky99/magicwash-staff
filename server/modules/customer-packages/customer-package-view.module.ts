import { customerPackageViewContract } from './customer-package-view.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getCustomerPackageViewRepository } from './customer-package-view.repository.js'

// List + detail, no writes. searchFields are flat columns only — GViz `contains`
// cannot reach inside the serialized transactions cell.
export const customerPackageViewService = new BaseCrudService({
  repository: getCustomerPackageViewRepository(),
  api: customerPackageViewContract.api,
  searchFields: ['customerPackageId', 'customerId', 'customerName', 'packageCode'],
})

export const customerPackageRoutes = createCrudRoutes(
  customerPackageViewService,
  customerPackageViewContract.api,
)
