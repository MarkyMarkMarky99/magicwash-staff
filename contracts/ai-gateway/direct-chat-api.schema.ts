import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const conversationIdSchema = z.string().regex(/^dm_[0-9a-f]{24}$/)
export const directChatStaffIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
export const directChatSeqSchema = z.number().int().nonnegative().safe()
export const directChatLanguageSchema = z.enum(['th', 'my', 'en'])
export const directChatTranslationSchema = z.object({
  state: z.enum(['pending', 'done', 'unavailable', 'off']),
  to: directChatLanguageSchema.optional(), text: z.string().optional(), same: z.boolean().optional(),
  reason: z.string().optional(), error: z.string().optional(),
})
export const directChatTranslationUpdateSchema = z.object({
  seq: directChatSeqSchema, kind: z.literal('translation'), refSeq: directChatSeqSchema,
  lang: directChatLanguageSchema, text: z.string().optional(), same: z.boolean().optional(), error: z.string().optional(),
})
export const directChatPeerSchema = z.object({ staffId: directChatStaffIdSchema, name: z.string() })
export const directChatMessageSchema = z.object({
  seq: directChatSeqSchema, id: z.string(), kind: z.literal('staff'), at: z.string(),
  speaker: directChatPeerSchema.extend({ role: z.enum(['admin', 'staff']) }),
  text: z.string(), clientId: z.string(),
  images: z.array(z.object({ id: z.string(), type: z.enum(['image/jpeg', 'image/png']), size: directChatSeqSchema })).optional(),
  translate: directChatTranslationSchema.optional(),
})
export const directChatInboxSchema = z.object({ conversations: z.array(z.object({
  conversationId: conversationIdSchema, peer: directChatPeerSchema,
  last: z.object({ seq: directChatSeqSchema, at: z.string(), speakerId: directChatStaffIdSchema, text: z.string(), hasImages: z.boolean() }),
  unread: directChatSeqSchema,
})) })
export const directChatConversationSchema = z.object({ conversationId: conversationIdSchema, peer: directChatPeerSchema })
export const directChatHistorySchema = directChatConversationSchema.extend({
  messages: z.array(directChatMessageSchema), highWater: directChatSeqSchema, hasMore: z.boolean(), readSeq: directChatSeqSchema,
})
export const directChatAfterSchema = z.object({
  messages: z.array(directChatMessageSchema), translationUpdates: z.array(directChatTranslationUpdateSchema),
  nextAfter: directChatSeqSchema, hasMore: z.boolean(),
})
export const directChatSendSchema = z.object({
  text: z.string().max(4000).refine(text => !/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)),
  clientId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
}).strict()

export const directChatApiContract = {
  query: { list: z.object({}).strict() },
  request: { create: z.object({ peerStaffId: directChatStaffIdSchema }).strict(), update: z.never() },
  response: { list: directChatInboxSchema, detail: directChatHistorySchema, create: directChatConversationSchema },
} satisfies ModuleApiContract
