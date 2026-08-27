import { z } from 'zod'
import { customerPackageApiContract } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import {
  BaseCrudService,
  type JsonColumnMap,
} from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { ApiError } from '../../shared/http/api-error.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok, okPaged, type ApiResult } from '../../shared/http/response.js'
import { getCustomerPackageViewRepository } from '../../sheets/CustomerPackageView/CustomerPackageView.repository.js'
import { customerPackageViewRowSchema } from '../../sheets/CustomerPackageView/CustomerPackageView.db-contract.js'
import type { createCustomerPackageResponseSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { customerPackagePurchaseService } from './customer-package-purchase.service.js'

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
type CustomerPackageListQuery = z.infer<typeof customerPackageApiContract.query.list>
type CustomerPackageListResponse = z.infer<
  typeof customerPackageApiContract.response.list
>
type CustomerPackageDetailResponse = z.infer<
  typeof customerPackageApiContract.response.detail
>
type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>

type CustomerPackageViewService = BaseCrudService<
  CustomerPackageViewApiRow,
  CustomerPackageListQuery,
  never,
  never,
  CustomerPackageListResponse,
  CustomerPackageDetailResponse,
  never,
  never,
  CustomerPackageViewDbRow,
  typeof customerPackageViewFieldMap
>

// GViz `contains` cannot search within the serialized transactions cell.
export const customerPackageViewService: CustomerPackageViewService = new BaseCrudService({
  repository: getCustomerPackageViewRepository,
  api: customerPackageApiContract,
  searchFields: ['customerPackageId', 'customerId', 'customerName', 'packageCode'],
  fieldMap: customerPackageViewFieldMap,
  jsonColumns: customerPackageViewJsonColumns,
})

function statusForCreateResponse(response: CreateCustomerPackageResponse): number {
  switch (response.kind) {
    case 'created': return 201
    case 'validation_error': return 422
    case 'catalog_read_failed': return 502
    case 'opening_transaction_write_failed': return 500
    case 'package_write_failed': return 500
  }
}

export const customerPackageRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    GET: async (req) => {
      const { items, pagination } = await customerPackageViewService.list(req.query)
      return okPaged(items, pagination)
    },
    POST: async (req): Promise<ApiResult<CreateCustomerPackageResponse>> => {
      const response = await customerPackagePurchaseService.create(req.body)
      return { status: statusForCreateResponse(response), body: response }
    },
  }),
  item: new ApiHandler({
    GET: async (req) => ok(await customerPackageViewService.getById(req.params.id)),
    PATCH: async () => { throw ApiError.notFound('Route not found') },
  }),
}
