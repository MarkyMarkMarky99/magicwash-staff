import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { WorkTransactionService } from './work-transaction.service.js'

export function createWorkTransactionRoutes(service: WorkTransactionService): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({
      GET: async (req) => ok(await service.list(req.query)),
    }),
  }
}

export const workTransactionRoutes = createWorkTransactionRoutes(new WorkTransactionService())
