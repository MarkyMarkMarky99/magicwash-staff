import type { StockTakePreview, StockTakeReport, StockTakeResolution, StockTakeSession } from '@/data/stock-takes/stock-take.service'

export type ReportGarment = StockTakeReport['missing'][number]
export type ReportGap = StockTakeReport['membershipGaps'][number]
export type ReportConflict = StockTakeReport['conflicts'][number]
export type MissingChoice = 'RETURNED' | 'OFF_SITE' | 'LOST' | 'KEEP_LOOKING'
export type SessionActions = {
  canClose: boolean
  canCancel: boolean
  canResolve: boolean
  canPreview: boolean
  canApply: boolean
  canFinish: boolean
}

export const missingChoices: { value: MissingChoice; label: string }[] = [
  { value: 'RETURNED', label: 'Returned' },
  { value: 'OFF_SITE', label: 'Off-site' },
  { value: 'LOST', label: 'Lost' },
  { value: 'KEEP_LOOKING', label: 'Keep looking' },
]

const LINKABLE_GAP_CODES = new Set(['ticket_without_link', 'one_membership_source'])

const codeLabels: Record<string, string> = {
  multiple_zones: 'Scanned in more than one zone',
  multiple_bags: 'Scanned in more than one bag',
  multiple_order_claims: 'Claimed by more than one open order',
  multiple_tasks: 'More than one live task in the zone',
  zone_not_on_route: 'Zone is not on the garment route',
  unregistered_tag: 'Tag is not registered',
  closed_order_only: 'Only on a closed order',
  no_open_order: 'Not on any open order',
  link_without_tag: 'Order link has no tag',
  ticket_without_tag: 'Ticket has no tag',
  ticket_without_link: 'Ticket exists but the garment is not linked to the order',
  one_membership_source: 'Linked in only one of the two garment lists',
  duplicate_registration: 'Tag registered more than once',
  missing_registration: 'Tag has no registration',
  empty_order: 'Order has no garments',
  backward: 'Zone is earlier than the recorded tickets',
  cancelled_step: 'A route step is cancelled',
  missing_route_step: 'A route step is missing',
  dispatch_already_started: 'Bag dispatch already started',
  unreadable_bag: 'Packed without a readable bag',
  bag_link_count: 'Bag link count is not one',
  mismatched_bag: 'Scanned bag differs from the recorded bag',
  missing_bag_image: 'Bag image is missing',
  unverified_logistics: 'Bag logistics ticket is not verified',
}

export function codeLabel(code: string): string {
  return codeLabels[code] ?? code.replace(/_/g, ' ')
}

export function lastTicketLabel(ticket: ReportGarment['lastTicket']): string {
  if (!ticket) return 'No ticket'
  return [ticket.department, ticket.taskCode, `step ${ticket.stepNo}`, ticket.status].filter(Boolean).join(' · ')
}

export function logisticsHint(logistics: ReportGarment['logistics']): string | null {
  if (!logistics.length) return null
  return logistics.map(bag => `Bag ${bag.bagId}: ${bag.status ?? 'no ticket'}`).join(' · ')
}

export function garmentKey(orderId: string, tag: string): string {
  return `${orderId}|${tag}`
}

export function missingResolution(orderId: string, tag: string, choice: MissingChoice, reason: string): { resolution: StockTakeResolution } | { error: string } {
  const trimmed = reason.trim()
  if ((choice === 'RETURNED' || choice === 'OFF_SITE') && !trimmed) return { error: 'Enter who, where and when' }
  if (trimmed.startsWith('=')) return { error: 'A reason cannot start with "="' }
  return { resolution: { orderId, tag, resolution: choice, reason: choice === 'RETURNED' || choice === 'OFF_SITE' ? trimmed : null } }
}

export function linkConfirmation(orderId: string, tag: string): StockTakeResolution {
  return { orderId, tag, resolution: 'LINK_CONFIRMED' }
}

export function taskPick(orderId: string, tag: string, jobTicketId: string): StockTakeResolution {
  return { orderId, tag, resolution: 'TASK_PICK', jobTicketId }
}

export function canConfirmGap(gap: ReportGap): gap is ReportGap & { tag: string } {
  return gap.tag !== null && !gap.confirmed && LINKABLE_GAP_CODES.has(gap.code)
}

export function conflictAction(conflict: ReportConflict): 'link' | 'task' | null {
  if (conflict.orderId === null) return null
  if (conflict.code === 'multiple_order_claims') return 'link'
  if (conflict.code === 'multiple_tasks' && conflict.ticketIds.length) return 'task'
  return null
}

export function sessionActions(session: StockTakeSession | null, planPending: boolean, ticketsWritten: boolean): SessionActions {
  const open = session?.status === 'OPEN'
  const closed = session?.status === 'CLOSED'
  return {
    canClose: open,
    canCancel: (open || closed) && !ticketsWritten,
    canResolve: closed,
    canPreview: closed,
    canApply: closed && planPending,
    canFinish: closed && !planPending,
  }
}

export function planTotals(planned: StockTakePreview['planned']): { garments: number; tickets: number; changes: number } {
  return {
    garments: planned.length,
    tickets: planned.reduce((sum, entry) => sum + entry.ticketCount, 0),
    changes: planned.reduce((sum, entry) => sum + entry.changeCount, 0),
  }
}

export function accountedSummary(report: StockTakeReport): { orders: number; accounted: number } {
  return { orders: report.orders.length, accounted: report.orders.filter(order => order.accounted).length }
}

export function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again'
}
