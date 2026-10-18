import { ApiHandler } from '../../shared/http/api-handler.js'
import { ApiError } from '../../shared/http/api-error.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { findStaffByCardCode } from '../../shared/auth/staff-list.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { authMeResponseSchema, authCardResponseSchema, authCardQuerySchema } from '../../../contracts/auth/auth-api.schema.js'

export const authRoutes: GatewayModuleRoutes = {
  collection: new ApiHandler({}),
  item: new ApiHandler({
    GET: async (req) => {
      if (!req.staff) throw ApiError.unauthorized()
      if (req.params.id === 'card') {
        if (req.staff.role !== 'device' && req.staff.role !== 'admin') throw ApiError.forbidden()
        const { code } = parseOrThrow(authCardQuerySchema, req.query)
        const staff = await findStaffByCardCode(code)
        if (!staff) throw ApiError.notFound('Card not found')
        return ok(authCardResponseSchema.parse(staff))
      }
      if (req.params.id !== 'me') throw ApiError.notFound('Route not found')
      return ok(authMeResponseSchema.parse(req.staff))
    },
  }),
}
