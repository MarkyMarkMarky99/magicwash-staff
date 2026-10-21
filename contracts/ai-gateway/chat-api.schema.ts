import { z } from 'zod'

const chatAgentIdSchema = z.enum(['register-customer', 'price-check'])

export const chatInputSchema = z.object({
  agentId: chatAgentIdSchema,
  message: z.string().max(4000),
  sessionId: z.string().optional(),
})

export const customerProposalSchema = z.object({
  customerName: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  lineId: z.string().nullable(),
  facebook: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  customerType: z.enum(['Member', 'Regular', 'Corporate']).nullable(),
  warnings: z.array(z.object({ field: z.string(), message: z.string() })),
})

export const priceProposalSchema = z.object({
  rows: z.array(z.object({
    itemCode: z.string(),
    name: z.string(),
    serviceType: z.enum(['WSIR', 'IRON', 'DRCL', 'WASH']),
    priceGroup: z.string(),
    unit: z.string().nullable(),
    price: z.number(),
  })),
})

export const chatResultSchema = z.object({
  agentId: chatAgentIdSchema,
  sessionId: z.string(),
  reply: z.string(),
  proposal: z.union([customerProposalSchema, priceProposalSchema]).nullable(),
  warnings: z.array(z.object({ field: z.string(), source: z.enum(['ai', 'rule']), message: z.string() })),
})
