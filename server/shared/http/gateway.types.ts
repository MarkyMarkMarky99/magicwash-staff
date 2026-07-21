import type { ApiHandler } from './api-handler.js'

export interface GatewayModuleRoutes {
  collection: ApiHandler
  item?: ApiHandler
}

export type RouteLoader = () => Promise<GatewayModuleRoutes>
