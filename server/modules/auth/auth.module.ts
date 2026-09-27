import { ApiHandler } from '../../shared/http/api-handler.js'
import { ApiError } from '../../shared/http/api-error.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { authMeResponseSchema } from '../../../contracts/auth/auth-api.schema.js'

export const authRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({}),
  item: new ApiHandler({
    GET: (req) => {
      if (req.params.id !== 'me') throw ApiError.notFound('Route not found')
      if (!req.staff) throw ApiError.unauthorized()
      return ok(authMeResponseSchema.parse(req.staff))
    },
  }),
}
