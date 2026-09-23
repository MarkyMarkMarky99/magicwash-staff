import type { z } from 'zod'
import type { jobTicketDepartmentSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { JobTicketScanResult } from '@/data/job-tickets/job-ticket.service'
import type { FeedbackOutcome } from '@/shared/utils/scan-feedback'

export type ScanTone = 'loading' | 'success' | 'warning' | 'error'

export function feedbackOutcomeForScanResult(result: JobTicketScanResult): FeedbackOutcome {
  return result.kind === 'advanced' ? 'success' : 'failure'
}

const departmentLabels: Record<z.infer<typeof jobTicketDepartmentSchema>, string> = {
  Tagging: 'ติดแท็ก',
  Washing: 'ซัก',
  DryCleaning: 'ซักแห้ง',
  Ironing: 'รีด',
  Packaging: 'แพ็ก',
  Logistics: 'ขนส่ง',
}

const statusLabels: Record<Extract<JobTicketScanResult, { kind: 'not_advanceable' }>['status'], string> = {
  Pending: 'รอดำเนินการ',
  'In Progress': 'กำลังดำเนินการ',
  Completed: 'เสร็จแล้ว',
  Cancelled: 'ยกเลิก',
}

export function presentScanResult(result: JobTicketScanResult): { tone: Exclude<ScanTone, 'loading'>; message: string } {
  switch (result.kind) {
    case 'advanced':
      return { tone: 'success', message: result.status === 'In Progress' ? 'รับงานแล้ว' : 'เสร็จแล้ว' }
    case 'already_completed':
      return { tone: 'warning', message: 'งานนี้เสร็จไปแล้ว' }
    case 'blocked':
      return { tone: 'error', message: `ยังทำไม่ได้: แผนก ${departmentLabels[result.blockedByDepartment]} ยังไม่เสร็จ` }
    case 'not_found':
      return { tone: 'error', message: 'ไม่พบงานของแท็กนี้ในแผนกนี้' }
    case 'not_advanceable':
      return { tone: 'error', message: `ยังดำเนินการไม่ได้: สถานะ ${statusLabels[result.status]}` }
    case 'write_failed':
      return { tone: 'error', message: result.certainty === 'unknown'
        ? 'บันทึกไม่สำเร็จ กรุณาตรวจสอบก่อนสแกนซ้ำ'
        : 'บันทึกไม่สำเร็จ' }
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
