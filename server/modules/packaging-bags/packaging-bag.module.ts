import { bodyWithSessionActor } from '../../shared/http/session-actor.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { withStockTakeFreezeGuard } from '../../shared/services/stock-take-freeze.js'
import { PackagingBagService } from './packaging-bag.service.js'

export const packagingBagService = new PackagingBagService()
export const packagingBagRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({}),
  item: new ApiHandler({
    POST: async request => {
      if (request.params.id !== 'confirm') throw ApiError.notFound('Route not found')
      const payload = bodyWithSessionActor(request, 'createdBy')
      return ok(await withStockTakeFreezeGuard(() => packagingBagService.confirm(payload)))
    },
  }),
}
