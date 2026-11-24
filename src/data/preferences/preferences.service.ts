import { getStaffPreferences, updateStaffPreferences, type PreferredLanguage } from '@shared/ai-gateway/tasks/preferences'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'

export type { StaffPreferences, PreferredLanguage } from '@shared/ai-gateway/tasks/preferences'
const access = () => ({ baseUrl: aiGatewayBaseUrl() ?? '', getToken: aiGatewayToken })
export const fetchPreferences = (staffId: string) => getStaffPreferences(access(), staffId)
export const updatePreferences = (staffId: string, language: PreferredLanguage) => updateStaffPreferences(access(), staffId, language)
