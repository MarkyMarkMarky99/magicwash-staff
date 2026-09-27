import { ApiGateway } from '../server/shared/http/api-gateway.js'
import { routeRegistry } from '../server/api/route-registry.js'
import { authenticateStaff } from '../server/shared/auth/staff-auth.js'

const gateway = new ApiGateway(routeRegistry, authenticateStaff)

export default gateway.handle
