import assert from 'node:assert/strict'
import {
  ISSUE_REPORT_STATUS_OPTIONS,
  ISSUE_REPORT_TABS,
} from '../../../../../../src/features/issue-reports/components/issue-report-status'

assert.deepEqual(ISSUE_REPORT_STATUS_OPTIONS, [
  { value: 'OPEN', label: 'เปิด' },
  { value: 'IN_PROGRESS', label: 'กำลังแก้ไข' },
  { value: 'RESOLVED', label: 'แก้ไขแล้ว' },
  { value: 'CLOSED', label: 'ปิด' },
])
assert.deepEqual(ISSUE_REPORT_TABS, [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'OPEN', label: 'เปิด' },
  { key: 'IN_PROGRESS', label: 'กำลังแก้ไข' },
  { key: 'RESOLVED', label: 'แก้ไขแล้ว' },
  { key: 'CLOSED', label: 'ปิด' },
])
assert.ok(
  ISSUE_REPORT_TABS.slice(1).every((tab, index) => tab.key === ISSUE_REPORT_STATUS_OPTIONS[index].value),
  'tab keys must be enum values from the shared status options',
)

console.log('issue-report status option dry tests passed')
