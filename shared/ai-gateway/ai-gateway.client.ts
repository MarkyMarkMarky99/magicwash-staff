import { aiGatewayErrorSchema, aiGatewayHealthSchema, aiGatewaySuccessSchema } from '../../contracts/ai-gateway/ai-gateway-api.schema.js'
import { AiGatewayError } from './ai-gateway.errors.js'

interface CallAiTaskOptions {
  baseUrl: string
  task: string
  input: object
  files?: { blob: Blob, filename: string, role: string }[]
  getToken: () => Promise<string | null>
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: typeof fetch
  requestId?: string
}

async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number, signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(new AiGatewayError('ABORTED', 'AI request cancelled'))
      controller.abort()
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      reject(new AiGatewayError('CLIENT_TIMEOUT', 'AI request timed out. Try again.'))
      controller.abort()
    }, timeoutMs)
  })
  try {
    return await Promise.race([interrupted, controller.signal.aborted ? interrupted : operation(controller.signal)])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function callAiTask({
  baseUrl, task, input, files = [], getToken, signal, timeoutMs = 120000, fetchImpl = fetch, requestId,
}: CallAiTaskOptions) {
  if (!baseUrl.trim()) throw new AiGatewayError('NOT_CONFIGURED', 'AI gateway is not configured')
  return withDeadline(async (combinedSignal) => {
    try {
      const token = await getToken()
      if (combinedSignal.aborted) throw new AiGatewayError('ABORTED', 'AI request cancelled')
      const headers: Record<string, string> = {}
      if (token !== null) headers.Authorization = `Bearer ${token}`
      let body: FormData | string
      if (files.length) {
        const form = new FormData()
        form.append('request', JSON.stringify({
          requestId, input, attachments: files.map((file, index) => ({ file: `file${index}`, role: file.role })),
        }))
        files.forEach((file, index) => form.append(`file${index}`, file.blob, file.filename))
        body = form
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({ requestId, input })
      }
      const response = await fetchImpl(`${baseUrl.trim().replace(/\/+$/, '')}/tasks/${encodeURIComponent(task)}`, {
        method: 'POST', headers, body, signal: combinedSignal,
      })
      let data: unknown
      try { data = await response.json() } catch {
        throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned invalid JSON', response.status)
      }
      const failure = aiGatewayErrorSchema.safeParse(data)
      if (failure.success) throw new AiGatewayError(failure.data.error.code, failure.data.error.message, response.status)
      const success = aiGatewaySuccessSchema.safeParse(data)
      if (!response.ok || !success.success) {
        throw new AiGatewayError('INVALID_RESPONSE', 'AI gateway returned an invalid response', response.status)
      }
      return success.data
    } catch (reason) {
      if (reason instanceof AiGatewayError) throw reason
      throw new AiGatewayError('NETWORK', 'Unable to reach the AI gateway. Try again.')
    }
  }, timeoutMs, signal)
}

export async function checkAiGatewayHealth({
  baseUrl, fetchImpl = fetch, timeoutMs = 5000, signal,
}: { baseUrl: string, fetchImpl?: typeof fetch, timeoutMs?: number, signal?: AbortSignal }) {
  try {
    return await withDeadline(async (combinedSignal) => {
      const response = await fetchImpl(`${baseUrl.trim().replace(/\/+$/, '')}/health`, { signal: combinedSignal })
      if (!response.ok) return null
      const parsed = aiGatewayHealthSchema.safeParse(await response.json())
      return parsed.success ? parsed.data : null
    }, timeoutMs, signal)
  } catch { return null }
}
