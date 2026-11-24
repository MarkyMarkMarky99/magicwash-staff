import { z } from 'zod'
import { callAiGatewayBlob, callAiGatewayEndpoint } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'
import type { TeamAgentGatewayAccess } from './team-agent.js'

import {
  conversationIdSchema, directChatLanguageSchema, directChatTranslationSchema,
  directChatTranslationUpdateSchema, directChatPeerSchema, directChatMessageSchema,
  directChatInboxSchema, directChatConversationSchema, directChatHistorySchema,
  directChatAfterSchema, directChatSendSchema, directChatStaffIdSchema,
  directChatSeqSchema,
} from '../../../contracts/ai-gateway/direct-chat-api.schema.js'
export {
  conversationIdSchema, directChatLanguageSchema, directChatTranslationSchema,
  directChatTranslationUpdateSchema, directChatPeerSchema, directChatMessageSchema,
  directChatInboxSchema, directChatConversationSchema, directChatHistorySchema,
  directChatAfterSchema, directChatSendSchema, directChatStaffIdSchema,
  directChatSeqSchema,
} from '../../../contracts/ai-gateway/direct-chat-api.schema.js'

export type DirectChatTranslation = z.infer<typeof directChatTranslationSchema>
export type DirectChatMessage = z.infer<typeof directChatMessageSchema>
export type DirectChatInbox = z.infer<typeof directChatInboxSchema>['conversations']
export type DirectChatPeer = z.infer<typeof directChatPeerSchema>
export type DirectChatTranslationUpdate = z.infer<typeof directChatTranslationUpdateSchema>
export type DirectChatSend = z.infer<typeof directChatSendSchema>
export type DirectChatAccess = TeamAgentGatewayAccess

function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new AiGatewayError('INVALID_INPUT', 'Invalid direct chat request')
  return parsed.data
}
async function result<T>(schema: z.ZodType<T>, access: DirectChatAccess, method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
  const parsed = schema.safeParse(await callAiGatewayEndpoint({ ...access, method, path, body }))
  if (!parsed.success) throw new AiGatewayError('INVALID_RESPONSE', 'Invalid direct chat response')
  return parsed.data
}
function threadPath(id: string): string {
  return `/direct/conversations/${input(conversationIdSchema, id)}`
}
export function getDirectChatInbox(access: DirectChatAccess) {
  return result(directChatInboxSchema, access, 'GET', '/direct/inbox')
}
export function createDirectChatConversation(access: DirectChatAccess, peerStaffId: string) {
  return result(directChatConversationSchema, access, 'POST', '/direct/conversations', { peerStaffId: input(directChatStaffIdSchema, peerStaffId) })
}
export async function getDirectChatHistory(access: DirectChatAccess, id: string, options: { before?: number, limit?: number } = {}) {
  const query = input(z.object({ before: directChatSeqSchema.min(1).optional(), limit: z.number().int().min(1).max(500).optional() }).strict(), options)
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))
  const data = await result(directChatHistorySchema, access, 'GET', `${threadPath(id)}/history?${params}`)
  if (data.conversationId !== id) throw new AiGatewayError('INVALID_RESPONSE', 'Conversation mismatch')
  return data
}
export function getDirectChatAfter(access: DirectChatAccess, id: string, after: number) {
  return result(directChatAfterSchema, access, 'GET', `${threadPath(id)}/history?after=${input(directChatSeqSchema, after)}`)
}
export function sendDirectChatMessage(access: DirectChatAccess, id: string, body: DirectChatSend, files: File[] = []) {
  const request = input(directChatSendSchema, body)
  if (files.length > 3 || files.some(file => !['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) || (!request.text.trim() && !files.length)) {
    throw new AiGatewayError('INVALID_INPUT', 'Invalid message or images')
  }
  let payload: object = request
  if (files.length) {
    const form = new FormData()
    form.append('request', JSON.stringify(request))
    files.forEach(file => form.append('images', file, file.name))
    payload = form
  }
  return result(z.object({ message: directChatMessageSchema }), access, 'POST', `${threadPath(id)}/messages`, payload)
}
export function markDirectChatRead(access: DirectChatAccess, id: string, eventId: string) {
  return result(z.object({ readSeq: directChatSeqSchema }), access, 'POST', `${threadPath(id)}/read`, { eventId: input(z.string().regex(/^[1-9][0-9]*$/), eventId) })
}
export function retryDirectChatTranslation(access: DirectChatAccess, id: string, seq: number) {
  return result(z.object({ translate: directChatTranslationSchema }), access, 'POST', `${threadPath(id)}/messages/${input(directChatSeqSchema.min(1), seq)}/translate`)
}
export function getDirectChatImage(access: DirectChatAccess, id: string, imageId: string) {
  return callAiGatewayBlob({ ...access, path: `${threadPath(id)}/images/${encodeURIComponent(input(z.string().min(1), imageId))}` })
}
