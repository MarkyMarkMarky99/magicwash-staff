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
