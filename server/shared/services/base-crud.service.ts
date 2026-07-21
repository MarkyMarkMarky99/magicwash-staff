import type { BaseRepository } from '../repositories/base.repository.js'
import {
  ReadQueryDTO,
  type GenericListQuery,
  type OmitReservedQueryFields,
} from '../dtos/read-query.dto.js'
import { ApiError } from '../http/api-error.js'
import { parseOrThrow } from '../http/validate.js'
import type {
  ModuleApiContractOf,
  ResponseSchema,
} from '../../../contracts/shared/module-api-contract.js'

export interface ServiceListResult<TListResponse extends object> {
  items: TListResponse[]
  pagination: {
    page: number
    perPage: number
  }
}

// The read filter is DERIVED from the list query: ReadQueryDTO.fromQuery() maps
// every non-reserved list-query field into `where`, so the repository's read
// where type is exactly `OmitReservedQueryFields<TListQuery>`. There is no
// independent read-where generic and no module-written toReadQuery() bridge.
export interface BaseCrudServiceOptions<
  TApiRow extends object,
  TListQuery extends GenericListQuery,
  TCreate,
  TUpdate,
  TListResponse extends object,
  TDetailResponse extends object,
  TCreateResponse extends object,
  TUpdateResponse extends object,
> {
  repository: BaseRepository<TApiRow, OmitReservedQueryFields<TListQuery>, TCreate, TUpdate>

  /**
   * The module's nested API contract bundle. The service reads the request/query
   * schemas it validates against from `api.query` / `api.request`, and projects
   * each response by the matching `api.response.*` schema shape.
   */
  api: ModuleApiContractOf<
    TListQuery,
    TCreate,
    TUpdate,
    TListResponse,
    TDetailResponse,
    TCreateResponse,
    TUpdateResponse
  >

  /** API/domain fields the list keyword searches against (ReadQueryDTO.fromQuery). */
  searchFields: readonly string[]
}

export class BaseCrudService<
  TApiRow extends object,
  TListQuery extends GenericListQuery,
  TCreate,
  TUpdate,
  TListResponse extends object,
  TDetailResponse extends object,
  TCreateResponse extends object,
  TUpdateResponse extends object,
> {
  private readonly repository: BaseRepository<
    TApiRow,
    OmitReservedQueryFields<TListQuery>,
    TCreate,
    TUpdate
  >
  private readonly api: ModuleApiContractOf<
    TListQuery,
    TCreate,
    TUpdate,
    TListResponse,
    TDetailResponse,
    TCreateResponse,
    TUpdateResponse
  >
  private readonly searchFields: readonly string[]

  constructor(
    input: BaseCrudServiceOptions<
      TApiRow,
      TListQuery,
      TCreate,
      TUpdate,
      TListResponse,
      TDetailResponse,
      TCreateResponse,
      TUpdateResponse
    >,
  ) {
    this.repository = input.repository
    this.api = input.api
    this.searchFields = input.searchFields
  }

  async list(query: unknown): Promise<ServiceListResult<TListResponse>> {
    const validQuery = parseOrThrow(this.api.query.list, query)
    const readQuery = ReadQueryDTO.fromQuery(validQuery, this.searchFields)
    const rows = await this.repository.read(readQuery)

    return {
      items: rows.map((row) => this.project(row, this.api.response.list)),
      pagination: {
        page: validQuery.page,
        perPage: validQuery.perPage,
      },
    }
  }

  async getById(id: string): Promise<TDetailResponse> {
    const safeId = this.requireId(id)
    const rows = await this.repository.read(
      ReadQueryDTO.fromId<OmitReservedQueryFields<TListQuery>>(safeId),
    )
    const row = this.requireSingleRow(rows, safeId)
    return this.project(row, this.api.response.detail)
  }

  async create(payload: unknown): Promise<TCreateResponse> {
    const data = parseOrThrow(this.api.request.create, payload)
    const row = await this.repository.create(data)
    return this.project(row, this.api.response.create)
  }

  async update(id: string, payload: unknown): Promise<TUpdateResponse> {
    const safeId = this.requireId(id)
    const data = parseOrThrow(this.api.request.update, payload)

    const rows = await this.repository.read(
      ReadQueryDTO.fromId<OmitReservedQueryFields<TListQuery>>(safeId),
    )
    this.requireSingleRow(rows, safeId)

    const row = await this.repository.update(safeId, data)
    return this.project(row, this.api.response.update)
  }

  private requireId(id: string): string {
    const safeId = id.trim()
    if (safeId === '') {
      throw ApiError.badRequest('id is required')
    }
    return safeId
  }

  private requireSingleRow(rows: Array<Partial<TApiRow>>, id: string): Partial<TApiRow> {
    if (rows.length === 0) {
      throw ApiError.notFound(`Resource '${id}' not found`)
    }
    if (rows.length > 1) {
      throw ApiError.conflict(`Resource '${id}' resolved to multiple rows`)
    }
    return rows[0]
  }

  private project<TResponse extends object>(
    row: Partial<TApiRow>,
    schema: ResponseSchema<TResponse>,
  ): TResponse {
    const source = row as Record<string, unknown>
    const output: Record<string, unknown> = {}

    for (const field of Object.keys(schema.shape)) {
      output[field] = source[field]
    }

    return output as TResponse
  }
}
