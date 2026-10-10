import { z } from 'zod'
import { parseWeightKg, MAX_ORDER_IMAGE_WEIGHT_KG } from '../../shared/utils/item-quantity.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const washQueueStatusSchema = z.enum(['Pending', 'In Progress', 'Completed', 'Collected', 'Cancelled'])
export const washQueueTagCodes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const washQueueActionSchema = z.enum(['load', 'unload', 'collect', 'cancel'])
const weightKgSchema = z.number().refine((value) => parseWeightKg(String(value)) !== null, {
  message: `Weight must be positive, at most ${MAX_ORDER_IMAGE_WEIGHT_KG} kg, with at most one decimal place.`,
})

const stepProductsSchema = z.array(z.string().trim().min(1)).max(10)
  .refine((products) => new Set(products).size === products.length, 'Products must be unique within a step.')
export const washStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stain_removal'), products: stepProductsSchema }).strict(),
  z.object({ type: z.enum(['quick_wash', 'normal_wash']), products: stepProductsSchema, temperature: z.enum(['cold', '40', '60']) }).strict(),
  z.object({ type: z.literal('rinse'), products: stepProductsSchema }).strict(),
  z.object({ type: z.literal('soak'), products: stepProductsSchema, duration: z.union([z.number().int().min(1).max(720), z.literal('overnight')]) }).strict(),
])
export const washOptionsSchema = z.object({
  program: z.string().trim().min(1), steps: z.array(washStepSchema).min(1).max(20),
}).strict()

export const washQueueCreateSchema = z.object({
  machineId: z.string().trim().min(1),
  photoUrl: z.string().trim().min(1),
  washOptions: washOptionsSchema.nullable(),
  instruction: z.string().nullable().optional(),
  weightBeforeKg: weightKgSchema,
  tagCode: z.string().trim().regex(/^[A-Z]$/, 'Choose a tag from A to Z.'),
}).strict()
export const washQueueUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['load', 'collect', 'cancel']) }).strict(),
  z.object({
    action: z.literal('unload'),
    weightAfterKg: weightKgSchema,
    unloadPhotoUrl: z.string().trim().min(1),
  }).strict(),
])
export const washQueueRowSchema = z.object({
  id: z.string(),
  status: washQueueStatusSchema,
  photoUrl: z.string(),
  washOptions: washOptionsSchema.nullable(),
  instruction: z.string().nullable(),
  workMinutes: z.number().nullable(),
  loadedAt: z.string().nullable(),
  loadedBy: z.string().nullable(),
  unloadedAt: z.string().nullable(),
  unloadedBy: z.string().nullable(),
  collectedAt: z.string().nullable(),
  collectedBy: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelledBy: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  weightBeforeKg: z.number().nullable(),
  weightAfterKg: z.number().nullable(),
  unloadPhotoUrl: z.string().nullable(),
  machineId: z.string().nullable(),
  tagCode: z.string().nullable(),
})

export const washQueueApiContract = {
  query: { list: z.object({}) },
  request: { create: washQueueCreateSchema, update: washQueueUpdateSchema },
  response: {
    list: washQueueRowSchema,
    create: washQueueRowSchema,
    update: washQueueRowSchema,
  },
} satisfies ModuleApiContract
