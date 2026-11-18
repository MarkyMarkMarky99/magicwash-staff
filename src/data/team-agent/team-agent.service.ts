import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import {
  cancelPersonalAssignment,
  cancelTeamAgentReminder,
  getTeamAgentHistory,
  getTeamAgentImage,
  getTeamAgentNotes,
  listPersonalAssignments,
  listTeamAgentReminders,
  sendTeamAgentMessage,
  type PersonalAssignmentsAccess,
  type TeamAgentAccess,
  type TeamAgentAssignmentStatus,
  type TeamAgentId,
} from '@shared/ai-gateway/tasks/team-agent'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'

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

function access(agentId: TeamAgentId, staffId?: string): TeamAgentAccess {
  const staffName = staffId ? targetNames.get(staffId) : undefined
  return { agentId, baseUrl: gatewayBaseUrl(), getToken: aiGatewayToken, ...(staffId ? { staffId } : {}), ...(staffName ? { staffName } : {}) }
}

function assignmentsAccess(): PersonalAssignmentsAccess {
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
  return listPersonalAssignments({ ...assignmentsAccess(), status, ...(staffId ? { staffId } : {}) })
}

export function cancelAssignment(id: string) {
  return cancelPersonalAssignment({ ...assignmentsAccess(), id })
}
