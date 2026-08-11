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
 * Only API-facing (camelCase) schemas live here — never DB shape. Physical-sheet
 * DB contracts live with their sheets under `server/sheets/<Sheet>/`.
 *
 * Write/detail slots are optional so list-only modules (e.g. orders) can satisfy
 * the same type as full-CRUD modules without dummy schemas.
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

/** Structural guard: list query + list response required; write/detail slots optional. */
export type ModuleApiContract = {
  query: {
    list: ZodSchema
  }
  /** Present only for modules that expose create/update. When present, both slots are required. */
  request?: {
    create: ZodSchema
    update: ZodSchema
  }
  response: {
    list: AnyResponseSchema
    detail?: AnyResponseSchema
    create?: AnyResponseSchema
    update?: AnyResponseSchema
  }
}

/**
 * Type-parameterized API contract: each slot bound to its DTO type for inference.
 * Optional write/detail generics default to `never` so a list-only bundle infers
 * uncallable create/update/getById surfaces on BaseCrudService.
 */
export type ModuleApiContractOf<
  TListQuery,
  TCreate = never,
  TUpdate = never,
  TListResponse extends object = object,
  TDetailResponse extends object = never,
  TCreateResponse extends object = never,
  TUpdateResponse extends object = never,
> = {
  query: {
    list: ZodType<TListQuery, ZodTypeDef, unknown>
  }
  request?: {
    create: ZodType<TCreate, ZodTypeDef, unknown>
    update: ZodType<TUpdate, ZodTypeDef, unknown>
  }
  response: {
    list: ResponseSchema<TListResponse>
    detail?: ResponseSchema<TDetailResponse>
    create?: ResponseSchema<TCreateResponse>
    update?: ResponseSchema<TUpdateResponse>
  }
}
