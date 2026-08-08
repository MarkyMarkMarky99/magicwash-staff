import type {
  ReadQueryDTO,
  ReadQueryPagination,
  ReadQuerySearch,
  ReadQuerySort,
} from '../dtos/read-query.dto.js'
import type { SheetContract } from '../contracts/sheet-contract.js'
import {
  deriveGVizColumns,
  GVizQueryBuilder,
  type GSheetColumnMap,
} from './utils/gviz-query.builder.js'
import { fetchGVizRows } from './utils/gviz-reader.js'
import { requireEnv } from '../utils/env.js'
import { SheetLibRejectedError, SheetLibTransportError } from './sheetlib-errors.js'
import type { SheetRepositoryContract } from './sheet-repository.contract.js'

export type AppScriptAction = 'APPEND' | 'UPDATE' | 'DELETE'

export interface SheetLibRequestInput<TData = unknown> {
  action: AppScriptAction
  data?: TData
  keyValue?: string
  deletedBy?: string
}

export interface SheetLibRequest<TData = unknown> {
  resource: 'sheet'
  action: AppScriptAction
  target: string
  data?: TData
  key_value?: string
  deleted_by?: string
}

export interface SheetLibSuccessResponse<TData = unknown> {
  status: 'ok'
  target: string
  data: TData
  write?: Record<string, unknown>
  read_back_failed?: boolean
  reason?: string
}

export interface SheetLibErrorResponse {
  status: 'error'
  message: string
}

export type SheetLibResponse<TData = unknown> =
  | SheetLibSuccessResponse<TData>
  | SheetLibErrorResponse

interface SheetRepositoryOptions {
  contract: SheetContract
  /** Environment variable key containing the Apps Script URL. */
  scriptUrl?: string
}

interface GvizReadQuery {
  where?: Record<string, unknown>
  select?: readonly string[]
  search?: ReadQuerySearch
  sort?: ReadQuerySort
  pagination?: ReadQueryPagination
}

