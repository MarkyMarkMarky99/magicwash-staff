import { z } from 'zod'
import { jobTicketDepartmentSchema } from '../job-tickets/job-ticket-api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const staffRoleSchema = z.enum(['admin', 'staff', 'device'])
export const staffReadRoleSchema = z.enum([...staffRoleSchema.options, 'assistant'])

const startDateSchema = z.union([z.string().date(), z.literal('')])
const requiredTextSchema = z.string().trim().min(1)

export const staffSchema = z.object({
  staffId: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  role: staffReadRoleSchema.nullable(),
  position: z.string(),
  startDate: startDateSchema,
  departments: z.array(jobTicketDepartmentSchema),
  active: z.boolean(),
})

export const staffDirectoryEntrySchema = staffSchema.pick({
  staffId: true, name: true, role: true, active: true, departments: true,
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
  departments: z.array(jobTicketDepartmentSchema).transform((departments) =>
    jobTicketDepartmentSchema.options.filter((department) => departments.includes(department)),
  ).optional(),
  active: z.boolean().optional(),
}).strict().refine((body) => Object.values(body).some((value) => value !== undefined), {
  message: 'At least one field is required',
})

const staffResponses = { list: staffSchema, detail: staffSchema, create: staffSchema, update: staffSchema }

export const staffApiContract = {
  query: { list: z.object({}) },
  request: { create: registerStaffBodySchema, update: updateStaffBodySchema },
  response: staffResponses,
} satisfies ModuleApiContract

export const secretaryStaffIdSchema = z.string().trim().min(1)
export const updateStaffSecretaryBodySchema = z.object({ active: z.boolean() }).strict()
export const staffSecretarySchema = z.object({
  staffId: secretaryStaffIdSchema,
  assistantId: z.string(),
  exists: z.boolean(),
  active: z.boolean(),
})

export const staffSecretaryApiContract = {
  query: { list: z.never() },
  request: { create: z.never(), update: updateStaffSecretaryBodySchema },
  response: { list: staffSecretarySchema, detail: staffSecretarySchema, update: staffSecretarySchema },
} satisfies ModuleApiContract
