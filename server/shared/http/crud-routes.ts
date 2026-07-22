import type { ModuleApiContract } from '../../../contracts/shared/module-api-contract.js'
import type { BaseCrudService } from '../services/base-crud.service.js'
import { ApiHandler } from './api-handler.js'
import type { GatewayModuleRoutes } from './gateway.types.js'
import { created, ok, okPaged } from './response.js'

// `service`'s own contract-derived generics are private, so the factory can't read
// capability off the instance directly — the caller passes the same `<m>.contract.ts`
// `api` bundle that built the service. All 8 generics are erased to `any` on purpose:
// leaving any of them at their class defaults resolves to `never` on the conditional
// getById/create/update parameter types, making every call site a compile error even
// after the runtime capability check below.
type AnyCrudService = BaseCrudService<any, any, any, any, any, any, any, any>

/** Builds the collection/item routes every module needs, driven by its API contract's capability slots. */
export function createCrudRoutes(service: AnyCrudService, api: ModuleApiContract): GatewayModuleRoutes {
  const canCreate = api.request?.create !== undefined && api.response.create !== undefined
  const canGetById = api.response.detail !== undefined
  const canUpdate = api.request?.update !== undefined && api.response.update !== undefined

  const collection = new ApiHandler({
    GET: async (req) => {
      const { items, pagination } = await service.list(req.query)
      return okPaged(items, pagination)
    },
    ...(canCreate ? { POST: async (req) => created(await service.create(req.body)) } : {}),
  })

  const item =
    canGetById || canUpdate
      ? new ApiHandler({
          ...(canGetById ? { GET: async (req) => ok(await service.getById(req.params.id)) } : {}),
          ...(canUpdate
            ? { PATCH: async (req) => ok(await service.update(req.params.id, req.body)) }
            : {}),
        })
      : undefined

  return { collection, item }
}
