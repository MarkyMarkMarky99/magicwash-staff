import { z, type ZodType, type ZodTypeDef } from 'zod'
import { ApiError } from '../http/api-error'
import { parseOrThrow } from '../http/validate'
import { apiPaginationMetaSchema } from '../../../contracts/shared/api.schema'
import type { ApiQueryParams } from '../http/api-handler'
import type {
  Coalesced,
  ResourceRepository,
  SheetDbSchemas,
  SheetListFilter,
} from './sheet-crud.types'
import { makeFieldResolver, type FieldFor, type SheetDtoFor } from './sheet-naming'

// ── The API contract bundle ──────────────────────────────────────────────────

/**
 * The module's contract with the frontend, declared in its
 * `<m>-api.schema.ts`: request/query schemas plus one response schema per
 * representation. Response schemas are the source of truth for projection —
 * their field names (camelCase twins of row columns) decide which columns
 * each DTO exposes. They are NOT runtime-validated on reads (legacy sheet
 * data is dirty by decision); their truthfulness against the row is enforced
 * at compile time instead.
 */
export interface SheetApiSchemas<TFilter, TCreateInput, TUpdateInput, TListDto, TDetailDto> {
  listQuery: ZodType<TFilter, ZodTypeDef, unknown>
  createRequest: ZodType<TCreateInput, ZodTypeDef, unknown>
  updateRequest: ZodType<TUpdateInput, ZodTypeDef, unknown>
  listResponse: ZodType<TListDto, ZodTypeDef, unknown> & {
    shape: Record<keyof TListDto & string, unknown>
  }
  detailResponse: ZodType<TDetailDto, ZodTypeDef, unknown> & {
    shape: Record<keyof TDetailDto & string, unknown>
  }
}

// ── Contract completeness checks ─────────────────────────────────────────────
//
// The api and db bundles are independent declarations bound by the naming
// convention; everything that could silently drift between them (or against
// the stored row) is a compile error surfaced on the config property.

/** `unknown` when TProblem is empty; otherwise an unsatisfiable error property. */
type RequireEmpty<TMessage extends string, TProblem> = [TProblem] extends [never]
  ? unknown
  : { [K in TMessage]: TProblem }

/** Payload columns that don't exist in the stored row. */
export type PayloadColumnsNotInRow<TRow, TPayload> = Exclude<
  keyof TPayload & string,
  keyof TRow & string
>

/** Payload columns whose declared type cannot be stored in the row's cell. */
export type PayloadColumnsNotStorable<TRow, TPayload> = {
  [C in keyof TPayload & keyof TRow & string]: Exclude<TPayload[C], undefined> extends TRow[C]
    ? never
    : C
}[keyof TPayload & keyof TRow & string]

/** Row columns the field map omits, or map keys that aren't real columns. */
export type FieldMapColumnsMismatch<TRow extends object, TFieldMap> =
  | Exclude<keyof TRow & string, keyof TFieldMap & string>
  | Exclude<keyof TFieldMap & string, keyof TRow & string>

/** Append fills every payload column; absent optional input becomes null. */
export type UnfillableCreateColumns<TFieldMap, TPayload, TInput> = {
  [C in keyof TPayload & string]: FieldFor<TFieldMap, C> extends keyof TInput
    ? Coalesced<TInput[FieldFor<TFieldMap, C> & keyof TInput]> extends TPayload[C]
      ? never
      : C
    : C
}[keyof TPayload & string]

/** Update is PATCH: only defined input fields are sent, so undefined means "skipped". */
export type UnfillableUpdateColumns<TFieldMap, TPayload, TInput> = {
  [C in keyof TPayload & string]: FieldFor<TFieldMap, C> extends keyof TInput
    ? Exclude<TInput[FieldFor<TFieldMap, C> & keyof TInput], undefined> extends Exclude<
        TPayload[C],
        undefined
      >
      ? never
      : C
    : C
}[keyof TPayload & string]

/** Input fields whose mapped column is not in the payload schema. */
export type DroppedInputFields<TFieldMap, TInput, TPayload> = Exclude<
  keyof TInput & string,
  FieldFor<TFieldMap, keyof TPayload & string>
>

/** The whole row seen through the field map (every column, renamed to its API field). */
type ProjectedRow<TRow extends object, TFieldMap> = SheetDtoFor<TRow, TFieldMap>

/** Response fields with no backing row column. */
export type UnbackedResponseFields<TRow extends object, TDto, TFieldMap> = Exclude<
  keyof TDto & string,
  keyof ProjectedRow<TRow, TFieldMap>
>

