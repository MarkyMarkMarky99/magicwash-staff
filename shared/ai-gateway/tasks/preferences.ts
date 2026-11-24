import type { z } from 'zod'
import { callAiGatewayEndpoint } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'
import type { TeamAgentGatewayAccess } from './team-agent.js'

import { preferredLanguageSchema, staffPreferencesSchema } from '../../../contracts/ai-gateway/preferences-api.schema.js'
export { preferredLanguageSchema, staffPreferencesSchema } from '../../../contracts/ai-gateway/preferences-api.schema.js'
export type StaffPreferences = z.infer<typeof staffPreferencesSchema>
export type PreferredLanguage = z.infer<typeof preferredLanguageSchema>

async function preferences(access: TeamAgentGatewayAccess, staffId: string, language?: PreferredLanguage): Promise<StaffPreferences> {
  if (!staffPreferencesSchema.shape.staffId.safeParse(staffId).success || (language !== undefined && !preferredLanguageSchema.safeParse(language).success)) throw new AiGatewayError('INVALID_INPUT', 'Invalid preferences')
  const data = await callAiGatewayEndpoint({ ...access, method: language === undefined ? 'GET' : 'POST',
    path: language === undefined ? `/preferences?${new URLSearchParams({ staffId })}` : '/preferences',
    ...(language === undefined ? {} : { body: { staffId, language } }),
  })
  const parsed = staffPreferencesSchema.safeParse(data)
  if (!parsed.success || parsed.data.staffId !== staffId) throw new AiGatewayError('INVALID_RESPONSE', 'Invalid preferences response')
  return parsed.data
}
export function getStaffPreferences(access: TeamAgentGatewayAccess, staffId: string) { return preferences(access, staffId) }
export function updateStaffPreferences(access: TeamAgentGatewayAccess, staffId: string, language: PreferredLanguage) { return preferences(access, staffId, language) }
