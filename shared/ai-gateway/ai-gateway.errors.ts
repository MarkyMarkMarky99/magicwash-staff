import type { z } from 'zod'
import type { aiGatewayErrorCodeSchema } from '../../contracts/ai-gateway/ai-gateway-api.schema.js'

type AiGatewayErrorCode = z.infer<typeof aiGatewayErrorCodeSchema>
  | 'NETWORK' | 'CLIENT_TIMEOUT' | 'ABORTED' | 'INVALID_RESPONSE' | 'NOT_CONFIGURED'

export class AiGatewayError extends Error {
  constructor(public readonly code: AiGatewayErrorCode, message: string, public readonly status: number = 0) {
    super(message)
    this.name = 'AiGatewayError'
  }
}
