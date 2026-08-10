/**
 * ReadQueryDTO — the Service -> Repository read contract.
 *
 * Data-only and immutable. It speaks API/domain field names; the repository maps
 * them to DB columns. It does NOT map DB columns, build GViz/SQL query strings,
 * or support operation/range/null/or filters.
 *
 * `fromQuery()` convention (generic simple-CRUD list queries only):
 *   - reserved fields (keyword, page, perPage, sortBy, sortOrder) drive
 *     search / sort / pagination;
 *   - every OTHER list-query field becomes a `where` equality filter, so each
 *     must be a DB-backed filter field (the repository resolves it to a column);
 *   - null / undefined / '' where values are preserved here — the repository
 *     decides which ones to ignore.
 *
 * The subtype shapes below are the single source of truth; the repository layer
 * imports them from here.
 */

export interface ReadQuerySearch {
  keyword: string
  fields: readonly string[]
}

export interface ReadQuerySort {
  field: string
  order: 'asc' | 'desc'
}

export interface ReadQueryPagination {
  page: number
  perPage: number
}

export type GenericListQuery = {
  keyword: string
  page: number
  perPage: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// Single source of truth for the reserved control fields: both the runtime strip
// in fromQuery() and the OmitReservedQueryFields type derive from this list, so
// they can never drift.
const RESERVED_QUERY_FIELDS = ['keyword', 'page', 'perPage', 'sortBy', 'sortOrder'] as const

type ReservedQueryField = (typeof RESERVED_QUERY_FIELDS)[number]

export type OmitReservedQueryFields<TQuery> = Omit<TQuery, ReservedQueryField>

export interface ReadQueryDTOInput<TWhere> {
  id?: string
  where?: TWhere
  select?: readonly string[]
  search?: ReadQuerySearch
  sort?: ReadQuerySort
  pagination?: ReadQueryPagination
}

export class ReadQueryDTO<TWhere> {
  readonly id?: string
  readonly where?: TWhere
  readonly select?: readonly string[]
  readonly search?: ReadQuerySearch
  readonly sort?: ReadQuerySort
  readonly pagination?: ReadQueryPagination

  constructor(input: ReadQueryDTOInput<TWhere>) {
    this.id = input.id
    this.where = input.where
    this.select = input.select
    this.search = input.search
    this.sort = input.sort
    this.pagination = input.pagination
  }

  /**
   * Validated list query -> ReadQueryDTO. Reserved fields map to
   * search / sort / pagination; every other field becomes a `where` equality
   * filter. `searchFields` are the API/domain fields the keyword matches.
   *
   * Preconditions (the module list-query schema must guarantee them):
   *   - sortBy is validated/defaulted to a real sortable field (the DTO does not
   *     validate it; an empty/unknown sortBy is a module-schema bug);
   *   - the schema does not `.passthrough()` unknown keys (they would leak into
   *     `where` and fail to resolve to a column).
   */
  static fromQuery<TQuery extends GenericListQuery>(
    query: TQuery,
    searchFields: readonly string[],
  ): ReadQueryDTO<OmitReservedQueryFields<TQuery>> {
    // Type-level Omit has no runtime form; strip the reserved keys using the same
    // RESERVED_QUERY_FIELDS list the type is derived from.
    const where = { ...query }
    for (const field of RESERVED_QUERY_FIELDS) {
      delete (where as Record<string, unknown>)[field]
    }

    return new ReadQueryDTO<OmitReservedQueryFields<TQuery>>({
      where: where as OmitReservedQueryFields<TQuery>,
      search: { keyword: query.keyword, fields: searchFields },
      sort: { field: query.sortBy, order: query.sortOrder },
      pagination: { page: query.page, perPage: query.perPage },
    })
  }

  /**
   * Semantic id -> ReadQueryDTO. Assumes the caller already validated and
   * trimmed a non-empty id (BaseCrudService.requireId). Call with the read where
   * type explicit, e.g. `ReadQueryDTO.fromId<TReadWhere>(id)`.
   */
  static fromId<TWhere>(id: string): ReadQueryDTO<TWhere> {
    return new ReadQueryDTO<TWhere>({ id })
  }
}
