import type { ZodSchema } from 'zod'

/** Structural contract for list-only modules with no write or detail endpoint. */
export type ReadOnlyModuleApiContract = {
  query: {
    list: ZodSchema
  }
  response: {
    list: ZodSchema
  }
}
