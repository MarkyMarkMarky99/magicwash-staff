export const ISSUE_REPORT_STATUS_OPTIONS = [
  { value: 'OPEN', label: 'เปิด' },
  { value: 'IN_PROGRESS', label: 'กำลังแก้ไข' },
  { value: 'RESOLVED', label: 'แก้ไขแล้ว' },
  { value: 'CLOSED', label: 'ปิด' },
] as const

export const ISSUE_REPORT_TABS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  ...ISSUE_REPORT_STATUS_OPTIONS.map((option) => ({ key: option.value, label: option.label })),
]

type BadgeTone = 'neutral' | 'brand' | 'accent' | 'info' | 'warning' | 'success' | 'danger'

const ISSUE_REPORT_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'เปิด', tone: 'info' },
  IN_PROGRESS: { label: 'กำลังแก้ไข', tone: 'warning' },
  RESOLVED: { label: 'แก้ไขแล้ว', tone: 'success' },
  CLOSED: { label: 'ปิด', tone: 'neutral' },
}

export function issueReportStatusBadge(status: string): { label: string; tone: BadgeTone } {
  return ISSUE_REPORT_STATUS_BADGE[status] ?? { label: status || 'ไม่ทราบสถานะ', tone: 'neutral' }
}
