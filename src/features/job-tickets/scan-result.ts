import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketStartOrderResult } from '@/data/job-tickets/job-ticket.service'

export type ScanTone = 'loading' | 'success' | 'warning' | 'error'
export type ScanDisplay = { title: string; orderId?: string; customerName?: string; status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'; message: string; tone: ScanTone }

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
