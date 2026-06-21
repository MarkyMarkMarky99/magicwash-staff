// Google Sheets implementation of BaseRepository.
// Owns all transport detail: GViz query strings + reads, Apps Script writes.
// Reference design: ./gsheet.contract.ts

import {
  BaseRepository,
  type FieldMap,
  type MappedReadQuery,
  type RepositoryRequest,
  type RepositoryTransformer,
} from './base.repository'
import type { ReadQueryDTO } from '../dtos/read-query.dto'
import {
  deriveGVizColumns,
  GVizQueryBuilder,
  type GSheetColumnMap,
  type GSheetRowSchema,
} from './utils/gviz-query.builder'

export type AppScriptAction = 'APPEND' | 'UPDATE'

export interface GVizFetchInput {
  query: string
}

export interface AppScriptRequestInput<TData = unknown> {
  action: AppScriptAction
  data: TData
}

export interface AppScriptRequest<TData = unknown> {
  action: AppScriptAction
  sheet: string
  data: TData
}

export interface AppScriptSuccessResponse<TData = unknown> {
  success: true
  data: TData
}

export interface AppScriptErrorResponse {
  success: false
  error: string
}

export type AppScriptResponse<TData = unknown> =
  | AppScriptSuccessResponse<TData>
  | AppScriptErrorResponse

export interface GSheetRepositoryOptions<TDbRow extends object = Record<string, unknown>> {
  sheetName: string
  spreadsheetId: string
  scriptUrl: string
  rowSchema: GSheetRowSchema & { shape: Record<keyof TDbRow & string, unknown> }
  /** API/domain field name of the primary key, e.g. `customerId`. */
  primaryKey: string
  fieldMap?: FieldMap
  transformer?: RepositoryTransformer
}

interface GVizCell {
  v: unknown
  f?: string
}

interface GVizColumn {
  id: string
  label?: string
  type?: string
}

interface GVizTable {
  cols: GVizColumn[]
  rows: { c: (GVizCell | null)[] }[]
}

interface GVizResponse {
  status: 'ok' | 'warning' | 'error'
  table?: GVizTable
  errors?: { message?: string; detailed_message?: string }[]
}

const GVIZ_BASE_URL = 'https://docs.google.com/spreadsheets/d'

export class GSheetRepository<
  TApiRow extends object,
  TDbRow extends object,
  TReadWhere,
  TCreate,
  TUpdate,
