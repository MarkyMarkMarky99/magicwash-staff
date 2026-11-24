import { fetchPreferences, updatePreferences } from '@/data/preferences/preferences.service'
import { getSecretarySettings, type UpdateSecretarySettingsInput } from '@shared/ai-gateway/tasks/secretary'
import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import {
  cancelPersonalAssignment,
  cancelTeamAgentReminder,
  getTeamAgentHistory,
  getTeamAgentImage,
  getTeamAgentNotes,
  getTeamAgentPushKey,
  listPersonalAssignments,
  listTeamAgentReminders,
  markTeamAgentRead,
  sendTeamAgentMessage,
  subscribeTeamAgentPush,
  unsubscribeTeamAgentPush,
  type TeamAgentAccess,
  type TeamAgentAssignmentStatus,
  type TeamAgentGatewayAccess,
  type TeamAgentId,
} from '@shared/ai-gateway/tasks/team-agent'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'

export type { SecretarySettings, UpdateSecretarySettingsInput } from '@shared/ai-gateway/tasks/secretary'

export type {
  TeamAgentAccepted,
  TeamAgentAssignment,
  TeamAgentAssignmentStatus,
  TeamAgentEvent,
  TeamAgentEventImage,
  TeamAgentId,
  TeamAgentNote,
  TeamAgentReminder,
} from '@shared/ai-gateway/tasks/team-agent'

function gatewayBaseUrl(): string {
  const baseUrl = aiGatewayBaseUrl()
  if (!baseUrl) throw new AiGatewayError('NOT_CONFIGURED', 'AI gateway is not configured')
  return baseUrl
}

const targetNames = new Map<string, string>()

/** Remember an admin target's display name; it is sent with that target's requests. */
export function setTargetName(staffId: string, name: string): void {
  if (name.trim()) targetNames.set(staffId, name.trim())
}

function agentBaseUrl(agentId: TeamAgentId): string {
  const baseUrl = gatewayBaseUrl()
  return agentId === 'secretary' ? `${baseUrl.replace(/\/+$/, '')}/secretary` : baseUrl
}

function access(agentId: TeamAgentId, staffId?: string): TeamAgentAccess {
  const staffName = staffId ? targetNames.get(staffId) : undefined
  return { agentId, baseUrl: agentBaseUrl(agentId), getToken: aiGatewayToken, ...(staffId ? { staffId } : {}), ...(staffName ? { staffName } : {}) }
}

function gatewayAccess(): TeamAgentGatewayAccess {
  return { baseUrl: gatewayBaseUrl(), getToken: aiGatewayToken }
}

export function sendMessage(agentId: TeamAgentId, staffId: string | undefined, message: string, files: { blob: Blob, filename: string }[] = []) {
  return sendTeamAgentMessage({ ...access(agentId, staffId), message, files })
}

export function fetchImage(agentId: TeamAgentId, staffId: string | undefined, id: string) {
  return getTeamAgentImage({ ...access(agentId, staffId), id })
}

export function fetchHistory(agentId: TeamAgentId, staffId: string | undefined, options: { after?: string, before?: string, limit?: number }) {
  return getTeamAgentHistory({ ...access(agentId, staffId), ...options })
}

export async function markRead(agentId: TeamAgentId, staffId: string | undefined, eventId: string) {
  return markTeamAgentRead({ ...access(agentId, staffId), eventId })
}

export function fetchReminders(agentId: TeamAgentId, staffId?: string) {
  return listTeamAgentReminders(access(agentId, staffId))
}

export function cancelReminder(agentId: TeamAgentId, staffId: string | undefined, id: string) {
  return cancelTeamAgentReminder({ ...access(agentId, staffId), id })
}

export function fetchNotes(agentId: TeamAgentId, staffId?: string) {
  return getTeamAgentNotes(access(agentId, staffId))
}

/** `staffId` filters to one assignee and is admin-only; a staff viewer omits it and gets their own. */
export function fetchPersonalAssignments(status: TeamAgentAssignmentStatus, staffId?: string) {
  return listPersonalAssignments({ ...gatewayAccess(), status, ...(staffId ? { staffId } : {}) })
}

export function cancelAssignment(id: string) {
  return cancelPersonalAssignment({ ...gatewayAccess(), id })
}

export function fetchPushKey(signal?: AbortSignal) {
  return getTeamAgentPushKey({ ...gatewayAccess(), signal })
}

export function subscribePush(subscription: PushSubscriptionJSON, signal?: AbortSignal) {
  return subscribeTeamAgentPush({ ...gatewayAccess(), subscription, signal })
}

export function unsubscribePush(endpoint: string) {
  return unsubscribeTeamAgentPush({ ...gatewayAccess(), endpoint })
}

export async function fetchSecretarySettings(staffId: string) {
  const [settings, preferences] = await Promise.all([
    getSecretarySettings({ baseUrl: agentBaseUrl('secretary'), getToken: aiGatewayToken, staffId }),
    fetchPreferences(staffId),
  ])
  return { ...settings, language: preferences.language }
}

export async function updateSecretarySettings(staffId: string, body: UpdateSecretarySettingsInput) {
  const preferences = await updatePreferences(staffId, body.language)
  const settings = await getSecretarySettings({ baseUrl: agentBaseUrl('secretary'), getToken: aiGatewayToken, staffId })
  return { ...settings, language: preferences.language }
}
