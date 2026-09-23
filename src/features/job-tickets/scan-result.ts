import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketScanResult } from '@/data/job-tickets/job-ticket.service'
import type { FeedbackOutcome } from '@/shared/utils/scan-feedback'

export type ScanTone = 'loading' | 'success' | 'warning' | 'error'

export function feedbackOutcomeForScanResult(result: JobTicketScanResult): FeedbackOutcome {
  return result.kind === 'advanced' ? 'success' : 'failure'
}

const departmentLabels: Record<z.infer<typeof jobTicketDepartmentSchema>, string> = {
  Tagging: 'Tagging',
  Washing: 'Washing',
  DryCleaning: 'Dry Cleaning',
  Ironing: 'Ironing',
  Packaging: 'Packaging',
  Logistics: 'Logistics',
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
