import type { z } from 'zod'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import type { ApiResult } from '../../shared/http/response.js'
import type { appendPackageTransactionResponseSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { packageTransactionService } from './package-transaction.service.js'

type AppendPackageTransactionResponse = z.infer<typeof appendPackageTransactionResponseSchema>

function statusForAppendResponse(response: AppendPackageTransactionResponse): number {
  switch (response.kind) {
    case 'created': return 201
    case 'validation_error': return 422
    case 'package_not_found': return 422
    case 'package_lookup_failed': return 502
    case 'transaction_write_failed': return 500
  }
}

export const packageTransactionRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    POST: async (req): Promise<ApiResult<AppendPackageTransactionResponse>> => {
      const response = await packageTransactionService.append(req.body)
      return { status: statusForAppendResponse(response), body: response }
    },
  }),
}
