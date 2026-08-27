import type { z } from 'zod'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { ApiError } from '../../shared/http/api-error.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok, okPaged, type ApiResult } from '../../shared/http/response.js'
import type { createCustomerPackageResponseSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { customerPackagePurchaseService } from './customer-package-purchase.service.js'
type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>
import { customerPackageReadService } from './customer-package-read.service.js'

export { customerPackageReadService } from './customer-package-read.service.js'

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
      const { items, pagination } = await customerPackageReadService.list(req.query)
      return okPaged(items, pagination)
    },
    POST: async (req): Promise<ApiResult<CreateCustomerPackageResponse>> => {
      const response = await customerPackagePurchaseService.create(req.body)
      return { status: statusForCreateResponse(response), body: response }
    },
  }),
  item: new ApiHandler({
    GET: async (req) => ok(await customerPackageReadService.getById(req.params.id)),
    PATCH: async () => { throw ApiError.notFound('Route not found') },
  }),
}
