import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketStartOrderResult } from '@/data/job-tickets/job-ticket.service'

export type ScanTone = 'loading' | 'success' | 'warning' | 'error'
export type ScanPopup = { customerIndex: string | null; photoUrl: string | null; matched: boolean; itemName?: string; unmatchedText?: string }
export type ScanDisplay = { title: string; orderId?: string; customerName?: string; status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'; message: string; tone: ScanTone; scan?: ScanPopup }

export type ScanPopupInput = {
  title: string; message: string; tone: ScanTone; matched: boolean
  photoUrl?: string | null; customerName?: string; customerIndex?: string | null; itemName?: string; unmatchedText?: string
}

// The one builder of a gun-read popup: department and bag pages both present through it.
export function presentScanPopup(input: ScanPopupInput): ScanDisplay {
  const { title, message, tone, matched } = input
  const extra = {
    ...(input.itemName !== undefined ? { itemName: input.itemName } : {}),
    ...(input.unmatchedText !== undefined ? { unmatchedText: input.unmatchedText } : {}),
  }
  if (!matched) return { title, message, tone, scan: { customerIndex: null, photoUrl: null, matched: false, ...extra } }
  return { title, customerName: input.customerName, message, tone, scan: { customerIndex: input.customerIndex ?? null, photoUrl: input.photoUrl ?? null, matched: true, ...extra } }
}

export const departmentLabels: Record<z.infer<typeof jobTicketDepartmentSchema>, string> = {
  Tagging: 'Tagging',
  Washing: 'Washing',
  DryCleaning: 'Dry Cleaning',
  Ironing: 'Ironing',
  Packaging: 'Packaging',
  Logistics: 'Logistics',
}

export function presentStartOrderResult(result: JobTicketStartOrderResult): { tone: Exclude<ScanTone, 'loading'>; message: string } {
  if (result.kind === 'write_failed') return {
    tone: 'error',
    message: result.certainty === 'rejected'
      ? 'Could not save. Try again'
      : 'Could not save. Check the order before starting again',
  }
  const departments = [...new Set(result.blocked.map(ticket => departmentLabels[ticket.blockedByDepartment]))]
  return {
    tone: result.blocked.length ? 'error' : result.skippedWithoutTag ? 'warning' : 'success',
    message: `${result.advanced.length} advanced · ${result.blocked.length} blocked · ${result.skippedWithoutTag} skipped without tag`
      + (departments.length ? ` · Blocked by ${departments.join(', ')}` : ''),
  }
}

export function createTagScanGuard() {
  const inFlight = new Set<string>()
  return async (tag: string, task: () => Promise<void>): Promise<boolean> => {
    if (inFlight.has(tag)) return false
    inFlight.add(tag)
    try {
      await task()
      return true
    } finally {
      inFlight.delete(tag)
    }
  }
}
