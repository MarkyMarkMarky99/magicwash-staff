import { ApiError } from './api-error.js'
import type { ApiHandlerRequest } from './api-handler.js'

export function requireStaffId(req: ApiHandlerRequest): string {
  if (!req.staff) throw ApiError.unauthorized()
  return req.staff.staffId
}

export function bodyWithSessionActor(req: ApiHandlerRequest, ...fields: string[]): unknown {
  const staffId = requireStaffId(req)
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return req.body
  return { ...req.body, ...Object.fromEntries(fields.map(field => [field, staffId])) }
}
