import { z } from 'zod'
import { callAiGatewayBlob, callAiGatewayEndpoint, callAiTask } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'
import { TEAM_AGENT_IDS } from '../../../contracts/ai-gateway/chat-api.schema.js'

const MAX_MESSAGE_LENGTH = 4000
const HISTORY_MAX_LIMIT = 500
const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const eventSchema = z.object({
  id: z.coerce.string(),
  at: z.string(),
  kind: z.enum(['staff', 'agent', 'action', 'system']),
  speaker: z.object({ staffId: z.string(), name: z.string() }).nullish(),
  text: z.string(),
  images: z.array(z.object({ id: z.coerce.string(), name: z.string(), type: z.string() })).nullish(),
  action: z.object({
    type: z.enum(['create', 'reschedule', 'cancel', 'remind', 'reminder-cancelled', 'close', 'reopen']),
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

export type TeamAgentEvent = z.infer<typeof eventSchema>
export type TeamAgentEventImage = NonNullable<TeamAgentEvent['images']>[number]
export type TeamAgentReminder = z.infer<typeof reminderSchema>
export type TeamAgentNote = z.infer<typeof notesSchema>['files'][number]
export type TeamAgentAccepted = z.infer<typeof acceptedSchema>
export type TeamAgentHistory = z.infer<typeof historySchema>

export type TeamAgentId = typeof TEAM_AGENT_IDS[number]

export interface TeamAgentAccess {
  agentId: TeamAgentId
  baseUrl: string
  getToken: () => Promise<string | null>
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

async function readEndpoint<T extends z.ZodType>(
  access: TeamAgentAccess, method: 'GET' | 'POST', path: string, schema: T,
): Promise<z.infer<T>> {
  const data = await callAiGatewayEndpoint({ ...access, method, path })
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid agent reply')
  return parsed.data
}

export async function sendTeamAgentMessage(
  { message, files = [], ...access }: TeamAgentAccess & { message: string, files?: { blob: Blob, filename: string }[] },
): Promise<TeamAgentAccepted> {
  if (!message.trim() && !files.length) throw new AiGatewayError('INVALID_INPUT', 'A message or image is required')
  if (message.length > MAX_MESSAGE_LENGTH) throw new AiGatewayError('INVALID_INPUT', 'The message is too long')
  if (files.length > MAX_IMAGES || files.some(({ blob }) => !['image/jpeg', 'image/png'].includes(blob.type) || blob.size > MAX_IMAGE_BYTES)) {
    throw new AiGatewayError('INVALID_ATTACHMENT', 'Attach up to three JPEG or PNG images, at most 5 MiB each')
  }
  const envelope = await callAiTask({
    ...access, task: 'chat', input: { agentId: access.agentId, message }, timeoutMs: 20000,
    files: files.map(file => ({ ...file, role: 'reference' })),
  })
  const accepted = acceptedSchema.safeParse(envelope.result)
  if (!accepted.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid agent reply')
  return accepted.data
}

export function getTeamAgentImage({ id, ...access }: TeamAgentAccess & { id: string }): Promise<Blob> {
  return callAiGatewayBlob({ ...access, path: `/agents/${access.agentId}/images/${encodeURIComponent(id)}` })
}

export function getTeamAgentHistory(
  { after, limit, ...access }: TeamAgentAccess & { after?: string, limit?: number },
): Promise<TeamAgentHistory> {
  const query = new URLSearchParams()
  if (after !== undefined) query.set('after', after)
  if (limit !== undefined) query.set('limit', String(Math.min(Math.max(Math.trunc(limit), 1), HISTORY_MAX_LIMIT)))
  const queryText = query.toString()
  const suffix = queryText ? `?${queryText}` : ''
  return readEndpoint(access, 'GET', `/agents/${access.agentId}/history${suffix}`, historySchema)
}

export async function listTeamAgentReminders(access: TeamAgentAccess): Promise<TeamAgentReminder[]> {
  return (await readEndpoint(access, 'GET', `/agents/${access.agentId}/reminders`, remindersSchema)).reminders
}

export async function cancelTeamAgentReminder(
  { id, ...access }: TeamAgentAccess & { id: string },
): Promise<TeamAgentReminder> {
  const path = `/agents/${access.agentId}/reminders/${encodeURIComponent(id)}/cancel`
  return (await readEndpoint(access, 'POST', path, cancelledReminderSchema)).reminder
}

export async function getTeamAgentNotes(access: TeamAgentAccess): Promise<TeamAgentNote[]> {
  return (await readEndpoint(access, 'GET', `/agents/${access.agentId}/notes`, notesSchema)).files
}