/**
 * Response fields whose declared type the cell cannot guarantee — e.g. a
 * non-null `address` over a nullable Address column. Forces response schemas
 * to be honest about nullability without any runtime cost.
 */
export type UntruthfulResponseFields<TRow extends object, TDto, TFieldMap> = {
  [F in keyof TDto & keyof ProjectedRow<TRow, TFieldMap> & string]: ProjectedRow<
    TRow,
    TFieldMap
  >[F] extends TDto[F]
    ? never
    : F
}[keyof TDto & keyof ProjectedRow<TRow, TFieldMap> & string]

/** sortBy values that are not the mapped API field of any row column. */
export type UnsortableFields<
  TRow extends object,
  TFilter extends SheetListFilter,
  TFieldMap,
> = Exclude<TFilter['sortBy'], FieldFor<TFieldMap, keyof TRow & string>>

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Per-method interceptors — the only imperative surface of a simple module.
 * `before` transforms what goes out to the repository (filter / action
 * payload), `after` transforms the DTO(s) before they go back to the client;
 * both may throw ApiError. Exactly one of each per method — needing more means
 * the module has outgrown the engine and should get its own service. `after`
 * hooks are business processing only; presentation stays in frontend mappers.
 */
export interface SheetHooks<
  TRow,
  TFilter,
  TCreateInput,
  TUpdateInput,
  TAppendPayload,
  TUpdatePayload,
  TListDto,
  TDetailDto,
> {
  list?: {
    before?: (filter: TFilter) => TFilter
    after?: (items: TListDto[]) => TListDto[]
  }
  get?: {
    before?: (id: string) => string
    after?: (dto: TDetailDto) => TDetailDto
  }
  create?: {
    before?: (payload: TAppendPayload, input: TCreateInput) => TAppendPayload
    after?: (dto: TDetailDto) => TDetailDto
  }
  update?: {
    before?: (
      payload: TUpdatePayload,
      context: { input: TUpdateInput; current: TRow },
    ) => TUpdatePayload
    after?: (dto: TDetailDto) => TDetailDto
  }
}

// ── Service surface ──────────────────────────────────────────────────────────

export interface SheetListResult<TListDto> {
  items: TListDto[]
  pagination: z.infer<typeof apiPaginationMetaSchema>
}

export interface SheetService<TListDto, TDetailDto> {
  list(rawQuery: ApiQueryParams): Promise<SheetListResult<TListDto>>
  getById(id: string): Promise<TDetailDto>
  create(rawInput: unknown): Promise<TDetailDto>
  update(id: string, rawInput: unknown): Promise<TDetailDto>
}

export interface SheetServiceConfig<
  TRow extends object,
  TFilter extends SheetListFilter,
  TCreateInput,
  TUpdateInput,
  TAppendPayload extends object,
  TUpdatePayload extends object,
  TListDto extends object,
  TDetailDto extends object,
  TFieldMap extends Record<keyof TRow & string, string>,
> {
  /** Resource name used in error messages, e.g. 'Appointment'. */
  resourceName: string
  /** Any {@link ResourceRepository} — the service never sees transport detail. */
  repository: ResourceRepository<TRow, TFilter>
  /** The API ↔ frontend contract bundle (`<m>-api.schema.ts`). */
  api: SheetApiSchemas<TFilter, TCreateInput, TUpdateInput, TListDto, TDetailDto> &
    RequireEmpty<
      'ERROR: these listResponse fields have no backing row column, or claim a type the cell cannot guarantee (nullability must be honest)',
      | UnbackedResponseFields<TRow, TListDto, TFieldMap>
      | UntruthfulResponseFields<TRow, TListDto, TFieldMap>
    > &
    RequireEmpty<
      'ERROR: these detailResponse fields have no backing row column, or claim a type the cell cannot guarantee (nullability must be honest)',
      | UnbackedResponseFields<TRow, TDetailDto, TFieldMap>
      | UntruthfulResponseFields<TRow, TDetailDto, TFieldMap>
    > &
    RequireEmpty<
      'ERROR: these sortBy values are not the mapped API field of any row column',
      UnsortableFields<TRow, TFilter, TFieldMap>
    >
  /** The API ↔ database contract bundle (`<m>-db.schema.ts`). */
  db: SheetDbSchemas<TRow, TAppendPayload, TUpdatePayload, TFieldMap> &
    RequireEmpty<
      'ERROR: the fieldMap must have exactly one entry per row column — these row columns are unmapped, or these map keys are not row columns',
      FieldMapColumnsMismatch<TRow, TFieldMap>
    > &
    RequireEmpty<
      'ERROR: these payload columns do not exist in the stored row, or declare a type the cell cannot store',
      | PayloadColumnsNotInRow<TRow, TAppendPayload>
      | PayloadColumnsNotStorable<TRow, TAppendPayload>
      | PayloadColumnsNotInRow<TRow, TUpdatePayload>
      | PayloadColumnsNotStorable<TRow, TUpdatePayload>
    > &
    RequireEmpty<
      'ERROR: the create request cannot fill these appendPayload columns',
      UnfillableCreateColumns<TFieldMap, TAppendPayload, TCreateInput>
    > &
    RequireEmpty<
      'ERROR: the update request cannot fill these updatePayload columns',
      UnfillableUpdateColumns<TFieldMap, TUpdatePayload, TUpdateInput>
    > &
    RequireEmpty<
      'ERROR: these create request fields land in no appendPayload column — their values would be silently dropped',
      DroppedInputFields<TFieldMap, TCreateInput, TAppendPayload>
    > &
    RequireEmpty<
      'ERROR: these update request fields land in no updatePayload column — their values would be silently dropped',
      DroppedInputFields<TFieldMap, TUpdateInput, TUpdatePayload>
    >
  hooks?: SheetHooks<
    TRow,
    TFilter,
    TCreateInput,
    TUpdateInput,
    TAppendPayload,
    TUpdatePayload,
    TListDto,
    TDetailDto
  >
}

