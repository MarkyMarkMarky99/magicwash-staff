import { z } from 'zod'
import { callAiGatewayBlob, callAiGatewayEndpoint, callAiTask } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'
import { TEAM_AGENT_IDS } from '../../../contracts/ai-gateway/chat-api.schema.js'
import { billingDraftSchema } from '../../../contracts/ai-gateway/billing-draft.schema.js'

const MAX_MESSAGE_LENGTH = 4000
const HISTORY_MAX_LIMIT = 500
const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const eventSchema = z.object({
  id: z.coerce.string(),
  at: z.string(),
  kind: z.enum(['staff', 'agent', 'action', 'system']),
  speaker: z.object({ staffId: z.string(), name: z.string(), role: z.enum(['admin', 'staff', 'system']).nullish() }).nullish(),
  text: z.string(),
  proposal: billingDraftSchema.nullish().catch(null),
  images: z.array(z.object({ id: z.coerce.string(), name: z.string(), type: z.string() })).nullish(),
  action: z.object({
    type: z.enum([
      'create', 'reschedule', 'cancel', 'remind', 'reminder-cancelled', 'close', 'reopen',
      'assign', 'assignment-done', 'assignment-cancelled', 'assignment-overdue', 'assignment-closed',
    ]),
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

const assignmentSchema = z.object({
  id: z.coerce.string(),
  version: z.coerce.number().nullish(),
  assigneeStaffId: z.string(),
  assigneeName: z.string().nullish(),
  createdBy: z.object({
    kind: z.string(),
    staffId: z.string().nullish(),
    agentId: z.string().nullish(),
    name: z.string().nullish(),
  }).nullish(),
  requestedByAdmin: z.string().nullish(),
  orderId: z.string().nullish(),
  detail: z.string(),
  dueAt: z.string().nullish(),
  status: z.enum(['open', 'done', 'cancelled']),
  dueNotified: z.boolean().nullish(),
  failedDeliveries: z.coerce.number().nullish(),
})

const acceptedSchema = z.object({ accepted: z.literal(true), turnId: z.coerce.string(), eventId: z.coerce.string() })
const readSchema = z.object({ readId: z.string().nullable() })
const historySchema = z.object({ events: z.array(eventSchema), busy: z.boolean(), readId: readSchema.shape.readId.optional() })
const remindersSchema = z.object({ reminders: z.array(reminderSchema) })
const cancelledReminderSchema = z.object({ reminder: reminderSchema })
const assignmentsSchema = z.object({ assignments: z.array(assignmentSchema) })
const cancelledAssignmentSchema = z.object({ assignment: assignmentSchema })
const pushKeySchema = z.object({ publicKey: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/) })
const emptyResultSchema = z.object({}).strict()
const notesSchema = z.object({
  files: z.array(z.object({ name: z.string(), content: z.string(), updatedAt: z.string().nullish() })),
})

export type TeamAgentEvent = z.infer<typeof eventSchema>
export type TeamAgentEventImage = NonNullable<TeamAgentEvent['images']>[number]
export type TeamAgentReminder = z.infer<typeof reminderSchema>
export type TeamAgentNote = z.infer<typeof notesSchema>['files'][number]
export type TeamAgentAssignment = z.infer<typeof assignmentSchema>
export type TeamAgentAssignmentStatus = TeamAgentAssignment['status'] | 'all'
export type TeamAgentAccepted = z.infer<typeof acceptedSchema>
export type TeamAgentHistory = z.infer<typeof historySchema>

export type TeamAgentId = typeof TEAM_AGENT_IDS[number]

export interface TeamAgentAccess {
  agentId: TeamAgentId
  baseUrl: string
  getToken: () => Promise<string | null>
  staffId?: string
  /** Admin-only: the target's display name from the staff list, so the assistant knows who it serves. */
  staffName?: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export type TeamAgentGatewayAccess = Omit<TeamAgentAccess, 'agentId' | 'staffId' | 'staffName'>
export type PersonalAssignmentsAccess = TeamAgentGatewayAccess

function agentPath(access: TeamAgentAccess, suffix: string, query: URLSearchParams = new URLSearchParams()): string {
  if (access.staffId) query.set('staffId', access.staffId)
  if (access.staffId && access.staffName) query.set('staffName', access.staffName)
  const queryText = query.toString()
  return `/agents/${access.agentId}/${suffix}${queryText ? `?${queryText}` : ''}`
}

async function readEndpoint<T extends z.ZodType>(
  access: TeamAgentGatewayAccess, method: 'GET' | 'POST', path: string, schema: T, body?: object,
  timeoutMs?: number,
): Promise<z.infer<T>> {
  const data = await callAiGatewayEndpoint({ ...access, method, path, body, timeoutMs })
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
    ...access, task: 'chat', input: { agentId: access.agentId, message, ...(access.staffId ? { staffId: access.staffId } : {}) }, timeoutMs: 20000,
    files: files.map(file => ({ ...file, role: 'reference' })),
  })
  const accepted = acceptedSchema.safeParse(envelope.result)
  if (!accepted.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid agent reply')
  return accepted.data
}

export function getTeamAgentImage({ id, ...access }: TeamAgentAccess & { id: string }): Promise<Blob> {
  return callAiGatewayBlob({ ...access, path: agentPath(access, `images/${encodeURIComponent(id)}`) })
}

export async function getTeamAgentHistory(
  { after, before, limit, ...access }: TeamAgentAccess & { after?: string, before?: string, limit?: number },
): Promise<TeamAgentHistory> {
  if (after !== undefined && before !== undefined) throw new AiGatewayError('INVALID_INPUT', 'History cannot use after and before together')
  const query = new URLSearchParams()
  if (after !== undefined) query.set('after', after)
  if (before !== undefined) query.set('before', before)
  if (limit !== undefined) query.set('limit', String(Math.min(Math.max(Math.trunc(limit), 1), HISTORY_MAX_LIMIT)))
  return readEndpoint(access, 'GET', agentPath(access, 'history', query), historySchema)
}

export function markTeamAgentRead({ eventId, ...access }: TeamAgentAccess & { eventId: string }) {
  return readEndpoint(access, 'POST', agentPath(access, 'read'), readSchema, { eventId })
}

export async function listTeamAgentReminders(access: TeamAgentAccess): Promise<TeamAgentReminder[]> {
  return (await readEndpoint(access, 'GET', agentPath(access, 'reminders'), remindersSchema)).reminders
}

export async function cancelTeamAgentReminder(
  { id, ...access }: TeamAgentAccess & { id: string },
): Promise<TeamAgentReminder> {
  const path = agentPath(access, `reminders/${encodeURIComponent(id)}/cancel`)
  return (await readEndpoint(access, 'POST', path, cancelledReminderSchema)).reminder
}

export async function getTeamAgentNotes(access: TeamAgentAccess): Promise<TeamAgentNote[]> {
  return (await readEndpoint(access, 'GET', agentPath(access, 'notes'), notesSchema)).files
}

export async function listPersonalAssignments(
  { status, staffId, ...access }: PersonalAssignmentsAccess & { status: TeamAgentAssignmentStatus, staffId?: string },
): Promise<TeamAgentAssignment[]> {
  const query = new URLSearchParams({ status })
  if (staffId) query.set('staffId', staffId)
  const path = `/agents/personal/assignments?${query}`
  return (await readEndpoint(access, 'GET', path, assignmentsSchema)).assignments
}

export async function cancelPersonalAssignment(
  { id, ...access }: PersonalAssignmentsAccess & { id: string },
): Promise<TeamAgentAssignment> {
  const path = `/agents/personal/assignments/${encodeURIComponent(id)}/cancel`
  return (await readEndpoint(access, 'POST', path, cancelledAssignmentSchema)).assignment
}

export async function getTeamAgentPushKey(access: TeamAgentGatewayAccess): Promise<string> {
  return (await readEndpoint(access, 'GET', '/agents/push/key', pushKeySchema)).publicKey
}

export async function subscribeTeamAgentPush(
  { subscription, ...access }: TeamAgentGatewayAccess & { subscription: object },
): Promise<void> {
  await readEndpoint(access, 'POST', '/agents/push/subscribe', emptyResultSchema, { subscription })
}

export async function unsubscribeTeamAgentPush(
  { endpoint, ...access }: TeamAgentGatewayAccess & { endpoint: string },
): Promise<void> {
  await readEndpoint(access, 'POST', '/agents/push/unsubscribe', emptyResultSchema, { endpoint }, 3000)
}
