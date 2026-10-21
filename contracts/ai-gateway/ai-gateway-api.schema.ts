import { z } from 'zod'

export const aiGatewayErrorCodeSchema = z.enum([
  'UNKNOWN_TASK', 'INVALID_INPUT', 'INVALID_ATTACHMENT', 'UNAUTHORIZED', 'FORBIDDEN',
  'RATE_LIMITED', 'BUSY', 'TIMEOUT', 'DATA_UNAVAILABLE', 'BAD_OUTPUT', 'CODEX_FAILED',
  'INTERNAL', 'NOT_FOUND', 'SESSION_NOT_FOUND',
])

export const aiGatewaySuccessSchema = z.object({
  ok: z.literal(true),
  requestId: z.string(),
  task: z.string(),
  taskVersion: z.number().int(),
  ms: z.number(),
  result: z.record(z.string(), z.unknown()),
})

export const aiGatewayErrorSchema = z.object({
  ok: z.literal(false),
  requestId: z.string().nullable(),
  task: z.string().nullable(),
  error: z.object({ code: aiGatewayErrorCodeSchema, message: z.string() }),
})

export const aiGatewayHealthSchema = z.object({
  ok: z.literal(true),
  codexReady: z.boolean(),
  busy: z.boolean(),
  queued: z.number().int().min(0),
})
