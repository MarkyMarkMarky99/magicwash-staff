import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import {
  cancelAppointmentReminder,
  getAppointmentNotes,
  getAppointmentsHistory,
  listAppointmentReminders,
  sendAppointmentsMessage,
  type AppointmentsAgentAccess,
} from '@shared/ai-gateway/tasks/appointments-agent'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'

export type {
  AppointmentsAgentAccepted,
  AppointmentsAgentEvent,
  AppointmentsAgentNote,
  AppointmentsAgentReminder,
} from '@shared/ai-gateway/tasks/appointments-agent'

function access(): AppointmentsAgentAccess {
  const baseUrl = aiGatewayBaseUrl()
  if (!baseUrl) throw new AiGatewayError('NOT_CONFIGURED', 'AI gateway is not configured')
  return { baseUrl, getToken: aiGatewayToken }
}

export function sendMessage(message: string) {
  return sendAppointmentsMessage({ ...access(), message })
}

export function fetchHistory(options: { after?: string, limit?: number }) {
  return getAppointmentsHistory({ ...access(), ...options })
}

export function fetchReminders() {
  return listAppointmentReminders(access())
}

export function cancelReminder(id: string) {
  return cancelAppointmentReminder({ ...access(), id })
}

export function fetchNotes() {
  return getAppointmentNotes(access())
}
