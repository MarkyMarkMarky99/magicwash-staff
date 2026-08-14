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
import type { SheetRepositoryContract } from './sheet-repository.contract.js'
import {
  DuplicatePrimaryKeyError,
  SheetsApiClient,
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
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
  type SheetHeaderMap,
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
import { formatBangkokTimestamp } from '../utils/bangkok-timestamp.js'

type WriteOperation = 'append' | 'update'
type PreparedRow = {
  row: Record<string, SheetsApiValue>
  values: SheetsApiValue[]
}

const BANGKOK_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?![\s\S])/

export interface SheetRepositoryOptions {
  contract: SheetContract
  /** Test seam for the authenticated Sheets API client. */
  sheetsApiClient?: SheetsApiClient
  /** Test seam for the Sheets API HTTP client and token provider. */
  sheetsApiClientOptions?: Omit<SheetsApiClientOptions, 'spreadsheetId' | 'sheetName'>
  /** Test seam for the live-header loader. */
  sheetHeaderMapLoader?: SheetHeaderMapLoader
  /** Test seam for audit timestamp generation. */
  now?: () => Date
}

interface GvizReadQuery {
  where?: Record<string, unknown>
  select?: readonly string[]
  search?: ReadQuerySearch
  sort?: ReadQuerySort
  pagination?: ReadQueryPagination
}

const APPEND_GVIZ_VERIFY_DELAYS_MS = [0, 1_000, 2_000] as const

