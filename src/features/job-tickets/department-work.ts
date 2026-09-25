import type { z } from 'zod'
import { jobTicketDepartmentSchema, jobTicketStatusSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'

export type Department = Extract<z.infer<typeof jobTicketDepartmentSchema>, 'Washing' | 'DryCleaning' | 'Ironing' | 'Packaging'>
export type TicketStatus = z.infer<typeof jobTicketStatusSchema>
export type StatusFilter = 'ALL' | 'PENDING' | 'IN PROGRESS' | 'COMPLETED'
export type Grouper = 'item' | 'order'

export interface OrderInfo {
  dueDate: string | null
  customerId: string | null
  customerName: string
  customerIndex: string | null
}

export interface DepartmentOrder extends OrderInfo {
  orderId: string
  tickets: JobTicketDto[]
  percentage: number
}

export const departments: Record<string, { code: Department; label: string }> = {
  washing: { code: 'Washing', label: 'Washing' },
  drycleaning: { code: 'DryCleaning', label: 'Dry Cleaning' },
  ironing: { code: 'Ironing', label: 'Ironing' },
  packaging: { code: 'Packaging', label: 'Packaging' },
}

export const statusFilters: readonly StatusFilter[] = ['ALL', 'PENDING', 'IN PROGRESS', 'COMPLETED']

export function readDepartment(value: unknown): { code: Department; label: string } | null {
  return typeof value === 'string' && Object.hasOwn(departments, value) ? departments[value]! : null
}

export function readStatusFilter(value: unknown): StatusFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && statusFilters.includes(raw as StatusFilter) ? raw as StatusFilter : 'ALL'
}

export function readGrouper(value: unknown): Grouper {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'item' ? 'item' : 'order'
}

export function filterTickets(tickets: readonly JobTicketDto[], filter: StatusFilter): JobTicketDto[] {
  return filter === 'ALL' ? [...tickets] : tickets.filter(ticket => ticket.status.toUpperCase() === filter)
}

export function pendingOrderTags(tickets: readonly JobTicketDto[]): { tags: string[]; missingTags: number } {
  const pending = tickets.filter(ticket => ticket.status === 'Pending')
  return {
    tags: pending.flatMap(ticket => ticket.laundryItemId === null ? [] : [ticket.laundryItemId]),
    missingTags: pending.filter(ticket => ticket.laundryItemId === null).length,
  }
}

export function countDepartmentStatuses(tickets: readonly JobTicketDto[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { ALL: tickets.length, PENDING: 0, 'IN PROGRESS': 0, COMPLETED: 0 }
  for (const ticket of tickets) {
    const key = ticket.status.toUpperCase() as StatusFilter
    if (key !== 'ALL' && key in counts) counts[key] += 1
  }
  return counts
}

export function completionPercentage(tickets: readonly JobTicketDto[]): number {
  return tickets.length === 0 ? 0 : Math.round(100 * tickets.filter(ticket => ticket.status === 'Completed').length / tickets.length)
}

function dueSortKey(dueDate: string | null): string {
  return normalizeSheetDate(dueDate) ?? '9999-12-31'
}

export function sortDepartmentTickets(tickets: readonly JobTicketDto[], orderInfo: ReadonlyMap<string, OrderInfo>): JobTicketDto[] {
  return [...tickets].sort((left, right) =>
    Number(left.laundryItemId === null) - Number(right.laundryItemId === null)
    || dueSortKey(orderInfo.get(left.orderId)?.dueDate ?? null).localeCompare(dueSortKey(orderInfo.get(right.orderId)?.dueDate ?? null))
    || String(left.orderId ?? '').localeCompare(String(right.orderId ?? ''))
    || (left.laundryItemId ?? '').localeCompare(right.laundryItemId ?? ''))
}

export function groupDepartmentOrders(tickets: readonly JobTicketDto[], orderInfo: ReadonlyMap<string, OrderInfo>): DepartmentOrder[] {
  const groups = new Map<string, JobTicketDto[]>()
  for (const ticket of tickets) {
    const group = groups.get(ticket.orderId) ?? []
    group.push(ticket)
    groups.set(ticket.orderId, group)
  }
  return [...groups].map(([orderId, orderTickets]) => ({
    orderId,
    dueDate: orderInfo.get(orderId)?.dueDate ?? null,
    customerId: orderInfo.get(orderId)?.customerId ?? null,
    customerName: orderInfo.get(orderId)?.customerName ?? orderId,
    customerIndex: orderInfo.get(orderId)?.customerIndex ?? null,
    tickets: orderTickets,
    percentage: completionPercentage(orderTickets),
  })).sort((left, right) => dueSortKey(left.dueDate).localeCompare(dueSortKey(right.dueDate)) || String(left.orderId ?? '').localeCompare(String(right.orderId ?? '')))
}
