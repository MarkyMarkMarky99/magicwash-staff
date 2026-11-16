import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import {
  cancelAppointmentReminder,
  getAppointmentImage,
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
  AppointmentsAgentEventImage,
  AppointmentsAgentNote,
  AppointmentsAgentReminder,
} from '@shared/ai-gateway/tasks/appointments-agent'

function access(): AppointmentsAgentAccess {
  const baseUrl = aiGatewayBaseUrl()
  if (!baseUrl) throw new AiGatewayError('NOT_CONFIGURED', 'AI gateway is not configured')
  return { baseUrl, getToken: aiGatewayToken }
}

export function sendMessage(message: string, files: { blob: Blob, filename: string }[] = []) {
  return sendAppointmentsMessage({ ...access(), message, files })
}

export function fetchImage(id: string) {
  return getAppointmentImage({ ...access(), id })
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