function waitForAppendGvizVerify(delayMs: number): Promise<void> {
  if (delayMs === 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

/** Google Sheets implementation of the storage-agnostic sheet repository. */
export class SheetRepository<TDbRow extends object>
  implements SheetRepositoryContract<TDbRow>
{
  private readonly contract: SheetContract
  private readonly columns: GSheetColumnMap
  private readonly sheetsApiClient: SheetsApiClient | undefined
  private readonly sheetHeaderMapLoader: SheetHeaderMapLoader | undefined
  private readonly now: () => Date

  constructor(input: SheetRepositoryOptions) {
    this.contract = input.contract
    this.columns = deriveGVizColumns(this.contract.row)
    this.now = input.now ?? (() => new Date())

    if (!this.contract.writes.append && !this.contract.writes.update) {
      this.sheetsApiClient = undefined
      this.sheetHeaderMapLoader = undefined
      return
    }

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
    return this.appendThroughSheetsApi(row)
  }

  private async appendThroughSheetsApi(row: Partial<TDbRow>): Promise<TDbRow> {
    const client = this.requireSheetsApiClient('APPEND')
    this.validateValueInputPolicy('append')
    const headerMap = await this.loadSheetsApiHeaderMap('append')

    let prepared: PreparedRow
    try {
      prepared = this.prepareRow(
        row,
        headerMap,
        'append',
        formatBangkokTimestamp(this.now()),
      )
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        'APPEND',
        error instanceof Error ? error.message : String(error),
      )
    }

    await this.validateKeys(client, headerMap, [prepared.row])

    try {
      const response = await client.appendRows([prepared.values], 'USER_ENTERED', headerMap.width)

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
        String(prepared.row[this.contract.primaryKey] ?? ''),
      )
      return prepared.row as TDbRow
    } catch (error) {
      if (
        (error instanceof WriteTransportError ||
          error instanceof WriteCommittedUnreadableError) &&
        (await this.verifyAppendedRow(
          String(prepared.row[this.contract.primaryKey] ?? ''),
        ))
      ) {
        return prepared.row as TDbRow
      }

      throw error
    }
  }

  private validateValueInputPolicy(operation: WriteOperation): void {
    const operationName = operation.toUpperCase()

    try {
      for (const column of Object.keys(this.contract.valueInput ?? {})) {
        const declaredValueInput = Object.prototype.hasOwnProperty.call(
          this.contract.valueInput ?? {},
          column,
        )
        const valueInput = resolveValueInputOption(column, this.contract.valueInput)
        if (declaredValueInput && valueInput !== 'USER_ENTERED') {
          throw new WriteRejectedError(
            operationName,
            `Column '${column}' declares valueInput '${valueInput}', which conflicts with the USER_ENTERED request policy.`,
          )
        }
      }
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        operationName,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async loadSheetsApiHeaderMap(operation: WriteOperation): Promise<SheetHeaderMap> {
    const loader = this.sheetHeaderMapLoader
    const operationName = operation.toUpperCase()
    if (loader === undefined) {
      throw new WriteRejectedError(`${operationName}`, 'Sheets API header map is not configured')
    }

    try {
      return await loader.load()
    } catch (error) {
      if (error instanceof SheetHeaderMapError) {
        throw new WriteRejectedError(operationName, error.message)
      }
      throw error
    }
  }

  private prepareRow(
    row: Partial<TDbRow>,
    headerMap: SheetHeaderMap,
    operation: WriteOperation,
    timestamp: string,
  ): PreparedRow {
    const preparedRow = this.prepareAuditRow(row, headerMap, operation, timestamp)
    const values = buildRowValues(preparedRow, headerMap)
    return {
      row: parseRowValues(values, headerMap),
      values,
    }
  }

  private prepareAuditRow(
    row: Partial<TDbRow>,
    headerMap: SheetHeaderMap,
    operation: WriteOperation,
    timestamp: string,
  ): Record<string, unknown> {
    const preparedRow = { ...(row as Record<string, unknown>) }
    const auditColumns = operation === 'append'
      ? this.contract.audit?.onAppend ?? []
      : this.contract.audit?.onUpdate ?? []

    for (const column of auditColumns) {
      if (!Object.prototype.hasOwnProperty.call(headerMap.letterByName, column)) {
        throw new WriteRejectedError(
          operation.toUpperCase(),
          `Audit column '${column}' is not present in the sheet header map`,
        )
      }

      const value = preparedRow[column]
      if (value !== undefined) {
        if (typeof value !== 'string' || !BANGKOK_TIMESTAMP_PATTERN.test(value)) {
          throw new WriteRejectedError(
            operation.toUpperCase(),
            `Audit column '${column}' must use timestamp format yyyy-MM-dd HH:mm:ss`,
          )
        }
        continue
      }

      preparedRow[column] = timestamp
    }

    return preparedRow
  }

  private async validateKeys(
    client: SheetsApiClient,
    headerMap: SheetHeaderMap,
    preparedRows: Array<Record<string, SheetsApiValue>>,
  ): Promise<void> {
    const keyValues = preparedRows
      .map((row) => String(row[this.contract.primaryKey] ?? '').trim())
      .filter((value) => value !== '')
    if (keyValues.length === 0) {
      return
    }

    const keyColumnLetter = headerMap.letterByName[this.contract.primaryKey]
    if (keyColumnLetter === undefined) {
      throw new WriteRejectedError(
        'APPEND',
        `Key column '${this.contract.primaryKey}' is not present in the sheet header map`,
      )
    }

    const existingKeyValues = await client.readColumn(keyColumnLetter)
    const uniqueKeyValues = new Set<string>()
    for (const keyValue of keyValues) {
      if (uniqueKeyValues.has(keyValue)) {
        throw new DuplicatePrimaryKeyError('APPEND', this.contract.primaryKey, keyValue)
      }
      uniqueKeyValues.add(keyValue)
    }

    for (const keyValue of uniqueKeyValues) {
      const existingRowNumber = await findRowNumberByKey(
        headerMap,
        this.contract.primaryKey,
        keyValue,
        async () => existingKeyValues,
      )
      if (existingRowNumber !== null) {
        throw new DuplicatePrimaryKeyError('APPEND', this.contract.primaryKey, keyValue)
      }
    }
  }

  /**
   * An APPEND has a new primary key, so a GViz row lookup can resolve an
   * otherwise unknown Sheets API result without changing UPDATE semantics.
   */
  private async verifyAppendedRow(primaryKeyValue: string): Promise<boolean> {
    if (primaryKeyValue === '') {
      return false
    }

    try {
      const query = GVizQueryBuilder.fromColumns(this.columns)
        .where({ [this.contract.primaryKey]: primaryKeyValue })
        .build()
      if (typeof this.contract.spreadsheetId !== 'string') {
        return false
      }
      const spreadsheetId = requireEnv(this.contract.spreadsheetId)

      for (const delayMs of APPEND_GVIZ_VERIFY_DELAYS_MS) {
        await waitForAppendGvizVerify(delayMs)

        try {
          const rows = await fetchGVizRows<Record<string, unknown>>({
            spreadsheetId,
            sheetName: this.contract.sheetName,
            query,
            columns: this.columns,
            decodeJsonCells: false,
          })

          if (
            rows.some(
              (candidate) =>
                candidate[this.contract.primaryKey] === primaryKeyValue,
            )
          ) {
            return true
          }
        } catch {
          // A failed or unreadable verification is inconclusive; continue the
          // bounded read-back attempts and preserve the original write error.
        }
      }
    } catch {
      // Verification must never replace the original unknown-certainty error.
    }

    return false
  }

  async batchAppend(rows: Array<Partial<TDbRow>>): Promise<TDbRow[]> {
    this.requireWriteCapability('append')
    return this.batchAppendThroughSheetsApi(rows)
  }

  private async batchAppendThroughSheetsApi(
    rows: Array<Partial<TDbRow>>,
  ): Promise<TDbRow[]> {
    const client = this.requireSheetsApiClient('APPEND')
    this.validateValueInputPolicy('append')
    const headerMap = await this.loadSheetsApiHeaderMap('append')

    let sentValuesList: SheetsApiValues
    let sentRows: Array<Record<string, SheetsApiValue>>
    try {
      const timestamp = formatBangkokTimestamp(this.now())
      const preparedRows = rows.map((row) =>
        this.prepareRow(row, headerMap, 'append', timestamp),
      )
      sentValuesList = preparedRows.map((prepared) => prepared.values)
      sentRows = preparedRows.map((prepared) => prepared.row)
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        'APPEND',
        error instanceof Error ? error.message : String(error),
      )
    }

    await this.validateKeys(client, headerMap, sentRows)

    const response = await client.appendRows(
      sentValuesList,
      'USER_ENTERED',
      headerMap.width,
    )

    let echoedRows: Array<Record<string, SheetsApiValue>>
    try {
      const returnedValues = response.updates.updatedData.values
      // The API already confirmed the write, so a count mismatch is
      // committed-but-unreadable rather than a rejection: treating it as
      // "nothing happened" could cause a retry to append every row a second time.
      if (returnedValues.length !== rows.length) {
        throw new Error(
          `APPEND committed, but the persisted row read-back returned ${returnedValues.length} rows instead of ${rows.length}.`,
        )
      }
      echoedRows = returnedValues.map((values) => parseRowValues(values, headerMap))
    } catch (error) {
      throw new WriteCommittedUnreadableError(
        'APPEND',
        `APPEND committed, but the persisted rows could not be parsed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    for (let index = 0; index < sentRows.length; index += 1) {
      const sentRow = sentRows[index]!
      verifyRowIdentity(
        echoedRows[index]!,
        this.contract.primaryKey,
        String(sentRow[this.contract.primaryKey] ?? ''),
      )
    }
    return sentRows as TDbRow[]
  }

  async update(keyValue: string, patch: Partial<TDbRow>): Promise<TDbRow> {
    this.requireWriteCapability('update')
    const resolvedKeyValue = this.resolveWhere({ id: keyValue }, 'update')[
      this.contract.primaryKey
    ] as string
    return this.updateThroughSheetsApi(resolvedKeyValue, patch)
  }

  private async updateThroughSheetsApi(
    keyValue: string,
    patch: Partial<TDbRow>,
  ): Promise<TDbRow> {
    const client = this.requireSheetsApiClient('UPDATE')
    this.validateValueInputPolicy('update')
    const headerMap = await this.loadSheetsApiHeaderMap('update')
    const expectedKey = keyValue

    let preparedPatch: Record<string, unknown>
    try {
      preparedPatch = this.prepareAuditRow(
        patch,
        headerMap,
        'update',
        formatBangkokTimestamp(this.now()),
      )
    } catch (error) {
      if (error instanceof WriteRejectedError) {
        throw error
      }
      throw new WriteRejectedError(
        'UPDATE',
        error instanceof Error ? error.message : String(error),
      )
    }

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

    const { [this.contract.primaryKey]: _primaryKey, ...dbPatch } = preparedPatch
    const ranges: SheetsApiValueRange[] = []

    try {
      for (const [column, value] of Object.entries(dbPatch)) {
        const columnLetter = headerMap.letterByName[column]
        if (columnLetter === undefined) {
          throw new Error(`Column '${column}' is not present in the sheet header map`)
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

  private requireSheetsApiClient(operation: 'APPEND' | 'UPDATE'): SheetsApiClient {
    if (this.sheetsApiClient === undefined) {
      throw new WriteRejectedError(operation, 'Sheets API client is not configured')
    }
    return this.sheetsApiClient
  }

  async delete(keyValue: string, _deletedBy: string): Promise<TDbRow> {
    this.requireWriteCapability('delete')
    this.resolveWhere({ id: keyValue }, 'delete')
    throw new Error('delete is not supported yet')
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

}
