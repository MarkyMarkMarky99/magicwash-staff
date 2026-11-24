import type { z } from 'zod'
import { secretarySettingsQuerySchema, secretarySettingsSchema, updateSecretarySettingsBodySchema } from '../../../contracts/ai-gateway/secretary-api.schema.js'
import { callAiGatewayEndpoint } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'
import type { TeamAgentGatewayAccess } from './team-agent.js'

export type SecretarySettings = z.infer<typeof secretarySettingsSchema>
export type UpdateSecretarySettingsInput = z.infer<typeof updateSecretarySettingsBodySchema>

async function settings(access: TeamAgentGatewayAccess, method: 'GET' | 'POST', staffId: string, body?: UpdateSecretarySettingsInput): Promise<SecretarySettings> {
  const data = await callAiGatewayEndpoint({ ...access, method, path: `/settings?${new URLSearchParams({ staffId })}`, body })
  const parsed = secretarySettingsSchema.safeParse(data)
  if (!parsed.success || parsed.data.staffId !== staffId) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned invalid secretary settings')
  return parsed.data
}

export function getSecretarySettings(access: TeamAgentGatewayAccess & { staffId: string }): Promise<SecretarySettings> {
  const query = secretarySettingsQuerySchema.safeParse({ staffId: access.staffId })
  if (!query.success) throw new AiGatewayError('INVALID_INPUT', 'A staff ID is required')
  return settings(access, 'GET', query.data.staffId)
}

export function putSecretarySettings(access: TeamAgentGatewayAccess & { staffId: string, body: UpdateSecretarySettingsInput }): Promise<SecretarySettings> {
  const query = secretarySettingsQuerySchema.safeParse({ staffId: access.staffId })
  const body = updateSecretarySettingsBodySchema.safeParse(access.body)
  if (!query.success || !body.success) throw new AiGatewayError('INVALID_INPUT', 'Invalid secretary settings')
  return settings(access, 'POST', query.data.staffId, body.data)
}
