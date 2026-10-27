import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler, type ApiHandlerRequest } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { created, ok } from '../../shared/http/response.js'
import { AttendanceService } from './attendance.service.js'

function actor(req: ApiHandlerRequest) {
  if (!req.staff) throw ApiError.unauthorized()
  return req.staff
}

export function createAttendanceRoutes(service: AttendanceService): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({
      GET: async (req) => { actor(req); return ok(await service.list(req.query)) },
      POST: async (req) => created(await service.create(req.body, actor(req))),
    }),
    item: new ApiHandler({
      POST: async (req) => {
        if (req.params.id !== 'day-off') throw ApiError.notFound('Route not found')
        return created(await service.bookDayOff(req.body, actor(req)))
      },
      PATCH: async (req) => ok(await service.update(req.params.id, req.body, actor(req))),
      DELETE: async (req) => ok(await service.cancel(req.params.id, actor(req))),
    }),
  }
}

export const attendanceRoutes = createAttendanceRoutes(new AttendanceService())