/**
 * Assemble the API-side half of a simple module on top of a repository, from
 * two contract bundles: request validation, write payloads built and
 * validated per the db action schemas (hook output re-validated), stored-row
 * key check, pagination, and response projection driven by the api response
 * schemas.
 *
 * Contract with the DB layer: APPEND/UPDATE must respond with the full stored
 * row (including db-generated cells) in `data` — the service checks it has
 * every `db.row` column and answers 500 if the contract is broken. Cell
 * VALUES are never validated, on writes or reads (legacy sheet data is dirty
 * by decision); response schemas constrain the contract at compile time only.
 */
export function createSheetService<
  TRow extends object,
  TFilter extends SheetListFilter,
  TCreateInput,
  TUpdateInput,
  TAppendPayload extends object,
  TUpdatePayload extends object,
  TListDto extends object,
  TDetailDto extends object,
  TFieldMap extends Record<keyof TRow & string, string>,
>(
  config: SheetServiceConfig<
    TRow,
    TFilter,
    TCreateInput,
    TUpdateInput,
    TAppendPayload,
    TUpdatePayload,
    TListDto,
    TDetailDto,
    TFieldMap
  >,
): SheetService<TListDto, TDetailDto> {
  const { resourceName, repository, api, db } = config
  const hooks = config.hooks ?? {}

  // ── Projection: response schema fields → row columns via the naming
  //    convention. (Casts in here only erase generics — the config mapped
  //    types already verified every field↔column pairing.) ──

  const rowColumns = Object.keys(db.row.shape) as Array<keyof TRow & string>

  // The explicit field map drives every column↔field translation, both
  // directions. (Cast erases the generic for the stringly runtime; the config
  // mapped types already verified the map is exact and well-typed.)
  const resolver = makeFieldResolver(db.fieldMap as Record<string, string>)

  const fieldToColumn = new Map<string, keyof TRow & string>()
  for (const column of rowColumns) {
    fieldToColumn.set(resolver.toField(column), column)
  }

  function projectorFor(shape: Record<string, unknown>, schemaName: string) {
    const pairs = Object.keys(shape).map((field) => {
      const column = fieldToColumn.get(field)
      if (!column) {
        // Unreachable past the compile-time check; fail loudly at import if forced.
        throw new Error(
          `${resourceName} ${schemaName} field '${field}' has no backing row column`,
        )
      }
      return [field, column] as const
    })
    return (row: TRow): Record<string, unknown> => {
      const dto: Record<string, unknown> = {}
      for (const [field, column] of pairs) {
        dto[field] = row[column]
      }
      return dto
    }
  }
  const projectListDto = projectorFor(api.listResponse.shape, 'listResponse')
  const projectDetailDto = projectorFor(api.detailResponse.shape, 'detailResponse')
  const toListDto = (row: TRow) => projectListDto(row) as TListDto
  const toDetailDto = (row: TRow) => projectDetailDto(row) as TDetailDto

  // ── Write payloads: built from the action schema's keys, then validated by
  //    that schema. The request schema already vetted the input, so a payload
  //    violation here is a contract bug (e.g. a runtime refinement the request
  //    schema doesn't mirror) — 500, not 422. ──

  const appendPairs = Object.keys(db.appendPayload.shape).map(
    (column) => [column, resolver.toField(column)] as const,
  )
  const updatePairs = Object.keys(db.updatePayload.shape).map(
    (column) => [column, resolver.toField(column)] as const,
  )

  function parsePayload<TPayload>(
    schema: ZodType<TPayload, ZodTypeDef, unknown>,
    draft: unknown,
    action: 'APPEND' | 'UPDATE',
  ): TPayload {
    const result = schema.safeParse(draft)
    if (!result.success) {
      throw ApiError.internal(
        `built ${action} payload violates the ${resourceName} db payload contract`,
        result.error.flatten(),
      )
    }
    return result.data
  }

  function buildAppendPayload(input: TCreateInput): TAppendPayload {
    const source = input as Record<string, unknown>
    const draft: Record<string, unknown> = {}
    for (const [column, field] of appendPairs) {
      draft[column] = source[field] ?? null
    }
    return parsePayload(db.appendPayload, draft, 'APPEND')
  }

  function buildUpdatePayload(input: TUpdateInput): TUpdatePayload {
    const source = input as Record<string, unknown>
    const draft: Record<string, unknown> = {}
    for (const [column, field] of updatePairs) {
      const value = source[field]
      if (value !== undefined) {
        draft[column] = value
      }
    }
    return parsePayload(db.updatePayload, draft, 'UPDATE')
  }

  /**
   * The DB layer must answer APPEND/UPDATE with the full stored row — checked
   * by KEY COMPLETENESS only. Cell values flow through unvalidated, by the
   * same decision as reads: a legacy row with dirty cells elsewhere must not
   * turn a successful write into a 500.
   */
  function requireStoredRow(stored: unknown, action: 'create' | 'update'): TRow {
    const missingColumns =
      typeof stored === 'object' && stored !== null
        ? rowColumns.filter((column) => !(column in stored))
        : rowColumns
    if (missingColumns.length > 0) {
      throw ApiError.internal(
        `Apps Script ${action} did not return the stored ${resourceName} row — ` +
          'the DB layer must respond with the full written row (including db-generated cells)',
        { missingColumns },
      )
    }
    // Cast: key completeness verified above; values are intentionally not validated.
    return stored as TRow
  }

  return {
    async list(rawQuery) {
      let filter = parseOrThrow(api.listQuery, rawQuery)
      filter = hooks.list?.before?.(filter) ?? filter

      const rows = await repository.findByFilter(filter)

      // The repository filters/sorts but does not page; slice in memory.
      const total = rows.length
      const start = (filter.page - 1) * filter.perPage

      let items = rows.slice(start, start + filter.perPage).map(toListDto)
      items = hooks.list?.after?.(items) ?? items

      return {
        items,
        pagination: {
          total,
          page: filter.page,
          perPage: filter.perPage,
          totalPages: Math.ceil(total / filter.perPage),
        },
      }
    },

    async getById(id) {
      const lookupId = hooks.get?.before?.(id) ?? id
      const row = await repository.findById(lookupId)
      if (!row) {
        throw ApiError.notFound(`${resourceName} '${lookupId}' not found`)
      }
      const dto = toDetailDto(row)
      return hooks.get?.after?.(dto) ?? dto
    },

    async create(rawInput) {
      const input = parseOrThrow(api.createRequest, rawInput)

      let payload = buildAppendPayload(input)
      const beforeCreate = hooks.create?.before
      if (beforeCreate) {
        // The payload schema is the exact wire contract, hook output included.
        payload = parsePayload(db.appendPayload, beforeCreate(payload, input), 'APPEND')
      }

      // Cast: payload ⊆ row is proven by the PayloadColumnsNotInRow/NotStorable checks.
      const stored = await repository.append(payload as unknown as Partial<TRow>)
      const dto = toDetailDto(requireStoredRow(stored, 'create'))
      return hooks.create?.after?.(dto) ?? dto
    },

    async update(id, rawInput) {
      const input = parseOrThrow(api.updateRequest, rawInput)

      const current = await repository.findById(id)
      if (!current) {
        throw ApiError.notFound(`${resourceName} '${id}' not found`)
      }

      let payload = buildUpdatePayload(input)
      const beforeUpdate = hooks.update?.before
      if (beforeUpdate) {
        // The payload schema is the exact wire contract, hook output included.
        payload = parsePayload(db.updatePayload, beforeUpdate(payload, { input, current }), 'UPDATE')
      }

      // Cast: payload ⊆ row is proven by the PayloadColumnsNotInRow/NotStorable checks.
      const stored = await repository.update(id, payload as unknown as Partial<TRow>)
      const dto = toDetailDto(requireStoredRow(stored, 'update'))
      return hooks.update?.after?.(dto) ?? dto
    },
  }
}
