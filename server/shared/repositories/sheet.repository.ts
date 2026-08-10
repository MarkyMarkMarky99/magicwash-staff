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
import {
  SheetsApiClient,
  WriteCommittedUnreadableError,
  WriteRejectedError,
  type SheetsApiValue,
  type SheetsApiValueRange,
  type SheetsApiValues,
  type SheetsApiClientOptions,
} from './sheets-api.client.js'
import {
  buildRowRange,
  buildSheetHeaderMap,
  SheetHeaderMapError,
  SheetHeaderMapResolver,
  type SheetHeaderMapLoader,
} from './sheet-header-map.js'
import {
  buildRowValues,
  parseRowValues,
  resolveValueInputOption,
  serializeCellValue,
} from './sheet-value-serializer.js'
import { findRowNumberByKey } from './sheet-row-lookup.js'
import { verifyRowIdentity } from './sheet-row-identity.js'

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

export interface SheetRepositoryOptions {
  contract: SheetContract
  /** Environment variable key containing the Apps Script URL. */
  scriptUrl?: string
  /** Test seam for the authenticated Sheets API client. */
  sheetsApiClient?: SheetsApiClient
  /** Test seam for the Sheets API HTTP client and token provider. */
  sheetsApiClientOptions?: Omit<SheetsApiClientOptions, 'spreadsheetId' | 'sheetName'>
  /** Test seam for the live-header loader. */
  sheetHeaderMapLoader?: SheetHeaderMapLoader
}

interface GvizReadQuery {
  where?: Record<string, unknown>
  select?: readonly string[]
  search?: ReadQuerySearch
  sort?: ReadQuerySort
  pagination?: ReadQueryPagination
}

// Every SheetLib write aborts after this long so a hung Apps Script call cannot hold the Vercel function indefinitely.
const SHEETLIB_WRITE_TIMEOUT_MS = 15_000

