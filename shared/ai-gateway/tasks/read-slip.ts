import type { z } from 'zod'
import { readSlipInputSchema, readSlipResultSchema } from '../../../contracts/ai-gateway/read-slip-api.schema.js'
import { callAiTask } from '../ai-gateway.client.js'
import { AiGatewayError } from '../ai-gateway.errors.js'

export type ReadSlipResult = z.infer<typeof readSlipResultSchema>

export async function readSlip({ baseUrl, getToken, file, filename, priceGroup, signal, fetchImpl }: {
  baseUrl: string
  getToken: () => Promise<string | null>
  file: Blob
  filename: string
  priceGroup: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<ReadSlipResult> {
  const input = readSlipInputSchema.parse({ priceGroup })
  const envelope = await callAiTask({
    baseUrl, getToken, task: 'read-slip', input, signal, fetchImpl,
    files: [{ blob: file, filename, role: 'slip-page' }],
  })
  const result = readSlipResultSchema.safeParse(envelope.result)
  if (!result.success) throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid slip reading')
  return result.data
}
