import { z } from 'zod'
import { callAiGatewayEndpoint, callAiTask } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'

const MAX_MESSAGE_LENGTH = 4000
const HISTORY_MAX_LIMIT = 500

const eventSchema = z.object({
  id: z.coerce.string(),
  at: z.string(),
  kind: z.enum(['staff', 'agent', 'action', 'system']),
  speaker: z.object({ staffId: z.string(), name: z.string() }).nullish(),
  text: z.string(),
  action: z.object({
    type: z.enum(['create', 'reschedule', 'cancel', 'remind', 'reminder-cancelled']),
    appointmentId: z.string().nullish(),
    outcome: z.enum(['ok', 'failed', 'unknown']),
  }).nullish(),
})

const reminderSchema = z.object({
  id: z.coerce.string(),
  dueAt: z.string(),
  note: z.string(),
  createdAt: z.string(),
  status: z.string(),
})

const acceptedSchema = z.object({ accepted: z.literal(true), turnId: z.coerce.string(), eventId: z.coerce.string() })
const historySchema = z.object({ events: z.array(eventSchema), busy: z.boolean() })
const remindersSchema = z.object({ reminders: z.array(reminderSchema) })
const cancelledReminderSchema = z.object({ reminder: reminderSchema })
const notesSchema = z.object({
  files: z.array(z.object({ name: z.string(), content: z.string(), updatedAt: z.string().nullish() })),
})

export type AppointmentsAgentEvent = z.infer<typeof eventSchema>
export type AppointmentsAgentReminder = z.infer<typeof reminderSchema>
export type AppointmentsAgentNote = z.infer<typeof notesSchema>['files'][number]
export type AppointmentsAgentAccepted = z.infer<typeof acceptedSchema>
export type AppointmentsAgentHistory = z.infer<typeof historySchema>

export interface AppointmentsAgentAccess {
  baseUrl: string
  getToken: () => Promise<string | null>
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

async function readEndpoint<T extends z.ZodType>(
  access: AppointmentsAgentAccess, method: 'GET' | 'POST', path: string, schema: T,
): Promise<z.infer<T>> {
  const data = await callAiGatewayEndpoint({ ...access, method, path })
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid appointments reply')
  return parsed.data
}

export async function sendAppointmentsMessage(
  { message, ...access }: AppointmentsAgentAccess & { message: string },
): Promise<AppointmentsAgentAccepted> {
  if (!message.trim()) throw new AiGatewayError('INVALID_INPUT', 'A message is required')
  if (message.length > MAX_MESSAGE_LENGTH) throw new AiGatewayError('INVALID_INPUT', 'The message is too long')
  const envelope = await callAiTask({
    ...access, task: 'chat', input: { agentId: 'appointments', message }, timeoutMs: 20000,
  })
  const accepted = acceptedSchema.safeParse(envelope.result)
  if (!accepted.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid appointments reply')
  return accepted.data
}

export function getAppointmentsHistory(
  { after, limit, ...access }: AppointmentsAgentAccess & { after?: string, limit?: number },
): Promise<AppointmentsAgentHistory> {
  const query = new URLSearchParams()
  if (after !== undefined) query.set('after', after)
  if (limit !== undefined) query.set('limit', String(Math.min(Math.max(Math.trunc(limit), 1), HISTORY_MAX_LIMIT)))
  const queryText = query.toString()
  const suffix = queryText ? `?${queryText}` : ''
  return readEndpoint(access, 'GET', `/agents/appointments/history${suffix}`, historySchema)
}

export async function listAppointmentReminders(access: AppointmentsAgentAccess): Promise<AppointmentsAgentReminder[]> {
  return (await readEndpoint(access, 'GET', '/agents/appointments/reminders', remindersSchema)).reminders
}

export async function cancelAppointmentReminder(
  { id, ...access }: AppointmentsAgentAccess & { id: string },
): Promise<AppointmentsAgentReminder> {
  const path = `/agents/appointments/reminders/${encodeURIComponent(id)}/cancel`
  return (await readEndpoint(access, 'POST', path, cancelledReminderSchema)).reminder
}

export async function getAppointmentNotes(access: AppointmentsAgentAccess): Promise<AppointmentsAgentNote[]> {
  return (await readEndpoint(access, 'GET', '/agents/appointments/notes', notesSchema)).files
}
