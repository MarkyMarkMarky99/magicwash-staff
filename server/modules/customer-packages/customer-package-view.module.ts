import { z } from 'zod'
import { customerPackageViewApiContract } from '../../../contracts/customer-packages/customer-package-view-api.schema.js'
import {
  BaseCrudService,
  type JsonColumnMap,
} from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getCustomerPackageViewRepository } from '../../sheets/CustomerPackageView/CustomerPackageView.repository.js'
import { customerPackageViewRowSchema } from '../../sheets/CustomerPackageView/CustomerPackageView.db-contract.js'

type CustomerPackageViewDbRow = z.infer<typeof customerPackageViewRowSchema>

/** DB column -> API/domain field. JSON columns retain their storage names
 * here; `customerPackageViewJsonColumns` declares their decoded fields below. */
export const customerPackageViewFieldMap = {
  customerPackageId: 'customerPackageId',
  customerId: 'customerId',
  customerName: 'customerName',
  customerPhone: 'customerPhone',
  customerAddress: 'customerAddress',
  packageCode: 'packageCode',
  packageName: 'packageName',
  packageEligibleService: 'packageEligibleService',
  startDate: 'startDate',
  expiryDate: 'expiryDate',
  status: 'status',
  serviceDay: 'serviceDay',
  timeSlot: 'timeSlot',
  invoiceId: 'invoiceId',
  notes: 'notes',
  remainingCredit: 'remainingCredit',
  usedCredit: 'usedCredit',
  totalCredit: 'totalCredit',
  transactionsJson: 'transactionsJson',
} as const satisfies Record<keyof CustomerPackageViewDbRow & string, string>

export const customerPackageViewJsonColumns = {
  transactionsJson: { field: 'transactions', kind: 'array' },
} as const satisfies JsonColumnMap

type CustomerPackageViewApiRow = ApiRowFromFieldMap<
  CustomerPackageViewDbRow,
  typeof customerPackageViewFieldMap
>
type CustomerPackageListQuery = z.infer<typeof customerPackageViewApiContract.query.list>
type CustomerPackageCreate = z.infer<typeof customerPackageViewApiContract.request.create>
type CustomerPackageUpdate = z.infer<typeof customerPackageViewApiContract.request.update>
type CustomerPackageListResponse = z.infer<
  typeof customerPackageViewApiContract.response.list
>
type CustomerPackageDetailResponse = z.infer<
  typeof customerPackageViewApiContract.response.detail
>
type CustomerPackageCreateResponse = z.infer<
  typeof customerPackageViewApiContract.response.create
>
type CustomerPackageUpdateResponse = z.infer<
  typeof customerPackageViewApiContract.response.update
>

type CustomerPackageViewService = BaseCrudService<
  CustomerPackageViewApiRow,
  CustomerPackageListQuery,
  CustomerPackageCreate,
  CustomerPackageUpdate,
  CustomerPackageListResponse,
  CustomerPackageDetailResponse,
  CustomerPackageCreateResponse,
  CustomerPackageUpdateResponse,
  CustomerPackageViewDbRow,
  typeof customerPackageViewFieldMap
>

// List + detail, no writes. searchFields are flat columns only — GViz `contains`
// cannot reach inside the serialized transactions cell.
export const customerPackageViewService: CustomerPackageViewService = new BaseCrudService({
  repository: getCustomerPackageViewRepository,
  api: customerPackageViewApiContract,
  searchFields: ['customerPackageId', 'customerId', 'customerName', 'packageCode'],
  fieldMap: customerPackageViewFieldMap,
  jsonColumns: customerPackageViewJsonColumns,
})

export const customerPackageRoutes = createCrudRoutes(
  customerPackageViewService,
  customerPackageViewApiContract,
)
