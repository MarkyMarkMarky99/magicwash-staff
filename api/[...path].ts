import { ApiGateway } from '../server/shared/http/api-gateway.js'
import { routeRegistry } from '../server/api/route-registry.js'

const gateway = new ApiGateway(routeRegistry)

export default gateway.handle
