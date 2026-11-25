import { z } from 'zod'

export const AGENT_CARD_ROUTES = {
  'order-detail': ['orderId'],
  'invoice-detail': ['invoiceNumber'],
  'customer-detail': ['customerId'],
  'laundry-item-detail': ['tagId'],
  'customer-package-detail': ['customerPackageId'],
  'appointment-schedule': [],
} as const

type AgentCardRoute = keyof typeof AGENT_CARD_ROUTES

const toneSchema = z.enum(['default', 'muted', 'primary', 'success', 'warning', 'error'])
const photoActionSchema = z.object({ type: z.literal('photo') })
const routeActionSchema = z.object({
  type: z.literal('route'),
  route: z.enum(Object.keys(AGENT_CARD_ROUTES) as [AgentCardRoute, ...AgentCardRoute[]]),
  // Zod omits __proto__ when assembling a record, so reject it before checking the parsed keys.
  params: z.record(z.string().refine(key => key !== '__proto__'), z.string().min(1).max(80)),
})
const messageActionSchema = z.object({
  type: z.literal('message'),
  text: z.string().min(1).max(200),
})

const buttonActionSchema = z.discriminatedUnion('type', [routeActionSchema, messageActionSchema])
  .refine(action => {
    if (action.type === 'message') return true

    const requiredParams = AGENT_CARD_ROUTES[action.route]
    return Object.keys(action.params).length === requiredParams.length
      && requiredParams.every(key => Object.hasOwn(action.params, key))
  }, { path: ['params'], message: 'Params must match the route' })

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(2000),
  size: z.enum(['sm', 'md', 'lg', 'xl']).nullish(),
  weight: z.enum(['regular', 'bold']).nullish(),
  tone: toneSchema.nullish(),
  maxLines: z.number().int().min(1).max(10).nullish(),
})

const badgePartSchema = z.object({
  type: z.literal('badge'),
  text: z.string().min(1).max(20),
  tone: toneSchema.nullish(),
})

const separatorPartSchema = z.object({ type: z.literal('separator') })

const firebasePhotoUrlSchema = z.string().refine(value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.host === 'firebasestorage.googleapis.com'
      && !url.username && !url.password
  } catch {
    return false
  }
}, { message: 'Expected an HTTPS Firebase Storage URL without credentials' })

const imagePartSchema = z.object({
  type: z.literal('image'),
  source: z.object({ url: firebasePhotoUrlSchema }),
  aspect: z.enum(['square', 'wide', 'tall']).nullish(),
  alt: z.string().max(120).nullish(),
  action: photoActionSchema.nullish(),
})

const buttonPartSchema = z.object({
  type: z.literal('button'),
  label: z.string().min(1).max(30),
  style: z.enum(['primary', 'secondary', 'link']).nullish(),
  action: buttonActionSchema,
})

const tablePartSchema = z.object({
  type: z.literal('table'),
  columns: z.array(z.object({
    label: z.string().min(1).max(30),
    align: z.enum(['start', 'end']).nullish(),
  })).min(1).max(4),
  rows: z.array(z.array(z.string().max(200))).max(30),
})

const tableRowIssue = { path: ['rows'], message: 'Each row must match the number of columns' }
const leafPartSchemas = [
  textPartSchema, badgePartSchema, separatorPartSchema, imagePartSchema, buttonPartSchema, tablePartSchema,
] as const
const leafPartUnion = z.discriminatedUnion('type', leafPartSchemas)

function hasMatchingTableRows(part: z.infer<typeof leafPartUnion> | { type: 'box' }): boolean {
  return part.type !== 'table' || part.rows.every(row => row.length === part.columns.length)
}

const leafPartSchema = leafPartUnion.refine(hasMatchingTableRows, tableRowIssue)

const boxPartSchema = z.object({
  type: z.literal('box'),
  layout: z.enum(['row', 'column']),
  gap: z.enum(['none', 'sm', 'md']).nullish(),
  contents: z.array(leafPartSchema).min(1).max(8),
})

const bodyPartSchema = z.discriminatedUnion('type', [...leafPartSchemas, boxPartSchema])
  .refine(hasMatchingTableRows, tableRowIssue)

const bubbleSchema = z.object({
  type: z.literal('bubble'),
  title: z.string().min(1).max(40),
  tone: z.enum(['brand', 'warning']).nullish(),
  hero: imagePartSchema.nullish(),
  body: z.array(bodyPartSchema).min(1).max(30),
  footer: z.array(buttonPartSchema).max(3).nullish(),
})

const carouselSchema = z.object({
  type: z.literal('carousel'),
  contents: z.array(bubbleSchema).min(2).max(10),
})

export const agentCardSchema = z.discriminatedUnion('type', [bubbleSchema, carouselSchema])
  .refine(card => JSON.stringify(card).length <= 32768, { message: 'Serialized card exceeds 32768 characters' })
