import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const staffRoleSchema = z.enum(['admin', 'staff'])

const startDateSchema = z.union([z.string().date(), z.literal('')])
const requiredTextSchema = z.string().trim().min(1)

export const staffSchema = z.object({
  staffId: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  role: staffRoleSchema.nullable(),
  position: z.string(),
  startDate: startDateSchema,
  active: z.boolean(),
})

export const registerStaffBodySchema = z.object({
  name: requiredTextSchema,
  phone: requiredTextSchema,
  address: requiredTextSchema,
}).strict()

export const updateStaffBodySchema = z.object({
  name: requiredTextSchema.optional(),
  phone: requiredTextSchema.optional(),
  address: requiredTextSchema.optional(),
  role: staffRoleSchema.optional(),
  position: z.string().trim().optional(),
  startDate: startDateSchema.optional(),
  active: z.boolean().optional(),
}).strict().refine((body) => Object.values(body).some((value) => value !== undefined), {
  message: 'At least one field is required',
})

export const staffApiContract = {
  query: { list: z.object({}) },
  request: { create: registerStaffBodySchema, update: updateStaffBodySchema },
  response: { list: staffSchema, detail: staffSchema, create: staffSchema, update: staffSchema },
} satisfies ModuleApiContract
