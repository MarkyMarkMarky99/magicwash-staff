import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import {
  cancelTeamAgentReminder,
  getTeamAgentHistory,
  getTeamAgentImage,
  getTeamAgentNotes,
  listTeamAgentReminders,
  sendTeamAgentMessage,
  type TeamAgentAccess,
  type TeamAgentId,
} from '@shared/ai-gateway/tasks/team-agent'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'

export type {
  TeamAgentAccepted,
  TeamAgentEvent,
  TeamAgentEventImage,
  TeamAgentId,
  TeamAgentNote,
  TeamAgentReminder,
} from '@shared/ai-gateway/tasks/team-agent'

function access(agentId: TeamAgentId): TeamAgentAccess {
  const baseUrl = aiGatewayBaseUrl()
  if (!baseUrl) throw new AiGatewayError('NOT_CONFIGURED', 'AI gateway is not configured')
  return { agentId, baseUrl, getToken: aiGatewayToken }
}

export function sendMessage(agentId: TeamAgentId, message: string, files: { blob: Blob, filename: string }[] = []) {
  return sendTeamAgentMessage({ ...access(agentId), message, files })
}

export function fetchImage(agentId: TeamAgentId, id: string) {
  return getTeamAgentImage({ ...access(agentId), id })
}

export function fetchHistory(agentId: TeamAgentId, options: { after?: string, limit?: number }) {
  return getTeamAgentHistory({ ...access(agentId), ...options })
}

export function fetchReminders(agentId: TeamAgentId) {
  return listTeamAgentReminders(access(agentId))
}

export function cancelReminder(agentId: TeamAgentId, id: string) {
  return cancelTeamAgentReminder({ ...access(agentId), id })
}

export function fetchNotes(agentId: TeamAgentId) {
  return getTeamAgentNotes(access(agentId))
}
