import type { ZodSchema, ZodType, ZodTypeDef } from 'zod'

/**
 * Shared module contract shapes — API side (the FE↔BE boundary).
 *
 * Every module exposes its API contract as one nested bundle with the same shape:
 * `query` / `request` / `response`, all camelCase. Two views exist:
 *   - `ModuleApiContract` — the structural guard a module's bundle is checked
 *     against with `satisfies`. Permissive on element types (any zod schema; a
 *     response must expose `.shape`) so the guard never fights zod's invariance.
 *   - `ModuleApiContractOf<...>` — the type-parameterized view the BaseCrudService
 *     consumes, so each slot keeps its precise DTO type for inference/projection.
 *
 * Only API-facing (camelCase) schemas live here — never DB shape. The DB-side
 * contract lives in `server/shared/contracts/module-db-contract.ts`.
 */

/**
 * A response schema drives projection: the service reads its `.shape` key set.
 * Parameterized by the exact DTO type so `ModuleApiContractOf` stays precise.
 */
export type ResponseSchema<TResponse extends object> = ZodType<TResponse, ZodTypeDef, unknown> & {
  shape: Record<keyof TResponse & string, unknown>
}

/** Any response schema, output type erased — used only by the structural guard. */
type AnyResponseSchema = ZodSchema & { shape: Record<string, unknown> }

/** Structural guard: a module's API bundle must have exactly these slots. */
export type ModuleApiContract = {
  query: {
    list: ZodSchema
  }
  request: {
    create: ZodSchema
    update: ZodSchema
  }
  response: {
    list: AnyResponseSchema
    detail: AnyResponseSchema
    create: AnyResponseSchema
    update: AnyResponseSchema
  }
}

/** Type-parameterized API contract: each slot bound to its DTO type for inference. */
export type ModuleApiContractOf<
  TListQuery,
  TCreate,
  TUpdate,
  TListResponse extends object,
  TDetailResponse extends object,
  TCreateResponse extends object,
  TUpdateResponse extends object,
> = {
  query: {
    list: ZodType<TListQuery, ZodTypeDef, unknown>
  }
  request: {
    create: ZodType<TCreate, ZodTypeDef, unknown>
    update: ZodType<TUpdate, ZodTypeDef, unknown>
  }
  response: {
    list: ResponseSchema<TListResponse>
    detail: ResponseSchema<TDetailResponse>
    create: ResponseSchema<TCreateResponse>
    update: ResponseSchema<TUpdateResponse>
  }
}
