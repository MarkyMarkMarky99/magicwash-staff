import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler, type ApiHandlerRequest } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { created, ok } from '../../shared/http/response.js'
import { createStaffService, type StaffService } from './staff.service.js'

function requireIdentity(req: ApiHandlerRequest): string {
  if (!req.email) throw ApiError.unauthorized()
  return req.email
}

function requireAdmin(req: ApiHandlerRequest): string {
  const email = requireIdentity(req)
  if (req.staff?.role !== 'admin') throw ApiError.forbidden()
  return email
}

export function createStaffRoutes(service: StaffService): GatewayModuleRoutes {
  return {
    nestedItem: {
      path: 'secretary',
      handler: new ApiHandler({
        GET: async (req) => {
          requireAdmin(req)
          return ok(await service.getSecretary(req.params.id!))
        },
        PATCH: async (req) => {
          requireAdmin(req)
          return ok(await service.updateSecretary(req.params.id!, req.body))
        },
      }),
    },
    collection: new ApiHandler({
      GET: async (req) => {
        if (!req.staff) throw ApiError.unauthorized()
        return ok(await service.list())
      },
      POST: async (req) => created(await service.register(requireIdentity(req), req.body)),
    }),
    item: new ApiHandler({
      GET: async (req) => {
        if (req.params.id === 'directory') {
          if (!req.staff) throw ApiError.unauthorized()
          const directory = await service.listDirectory()
          // The literal AI directory feeds the legacy assignment recipient list.
          return ok(req.staff.staffId.trim().toUpperCase() === 'AI'
            ? directory.filter((row) => row.role !== 'assistant')
            : directory)
        }
        if (req.params.id === 'me') return ok(await service.me(requireIdentity(req)))
        requireAdmin(req)
        return ok(await service.getById(req.params.id!))
      },
      PATCH: async (req) => {
        const email = requireAdmin(req)
        if (req.params.id === 'directory') throw ApiError.notFound('Route not found')
        return ok(await service.update(req.params.id!, email, req.body))
      },
    }),
  }
}

export const staffRoutes = createStaffRoutes(createStaffService())
