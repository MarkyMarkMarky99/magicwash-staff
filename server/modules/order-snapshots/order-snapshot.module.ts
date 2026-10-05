import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok } from '../../shared/http/response.js'
import { OrderSnapshotService } from './order-snapshot.service.js'

export function createOrderSnapshotRoutes(service: OrderSnapshotService): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({
      GET: async () => ok(await service.get()),
    }),
  }
}

export const orderSnapshotRoutes = createOrderSnapshotRoutes(new OrderSnapshotService())
