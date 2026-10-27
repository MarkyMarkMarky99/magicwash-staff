import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const attendanceStatusSchema = z.enum(['DAY_OFF', 'LEAVE', 'ABSENT'])
export const attendanceWorkDateSchema = z.string().date()

export const attendanceListQuerySchema = z.object({ week: attendanceWorkDateSchema }).strict()
export const attendanceDayOffSchema = z.object({ workDate: attendanceWorkDateSchema }).strict()
export const attendanceCreateSchema = z.object({
  staffId: z.string().trim().min(1),
  workDate: attendanceWorkDateSchema,
  status: attendanceStatusSchema,
  notes: z.string().nullable().optional(),
}).strict()
export const attendanceUpdateSchema = attendanceCreateSchema.omit({ staffId: true }).partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'At least one of workDate, status or notes is required',
  })

export const attendanceResponseSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  workDate: attendanceWorkDateSchema,
  status: attendanceStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
})

export const attendanceApiContract = {
  query: { list: attendanceListQuerySchema },
  request: { create: attendanceCreateSchema, update: attendanceUpdateSchema },
  response: {
    list: attendanceResponseSchema,
    create: attendanceResponseSchema,
    update: attendanceResponseSchema,
  },
} satisfies ModuleApiContract
