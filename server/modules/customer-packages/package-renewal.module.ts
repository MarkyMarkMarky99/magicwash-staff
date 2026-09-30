import { ApiHandler } from '../../shared/http/api-handler.js'
import { ok } from '../../shared/http/response.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { packageRenewalService } from './package-renewal.service.js'

export const packageRenewalRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({
    GET: async (req) => ok(await packageRenewalService.status(String(req.query.oldPackageId ?? ''))),
    POST: async (req) => ({ status: 201, body: await packageRenewalService.transfer(req.body) }),
  }),
}
