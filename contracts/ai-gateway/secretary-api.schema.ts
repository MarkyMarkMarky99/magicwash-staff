import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const secretaryLanguageSchema = z.enum(['th', 'my', 'en'])
export const secretarySettingsQuerySchema = z.object({ staffId: z.string().trim().min(1) }).strict()
export const updateSecretarySettingsBodySchema = z.object({ language: secretaryLanguageSchema }).strict()
export const secretarySettingsSchema = secretarySettingsQuerySchema.extend({
  language: secretaryLanguageSchema,
  codexReady: z.boolean(),
})
export const secretarySettingsApiContract = {
  query: { list: secretarySettingsQuerySchema },
  request: { create: z.never(), update: updateSecretarySettingsBodySchema },
  response: { list: secretarySettingsSchema, detail: secretarySettingsSchema, update: secretarySettingsSchema },
} satisfies ModuleApiContract
