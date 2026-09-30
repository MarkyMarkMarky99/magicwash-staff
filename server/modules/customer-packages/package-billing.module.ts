import { ApiHandler } from '../../shared/http/api-handler.js'
import { ok } from '../../shared/http/response.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { packageBillingService } from './package-billing.service.js'

export const packageBillingRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    GET: async (req) => ok(await packageBillingService.preview(String(req.query.customerPackageId ?? ''))),
    POST: async (req) => ({ status: 201, body: await packageBillingService.settleOverage(req.body) }),
  }),
}
