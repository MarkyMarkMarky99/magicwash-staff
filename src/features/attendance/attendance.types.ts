import type { z } from 'zod'
import type { attendanceApiContract } from '@contracts/attendance/attendance-api.schema'

export type AttendanceRow = z.infer<typeof attendanceApiContract.response.list>
export type AttendanceStatus = AttendanceRow['status']