/** Google Sheets implementation of the storage-agnostic sheet repository. */
export class SheetRepository<TDbRow extends object>
  implements SheetRepositoryContract<TDbRow>
{
  private readonly contract: SheetContract
  private readonly scriptUrl: string
  private readonly columns: GSheetColumnMap

  constructor(input: SheetRepositoryOptions) {
    this.contract = input.contract
    this.scriptUrl = requireEnv(input.scriptUrl ?? 'APPSCRIPT_URL')
    this.columns = deriveGVizColumns(this.contract.row)
  }

  async read(query?: ReadQueryDTO<Partial<TDbRow>>): Promise<Array<Partial<TDbRow>>> {
    if (
      typeof this.contract.spreadsheetId !== 'string' ||
      this.contract.spreadsheetId.trim() === ''
    ) {
      throw new Error(
        'SheetRepository reads require a spreadsheetId environment variable name',
      )
    }

    const gvizQuery = GVizQueryBuilder.fromColumns(this.columns)
      .fromQuery(this.normalizeReadQuery(query))
      .build()

    return (await fetchGVizRows({
      spreadsheetId: requireEnv(this.contract.spreadsheetId),
      sheetName: this.contract.sheetName,
      query: gvizQuery,
      columns: this.columns,
      decodeJsonCells: false,
    })) as Array<Partial<TDbRow>>
  }

  async append(row: Partial<TDbRow>): Promise<TDbRow> {
    this.requireWriteCapability('append')
    return (await this.write('APPEND', row)) as TDbRow
  }

  async batchAppend(rows: Array<Partial<TDbRow>>): Promise<TDbRow[]> {
    this.requireWriteCapability('append')

    const stored = (await this.write('APPEND', rows, undefined, 'array')) as unknown[]
    // The gateway already confirmed the write, so a count mismatch is a
    // transport error rather than a rejection: treating it as "nothing
    // happened" could cause a retry to append every row a second time.
    if (stored.length !== rows.length) {
      throw new SheetLibTransportError(
        'APPEND',
        'SheetLib APPEND response row count must match batchAppend input — the gateway confirmed the write but the response shape could not be used to map persisted rows',
      )
    }

    return stored as TDbRow[]
  }

  async update(keyValue: string, patch: Partial<TDbRow>): Promise<TDbRow> {
    this.requireWriteCapability('update')
    const resolvedKeyValue = this.resolveWhere({ id: keyValue }, 'update')[
      this.contract.primaryKey
    ]
    const { [this.contract.primaryKey]: _primaryKey, ...dbPatch } = patch as Record<
      string,
      unknown
    >
    return (await this.write('UPDATE', dbPatch, resolvedKeyValue as string)) as TDbRow
  }

  async delete(keyValue: string, deletedBy: string): Promise<TDbRow> {
    this.requireWriteCapability('delete')
    const resolvedKeyValue = this.resolveWhere({ id: keyValue }, 'delete')[
      this.contract.primaryKey
    ]
    return (await this.write(
      'DELETE',
      undefined,
      resolvedKeyValue as string,
      'object',
      deletedBy,
    )) as TDbRow
  }

  private normalizeReadQuery(query?: ReadQueryDTO<Partial<TDbRow>>): GvizReadQuery | undefined {
    if (!query) {
      return undefined
    }

    const normalized: GvizReadQuery = {}
    const where = this.resolveWhere(query, 'read')
    if (where) {
      normalized.where = where
    }
    if (query.select) {
      normalized.select = query.select
    }
    if (query.search) {
      normalized.search = query.search
    }
    if (query.sort) {
      normalized.sort = query.sort
    }
    if (query.pagination) {
      normalized.pagination = query.pagination
    }
    return normalized
  }

  /**
   * Folds the semantic id accessor into the physical primary-key column.
   * A blank read id is ignored; update and delete require a non-empty id.
   */
  private resolveWhere(
    source: Pick<ReadQueryDTO<Partial<TDbRow>>, 'id' | 'where'>,
    operation: 'read' | 'update' | 'delete',
  ): Record<string, unknown> {
    const id = source.id
    const hasId = typeof id === 'string' && id.trim() !== ''

    if ((operation === 'update' || operation === 'delete') && !hasId) {
      throw new Error(`Repository ${operation} requires a non-empty id`)
    }
    if (!hasId) {
      return source.where ? { ...(source.where as Record<string, unknown>) } : {}
    }
    return {
      ...(source.where as Record<string, unknown> | undefined),
      [this.contract.primaryKey]: id,
    }
  }

  private requireWriteCapability(operation: 'append' | 'update' | 'delete'): void {
    if (!this.contract.writes[operation]) {
      throw new Error(
        `${operation} is not supported by sheet '${this.contract.sheetName}'`,
      )
    }
  }

  private async write(
    action: AppScriptAction,
    data: unknown,
    keyValue?: string,
    expectedShape: 'object' | 'array' = 'object',
    deletedBy?: string,
  ): Promise<unknown> {
    const response = await this.sendSheetLibRequest<unknown>({
      action,
      data,
      keyValue,
      deletedBy,
    })
    if (response.status === 'error') {
      throw new SheetLibRejectedError(action, response.message)
    }
    if (response.status !== 'ok') {
      throw new SheetLibTransportError(action, `SheetLib ${action} returned an invalid response status`)
    }
    if (response.read_back_failed === true) {
      throw new SheetLibTransportError(
        action,
        `SheetLib ${action} succeeded but the persisted-row read-back failed: ${response.reason ?? 'unknown reason'}`,
      )
    }

    const stored = response.data
    if (expectedShape === 'array') {
      if (!Array.isArray(stored)) {
        throw new SheetLibTransportError(
          action,
          `SheetLib ${action} confirmed the write but "data" was not an array — the write may have succeeded with no usable persisted rows to map back`,
        )
      }
      return stored
    }

    if (
      stored === undefined ||
      stored === null ||
      typeof stored !== 'object' ||
      Array.isArray(stored)
    ) {
      throw new SheetLibTransportError(
        action,
        `SheetLib ${action} confirmed the write but returned no usable persisted row in "data" — the write may have succeeded with nothing to map back`,
      )
    }
    return stored
  }

  private async sendSheetLibRequest<TResponse = unknown, TData = unknown>(
    input: SheetLibRequestInput<TData>,
  ): Promise<SheetLibResponse<TResponse>> {
    const target = this.requireWriteTarget()
    const body: SheetLibRequest<TData> = {
      resource: 'sheet',
      action: input.action,
      target,
      data: input.data,
    }
    if (input.action === 'UPDATE' || input.action === 'DELETE') {
      body.key_value = input.keyValue
    }
    if (input.action === 'DELETE') {
      body.deleted_by = input.deletedBy
    }

    let response: Response
    try {
      response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      throw new SheetLibTransportError(
        input.action,
        `SheetLib request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (!response.ok) {
      throw new SheetLibTransportError(
        input.action,
        `SheetLib request failed: ${response.status} ${response.statusText}`,
      )
    }

    try {
      return (await response.json()) as SheetLibResponse<TResponse>
    } catch (error) {
      throw new SheetLibTransportError(
        input.action,
        `SheetLib response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private requireWriteTarget(): string {
    if (
      typeof this.contract.target !== 'string' ||
      this.contract.target.trim() === ''
    ) {
      throw new Error('SheetRepository writes require an explicit SheetLib target')
    }
    return this.contract.target
  }
}