> extends BaseRepository<TApiRow, TReadWhere, TCreate, TUpdate> {
  private readonly sheetName: string
  private readonly spreadsheetId: string
  private readonly scriptUrl: string
  private readonly columns: GSheetColumnMap
  private readonly letterToField: Record<string, string>

  constructor(input: GSheetRepositoryOptions<TDbRow>) {
    super({
      fieldMap: input.fieldMap,
      primaryKey: input.primaryKey,
      transformer: input.transformer,
    })
    this.sheetName = input.sheetName
    this.spreadsheetId = input.spreadsheetId
    this.scriptUrl = input.scriptUrl
    this.columns = deriveGVizColumns(input.rowSchema)
    this.letterToField = invertColumns(this.columns)
  }

  protected async execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse> {
    switch (request.operation) {
      case 'read': {
        const rows = await this.readRows(
          request.query as MappedReadQuery<Record<string, unknown>> | undefined,
        )
        return rows as TResponse
      }
      case 'create': {
        const stored = await this.write('APPEND', request.data)
        return stored as TResponse
      }
      case 'update': {
        const stored = await this.write('UPDATE', this.buildUpdatePayload(request))
        return stored as TResponse
      }
      case 'delete':
        throw new Error('GSheetRepository.delete is not implemented yet')
      default:
        throw new Error(`Unsupported repository operation: ${request.operation}`)
    }
  }

  read(query?: ReadQueryDTO<TReadWhere>): Promise<Array<Partial<TApiRow>>> {
    return this.request<Array<Partial<TApiRow>>, ReadQueryDTO<TReadWhere>, never>({
      operation: 'read',
      query,
    })
  }

  create(data: TCreate): Promise<TApiRow> {
    return this.request<TApiRow, never, TCreate>({ operation: 'create', data })
  }

  update(id: string, data: TUpdate): Promise<TApiRow> {
    return this.request<TApiRow, { id: string }, TUpdate>({
      operation: 'update',
      query: { id },
      data,
    })
  }

  /** Future implementation. */
  async delete(_id: string): Promise<never> {
    throw new Error('GSheetRepository.delete is not implemented yet')
  }

  private async readRows(
    query: MappedReadQuery<Record<string, unknown>> | undefined,
  ): Promise<unknown[]> {
    const gvizQuery = GVizQueryBuilder.fromColumns(this.columns).fromQuery(query).build()
    return this.fetchGVizRows({ query: gvizQuery })
  }

  // doPost UPDATE contract: send only the patched fields, then pin the filter
  // (id) last so route id wins the merge.
  private buildUpdatePayload(request: RepositoryRequest<unknown, unknown>): Record<string, unknown> {
    const data = (request.data as Record<string, unknown> | undefined) ?? {}
    const where =
      (request.query as MappedReadQuery<Record<string, unknown>> | undefined)?.where ?? {}
    return { ...data, ...where }
  }

  private async write(action: AppScriptAction, data: unknown): Promise<unknown> {
    const response = await this.sendAppScriptRequest<Record<string, unknown>>({ action, data })
    if (!response.success) {
      throw new Error(`Apps Script ${action} failed: ${response.error}`)
    }
    return response.data
  }

  private async fetchGVizRows(input: GVizFetchInput): Promise<unknown[]> {
    const url =
      `${GVIZ_BASE_URL}/${this.spreadsheetId}/gviz/tq` +
      `?tqx=out:json&headers=1&sheet=${encodeURIComponent(this.sheetName)}` +
      `&tq=${encodeURIComponent(input.query)}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`GViz read failed: ${response.status} ${response.statusText}`)
    }

    const table = this.parseGVizResponse(await response.text())
    return this.tableToRows(table)
  }

  private parseGVizResponse(body: string): GVizTable {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new Error('GViz response is not parseable JSON')
    }

    const parsed = JSON.parse(body.slice(start, end + 1)) as GVizResponse
    if (parsed.status === 'error') {
      const reason = parsed.errors?.[0]?.detailed_message ?? parsed.errors?.[0]?.message ?? 'unknown error'
      throw new Error(`GViz query error: ${reason}`)
    }

    return parsed.table ?? { cols: [], rows: [] }
  }

  // Maps GViz cells back to row objects keyed by DB column names (the
  // *-db.schema.ts shape). Cell values are returned as-is — never validated
  // (dirty rows must flow). A returned column that maps to no DB field is a
  // contract drift, not dirty data, so it fails loudly.
  private tableToRows(table: GVizTable): Record<string, unknown>[] {
    return table.rows.map((row) => {
      const result: Record<string, unknown> = {}
      table.cols.forEach((column, index) => {
        const field = this.letterToField[column.id]
        if (!field) {
          throw new Error(`No DB field resolves for GViz column '${column.id}'`)
        }
        const cell = row.c[index]
        result[field] = cell == null ? null : (cell.v ?? null)
      })
      return result
    })
  }

  private async sendAppScriptRequest<TResponse = unknown, TData = unknown>(
    input: AppScriptRequestInput<TData>,
  ): Promise<AppScriptResponse<TResponse>> {
    const body: AppScriptRequest<TData> = {
      action: input.action,
      sheet: this.sheetName,
      data: input.data,
    }

    const response = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`Apps Script request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as AppScriptResponse<TResponse>
  }
}

function invertColumns(columns: GSheetColumnMap): Record<string, string> {
  const inverted: Record<string, string> = {}
  for (const [field, letter] of Object.entries(columns)) {
    inverted[letter] = field
  }
  return inverted
}
