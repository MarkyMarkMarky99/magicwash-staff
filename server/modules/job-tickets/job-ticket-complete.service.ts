import type { z } from 'zod'
import {
  jobTicketCompleteOrderRequestSchema,
  jobTicketCompleteOrderResponseSchema,
  jobTicketCompleteOrdersRequestSchema,
  jobTicketCompleteOrdersResponseSchema,
} from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { isDepartmentWorkTicket } from '../../../shared/job-tickets/department-work.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { SecretaryOwner } from '../../shared/auth/staff-list.js'
import { ApiError } from '../../shared/http/api-error.js'
import { requireSecretaryDepartment } from '../../shared/http/secretary-policy.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { JobTicketTransitionService, type JobTicketTransitionServiceOptions } from './job-ticket-transition.service.js'

export type JobTicketCompleteOrderResponse = z.infer<typeof jobTicketCompleteOrderResponseSchema>
export type JobTicketCompleteOrdersResponse = z.infer<typeof jobTicketCompleteOrdersResponseSchema>
type CompleteDepartment = z.infer<typeof jobTicketCompleteOrdersRequestSchema>['department']
type OrderCompletion = Extract<JobTicketCompleteOrdersResponse, { kind: 'completed' }>['results'][number]

export class JobTicketCompleteService {
  constructor(private readonly options: JobTicketTransitionServiceOptions = {}) {}

  async completeOrder(payload: unknown, actor: string, owner?: SecretaryOwner): Promise<JobTicketCompleteOrderResponse> {
    const request = parseOrThrow(jobTicketCompleteOrderRequestSchema, payload)
    const result = await this.closeOrders([request.orderId], request.department, actor, owner)
    if (result.kind === 'write_failed') return result
    return { kind: 'completed', scannedBy: result.scannedBy, completed: result.results[0]!.completed }
  }

  async completeOrders(payload: unknown, actor: string, owner?: SecretaryOwner): Promise<JobTicketCompleteOrdersResponse> {
    const request = parseOrThrow(jobTicketCompleteOrdersRequestSchema, payload)
    return this.closeOrders(request.orderIds, request.department, actor, owner)
  }

  private async closeOrders(orderIds: string[], department: CompleteDepartment, actor: string, owner?: SecretaryOwner): Promise<JobTicketCompleteOrdersResponse> {
    if (actor === 'AI' && department !== 'Washing' && department !== 'Ironing') {
      throw ApiError.forbidden('AI may only close Washing and Ironing tickets')
    }
    if (owner) requireSecretaryDepartment(owner, department)
    const repository = (this.options.repository ?? getJobTicketsRepository)()
    const tickets = orderIds.length === 1
      ? await repository.read({ where: { order_id: orderIds[0]! } })
      : await repository.read()
    const results = orderIds.map((orderId): OrderCompletion => ({ orderId, completed: [] }))
    const orders = new Map(results.map(order => [order.orderId, order]))
    const orderByTicketId = new Map<string, OrderCompletion>()
    const open = []
    for (const ticket of tickets) {
      const order = orders.get(String(ticket.order_id ?? ''))
      if (!order || ticket.deleted_at || ticket.department !== department
        || (ticket.status !== 'Pending' && ticket.status !== 'In Progress')
        || !isDepartmentWorkTicket({ scope: ticket.scope, department: ticket.department,
          taskCode: ticket.task_code, deletedAt: ticket.deleted_at }, department)) continue
      open.push({ ticketId: ticket.id, orderId: order.orderId })
      // The transition trims ticket IDs and keeps the first request for each ID.
      if (typeof ticket.id === 'string') {
        const ticketId = ticket.id.trim()
        if (!orderByTicketId.has(ticketId)) orderByTicketId.set(ticketId, order)
      }
    }
    const result = await new JobTicketTransitionService({ ...this.options, repository: () => repository }).transition({
      department, targetStatus: 'Completed', allowedSourceStatuses: ['Pending', 'In Progress'],
      scannedBy: actor, tickets: open,
    }, tickets, { skipGating: true, skipScores: true })
    if (result.kind === 'write_failed') return { kind: 'write_failed', certainty: result.certainty }
    for (const ticket of result.advanced) {
      orderByTicketId.get(ticket.ticketId)!.completed.push({ ticketId: ticket.ticketId, status: 'Completed',
        startedAt: ticket.startedAt!, startedBy: ticket.startedBy, completedAt: ticket.completedAt! })
    }
    return { kind: 'completed', scannedBy: actor, results }
  }
}
