import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketScanResult, JobTicketStartOrderResult } from '@/data/job-tickets/job-ticket.service'
import type { FeedbackOutcome } from '@/shared/utils/scan-feedback'

export type ScanTone = 'loading' | 'success' | 'warning' | 'error'
export type ScanDisplay = { title: string; orderId?: string; customerName?: string; status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'; message: string; tone: ScanTone }

export function feedbackOutcomeForScanResult(result: JobTicketScanResult): FeedbackOutcome {
  return result.kind === 'advanced' ? 'success' : 'failure'
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

const statusLabels: Record<Extract<JobTicketScanResult, { kind: 'not_advanceable' }>['status'], string> = {
  Pending: 'Pending',
  'In Progress': 'In Progress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}

export function presentScanResult(result: JobTicketScanResult): { tone: Exclude<ScanTone, 'loading'>; message: string } {
  switch (result.kind) {
    case 'advanced':
      return { tone: 'success', message: result.status === 'In Progress' ? 'Job started' : 'Completed' }
    case 'already_completed':
      return { tone: 'warning', message: 'This job is already completed' }
    case 'blocked':
      return { tone: 'error', message: `Cannot proceed: ${departmentLabels[result.blockedByDepartment]} is not completed` }
    case 'not_found':
      return { tone: 'error', message: 'No job found for this tag in this department' }
    case 'ambiguous':
      return { tone: 'error', message: `This tag has ${result.taskCodes.length} tasks in this department (${result.taskCodes.map(code => code ?? 'no task').join(', ')}). Choose the task instead of scanning` }
    case 'not_advanceable':
      return { tone: 'error', message: `Cannot proceed with status ${statusLabels[result.status]}` }
    case 'write_failed':
      return { tone: 'error', message: result.certainty === 'unknown'
        ? 'Could not save. Check the job before scanning again'
        : 'Could not save' }
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
