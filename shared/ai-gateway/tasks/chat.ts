import type { z } from 'zod'
import { chatInputSchema, chatResultSchema } from '../../../contracts/ai-gateway/chat-api.schema.js'
import { callAiTask } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'

export type ChatResult = z.infer<typeof chatResultSchema>

export async function sendChat({ baseUrl, getToken, agentId, message, sessionId, files, signal, fetchImpl }: {
  baseUrl: string
  getToken: () => Promise<string | null>
  agentId: z.infer<typeof chatInputSchema>['agentId']
  message: string
  sessionId?: string | null
  files: { blob: Blob, filename: string }[]
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<ChatResult> {
  const input = chatInputSchema.parse({ agentId, message, ...(sessionId != null ? { sessionId } : {}) })
  if (!message.trim() && !files.length) throw new AiGatewayError('INVALID_INPUT', 'A message or image is required')
  if (files.length > 3 || files.some(({ blob }) => !['image/jpeg', 'image/png'].includes(blob.type) || blob.size > 5 * 1024 * 1024)) {
    throw new AiGatewayError('INVALID_ATTACHMENT', 'Attach up to three JPEG or PNG images, at most 5 MiB each')
  }
  const envelope = await callAiTask({
    baseUrl, getToken, task: 'chat', input, signal, fetchImpl, timeoutMs: 95000,
    files: files.map(file => ({ ...file, role: 'reference' })),
  })
  const result = chatResultSchema.safeParse(envelope.result)
  if (!result.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid chat reply')
  return result.data
}
