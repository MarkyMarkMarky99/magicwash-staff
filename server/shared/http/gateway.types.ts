import type { ApiHandler } from './api-handler.js'

export interface GatewayModuleRoutes {
  collection: ApiHandler
  item?: ApiHandler
  nestedItem?: { path: string; handler: ApiHandler }
}

export type RouteLoader = () => Promise<GatewayModuleRoutes>