/** Google Sheets implementation of the storage-agnostic sheet repository. */
export class SheetRepository<TDbRow extends object>
  implements SheetRepositoryContract<TDbRow>
{
  private readonly contract: SheetContract
  private readonly scriptUrl: string | undefined
  private readonly columns: GSheetColumnMap
  private readonly sheetsApiClient: SheetsApiClient | undefined
  private readonly sheetHeaderMapLoader: SheetHeaderMapLoader | undefined

  constructor(input: SheetRepositoryOptions) {
    this.contract = input.contract
    this.columns = deriveGVizColumns(this.contract.row)

    if (this.contract.writeTransport === 'sheets-api') {
      if (
        typeof this.contract.spreadsheetId !== 'string' ||
        this.contract.spreadsheetId.trim() === ''
      ) {
        throw new Error(
          'SheetRepository Sheets API writes require a spreadsheetId environment variable name',
        )
      }

      this.sheetsApiClient =
        input.sheetsApiClient ??
        new SheetsApiClient({
          spreadsheetId: requireEnv(this.contract.spreadsheetId),
          sheetName: this.contract.sheetName,
          ...input.sheetsApiClientOptions,
        })
      this.sheetHeaderMapLoader =
        input.sheetHeaderMapLoader ??
        new SheetHeaderMapResolver(async () =>
          buildSheetHeaderMap(
            await this.sheetsApiClient!.readHeader(),
            Object.keys(this.contract.row.shape),
            this.contract.primaryKey,
          ),
        )
      this.scriptUrl = undefined
      return
    }

    this.scriptUrl = requireEnv(input.scriptUrl ?? 'APPSCRIPT_URL')
    this.sheetsApiClient = undefined
    this.sheetHeaderMapLoader = undefined
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
    if (this.contract.writeTransport === 'sheets-api') {
      return this.appendThroughSheetsApi(row)
    }
    return (await this.write('APPEND', row)) as TDbRow
  }

  private async appendThroughSheetsApi(row: Partial<TDbRow>): Promise<TDbRow> {
    const client = this.sheetsApiClient
    if (client === undefined) {
      throw new WriteRejectedError('APPEND', 'Sheets API client is not configured')
    }

    try {
      for (const column of Object.keys(this.contract.valueInput ?? {})) {
        const declaredValueInput = Object.prototype.hasOwnProperty.call(
          this.contract.valueInput ?? {},
          column,
        )
        const valueInput = resolveValueInputOption(column, this.contract.valueInput)
        if (declaredValueInput && valueInput !== 'USER_ENTERED') {
          throw new WriteRejectedError(
            'APPEND',
            `Column '${column}' declares valueInput '${valueInput}', which conflicts with the USER_ENTERED request policy.`,
          )
        }
      }
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        'APPEND',
        error instanceof Error ? error.message : String(error),
      )
    }

    const loader = this.sheetHeaderMapLoader
    if (loader === undefined) {
      throw new WriteRejectedError('APPEND', 'Sheets API header map is not configured')
    }

    let headerMap
    try {
      headerMap = await loader.load()
    } catch (error) {
      if (error instanceof SheetHeaderMapError) {
        throw new WriteRejectedError('APPEND', error.message)
      }
      throw error
    }

    let sentValues: SheetsApiValue[]
    let sentRow: Record<string, SheetsApiValue>
    try {
      sentValues = buildRowValues(row as Record<string, unknown>, headerMap)
      sentRow = parseRowValues(sentValues, headerMap)
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        'APPEND',
        error instanceof Error ? error.message : String(error),
      )
    }

    const response = await client.appendRows([sentValues], 'USER_ENTERED', headerMap.width)

    let echoedRow: Record<string, SheetsApiValue>
    try {
      const returnedValues = response.updates.updatedData.values
      if (returnedValues.length !== 1) {
        throw new Error(
          `APPEND committed, but the persisted row read-back returned ${returnedValues.length} rows instead of one.`,
        )
      }
      echoedRow = parseRowValues(returnedValues[0]!, headerMap)
    } catch (error) {
      throw new WriteCommittedUnreadableError(
        'APPEND',
        `APPEND committed, but the persisted row could not be parsed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    verifyRowIdentity(
      echoedRow,
      this.contract.primaryKey,
      String(sentRow[this.contract.primaryKey] ?? ''),
    )
    return sentRow as TDbRow
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
    if (this.contract.writeTransport === 'sheets-api') {
      return this.updateThroughSheetsApi(keyValue, patch)
    }

    // This branch performs lookup + write under LockService. The Sheets API
    // branch above does not: it looks the row up and writes in two separate
    // calls, an intentionally accepted TOCTOU risk. The decision and its
    // guardrails live in sheet-row-lookup.ts. This branch is not affected.
    const resolvedKeyValue = this.resolveWhere({ id: keyValue }, 'update')[
      this.contract.primaryKey
    ]
    const { [this.contract.primaryKey]: _primaryKey, ...dbPatch } = patch as Record<
      string,
      unknown
    >
    return (await this.write('UPDATE', dbPatch, resolvedKeyValue as string)) as TDbRow
  }

  private async updateThroughSheetsApi(
    keyValue: string,
    patch: Partial<TDbRow>,
  ): Promise<TDbRow> {
    const client = this.requireSheetsApiClient()
    const headerMap = await this.loadSheetsApiHeaderMap()
    const resolvedKeyValue = this.resolveWhere({ id: keyValue }, 'update')[
      this.contract.primaryKey
    ]
    const expectedKey = resolvedKeyValue as string

    let rowNumber: number | null
    try {
      rowNumber = await findRowNumberByKey(
        headerMap,
        this.contract.primaryKey,
        expectedKey,
        (columnLetter) => client.readColumn(columnLetter),
      )
    } catch (error) {
      if (error instanceof SheetHeaderMapError) {
        throw new WriteRejectedError('UPDATE', error.message)
      }
      throw error
    }

    if (rowNumber === null) {
      throw new WriteRejectedError(
        'UPDATE',
        `No row found for primary key '${this.contract.primaryKey}' with value '${expectedKey}'.`,
      )
    }

    const { [this.contract.primaryKey]: _primaryKey, ...dbPatch } = patch as Record<
      string,
      unknown
    >
    const ranges: SheetsApiValueRange[] = []

    try {
      for (const [column, value] of Object.entries(dbPatch)) {
        const columnLetter = headerMap.letterByName[column]
        if (columnLetter === undefined) {
          throw new Error(`Column '${column}' is not present in the sheet header map`)
        }

        const declaredValueInput = Object.prototype.hasOwnProperty.call(
          this.contract.valueInput ?? {},
          column,
        )
        const valueInput = resolveValueInputOption(column, this.contract.valueInput)
        if (declaredValueInput && valueInput !== 'USER_ENTERED') {
          throw new WriteRejectedError(
            'UPDATE',
            `Column '${column}' declares valueInput '${valueInput}', which conflicts with the USER_ENTERED request policy.`,
          )
        }

        ranges.push({
          range: `${this.contract.sheetName}!${columnLetter}${rowNumber}:${columnLetter}${rowNumber}`,
          values: [[serializeCellValue(value)]],
        })
      }
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        'UPDATE',
        error instanceof Error ? error.message : String(error),
      )
    }

    await client.updateCells(ranges, 'USER_ENTERED')

    let returnedValues: SheetsApiValues
    try {
      returnedValues = await client.readRange(buildRowRange(headerMap, rowNumber))
    } catch (error) {
      throw new WriteCommittedUnreadableError(
        'UPDATE',
        `UPDATE committed, but the persisted row could not be read back: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    if (returnedValues.length !== 1) {
      throw new WriteCommittedUnreadableError(
        'UPDATE',
        `UPDATE committed, but the persisted row read-back returned ${returnedValues.length} rows instead of one.`,
      )
    }

    let storedRow: Record<string, SheetsApiValue>
    try {
      storedRow = parseRowValues(returnedValues[0]!, headerMap)
    } catch (error) {
      throw new WriteCommittedUnreadableError(
        'UPDATE',
        `UPDATE committed, but the persisted row could not be parsed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    verifyRowIdentity(storedRow, this.contract.primaryKey, expectedKey)
    return storedRow as TDbRow
  }

  private async loadSheetsApiHeaderMap() {
    const loader = this.sheetHeaderMapLoader
    if (loader === undefined) {
      throw new WriteRejectedError('UPDATE', 'Sheets API header map is not configured')
    }

    try {
      return await loader.load()
    } catch (error) {
      if (error instanceof SheetHeaderMapError) {
        throw new WriteRejectedError('UPDATE', error.message)
      }
      throw error
    }
  }

  private requireSheetsApiClient(): SheetsApiClient {
    if (this.sheetsApiClient === undefined) {
      throw new WriteRejectedError('UPDATE', 'Sheets API client is not configured')
    }
    return this.sheetsApiClient
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
    const scriptUrl = this.requireScriptUrl()
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
      response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: AbortSignal.timeout(SHEETLIB_WRITE_TIMEOUT_MS),
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

  private requireScriptUrl(): string {
    if (this.scriptUrl === undefined) {
      throw new Error('SheetLib write transport is not configured for this sheet')
    }
    return this.scriptUrl
  }
}
