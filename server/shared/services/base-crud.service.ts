import type { ZodType, ZodTypeDef } from 'zod'
import type { BaseRepository } from '../repositories/base.repository'
import {
  ReadQueryDTO,
  type GenericListQuery,
  type OmitReservedQueryFields,
} from '../dtos/read-query.dto'
import { ApiError } from '../http/api-error'
import { parseOrThrow } from '../http/validate'

type ResponseSchema<TResponse extends object> = ZodType<TResponse, ZodTypeDef, unknown> & {
  shape: Record<keyof TResponse & string, unknown>
}

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

  listQuerySchema: ZodType<TListQuery, ZodTypeDef, unknown>
  createSchema: ZodType<TCreate, ZodTypeDef, unknown>
  updateSchema: ZodType<TUpdate, ZodTypeDef, unknown>
  listResponseSchema: ResponseSchema<TListResponse>
  detailResponseSchema: ResponseSchema<TDetailResponse>
  createResponseSchema: ResponseSchema<TCreateResponse>
  updateResponseSchema: ResponseSchema<TUpdateResponse>

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
  private readonly listQuerySchema: ZodType<TListQuery, ZodTypeDef, unknown>
  private readonly createSchema: ZodType<TCreate, ZodTypeDef, unknown>
  private readonly updateSchema: ZodType<TUpdate, ZodTypeDef, unknown>
  private readonly listResponseSchema: ResponseSchema<TListResponse>
  private readonly detailResponseSchema: ResponseSchema<TDetailResponse>
  private readonly createResponseSchema: ResponseSchema<TCreateResponse>
  private readonly updateResponseSchema: ResponseSchema<TUpdateResponse>
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
    this.listQuerySchema = input.listQuerySchema
    this.createSchema = input.createSchema
    this.updateSchema = input.updateSchema
    this.listResponseSchema = input.listResponseSchema
    this.detailResponseSchema = input.detailResponseSchema
    this.createResponseSchema = input.createResponseSchema
    this.updateResponseSchema = input.updateResponseSchema
    this.searchFields = input.searchFields
  }

  async list(query: unknown): Promise<ServiceListResult<TListResponse>> {
    const validQuery = parseOrThrow(this.listQuerySchema, query)
    const readQuery = ReadQueryDTO.fromQuery(validQuery, this.searchFields)
    const rows = await this.repository.read(readQuery)

    return {
      items: rows.map((row) => this.project(row, this.listResponseSchema)),
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
    return this.project(row, this.detailResponseSchema)
  }

  async create(payload: unknown): Promise<TCreateResponse> {
    const data = parseOrThrow(this.createSchema, payload)
    const row = await this.repository.create(data)
    return this.project(row, this.createResponseSchema)
  }

  async update(id: string, payload: unknown): Promise<TUpdateResponse> {
    const safeId = this.requireId(id)
    const data = parseOrThrow(this.updateSchema, payload)

    const rows = await this.repository.read(
      ReadQueryDTO.fromId<OmitReservedQueryFields<TListQuery>>(safeId),
    )
    this.requireSingleRow(rows, safeId)

    const row = await this.repository.update(safeId, data)
    return this.project(row, this.updateResponseSchema)
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
