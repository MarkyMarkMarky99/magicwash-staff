import type { z } from 'zod'
import { attendanceApiContract, attendanceDayOffSchema } from '@contracts/attendance/attendance-api.schema'
import { apiGet, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type AttendanceDto = z.infer<typeof attendanceApiContract.response.list>
type AttendanceDayOffInput = z.infer<typeof attendanceDayOffSchema>

const ENDPOINT = '/api/attendance'

export function listAttendance(week: string): Promise<AttendanceDto[]> {
  const query = attendanceApiContract.query.list.parse({ week })
  return apiGet<AttendanceDto[]>(`${ENDPOINT}?${new URLSearchParams(query)}`)
}

export async function bookAttendanceDayOff(payload: AttendanceDayOffInput): Promise<AttendanceDto> {
  try {
    return await apiPost<AttendanceDto>(`${ENDPOINT}/day-off`, {
      data: payload,
      requestSchema: attendanceDayOffSchema,
    })
  } finally {
    invalidate(ENDPOINT)
  }
}
