import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { jobTicketDepartmentSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { createStaffService } from '../../modules/staff/staff.service.js'
import type { SecretaryOwner } from '../auth/staff-list.js'
import { ApiError } from './api-error.js'
import type { ApiHandlerRequest } from './api-handler.js'

export function secretaryOwnerId(headers: VercelRequest['headers']): string | undefined {
  const key = headers['x-secretary-key']
  const assistantId = headers['x-assistant-id']
  if (key === undefined && assistantId === undefined) return undefined

  const expectedKey = process.env.SECRETARY_PROXY_KEY
  if (!expectedKey?.trim() || typeof key !== 'string' || typeof assistantId !== 'string'
    || ['authorization', 'x-service-key', 'x-operator-id', 'x-print-api-key'].some(header => headers[header] !== undefined)) {
    throw ApiError.forbidden()
  }
  const expected = Buffer.from(expectedKey)
  const supplied = Buffer.from(key)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw ApiError.forbidden()
  const match = /^AI-([^\s,/\\\x00-\x1f\x7f]+)$/.exec(assistantId)
  if (!match || match[0] !== assistantId) throw ApiError.forbidden()
  return match[1]!
}

export async function resolveSecretary(ownerId: string) {
  try {
    const staff = await createStaffService().resolveSecretary(ownerId)
    if (staff) return staff
  } catch {
    // Identity lookup failures must not fall back to another authentication path.
  }
  throw ApiError.forbidden('Secretary identity could not be resolved')
}

const pagination = ['page', 'perPage']
const collectionQueries: ReadonlyMap<string, readonly string[]> = new Map([
  ['attendance', ['week']],
  ['customers', [...pagination, 'keyword']],
  ['appointments', [...pagination, 'appointmentDate']],
  ['work-orders', [...pagination, 'customerId', 'sortOrder']],
  ['job-tickets', [...pagination, 'orderId', 'laundryItemId', 'sortBy', 'sortOrder']],
])

const appointmentCreateFields = [
  'customerId', 'customerName', 'customerCode', 'phone', 'address', 'location',
  'appointmentType', 'appointmentDate', 'timeSlot',
]
const appointmentOptionalFields = ['notes', 'vehicle', 'pickupOrderId', 'deliveryOrderId']

function hasExactFields(body: object, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every(field => Object.hasOwn(body, field))
    && Object.keys(body).every(field => required.includes(field) || optional.includes(field))
}

function readQueryFields(module: string, id: string | undefined): readonly string[] | undefined {
  if (id === undefined) return collectionQueries.get(module)
  if (module === 'job-tickets' && id === 'department-work') return ['department']
  if ((module === 'staff' && id === 'directory') || module === 'appointments' || module === 'customers') return []
}

export function requireSecretaryDepartment(owner: SecretaryOwner, department: SecretaryOwner['departments'][number]): void {
  if (owner.role !== 'admin' && !owner.departments.includes(department)) {
    throw ApiError.forbidden()
  }
}

export function authorizeSecretary(req: ApiHandlerRequest, segments: string[], owner: SecretaryOwner): void {
  const [module, id] = segments
  if (!module || segments.length > 2 || (id !== undefined && /[/\\\x00-\x1f\x7f]/.test(id))) throw ApiError.forbidden()

  if (req.method === 'GET') {
    const allowed = readQueryFields(module, id)
    if (!allowed || Object.entries(req.query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) {
      throw ApiError.forbidden()
    }
    if (module === 'job-tickets' && id === undefined && Boolean(req.query.orderId) === Boolean(req.query.laundryItemId)) {
      throw ApiError.forbidden()
    }
    if (module === 'job-tickets' && id === 'department-work' && !req.query.department) throw ApiError.forbidden()
    return
  }

  const body = req.body
  if (Object.keys(req.query).length || !body || typeof body !== 'object' || Array.isArray(body)) throw ApiError.forbidden()

  if (req.method === 'POST' && module === 'job-tickets' && (id === 'complete-order' || id === 'complete-orders' || id === 'reopen')) {
    const fields = id === 'complete-orders' ? ['department', 'orderIds'] : ['orderId', 'department']
    if (id === 'reopen') fields.push('reason', 'ticketIds')
    if (!hasExactFields(body, fields)) throw ApiError.forbidden()
    const department = jobTicketDepartmentSchema.safeParse((body as { department?: unknown }).department)
    if (!department.success) throw ApiError.forbidden()
    requireSecretaryDepartment(owner, department.data)
    return
  }
  if (req.method === 'POST' && module === 'appointments' && id === undefined
    && owner.role === 'admin' && hasExactFields(body, appointmentCreateFields, appointmentOptionalFields)) return

  if (req.method === 'POST' && module === 'attendance' && id === 'day-off'
    && hasExactFields(body, ['workDate'])) return

  if (req.method === 'PATCH' && id !== undefined) {
    const { status } = body as { status?: unknown }
    if ((module === 'appointments' || module === 'work-orders') && status === 'COMPLETED'
      && hasExactFields(body, ['status'])) return
    if (module === 'appointments' && owner.role === 'admin') {
      if (status === 'CANCELLED' && hasExactFields(body, ['status'])) return
      if (status === 'PENDING' && hasExactFields(body, ['status', 'appointmentDate', 'timeSlot'])) return
    }
  }
  throw ApiError.forbidden()
}
