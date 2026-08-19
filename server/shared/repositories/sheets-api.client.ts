import { getGoogleAccessToken } from './google-auth.js'

export const SHEETS_API_TIMEOUT_MS = 15_000

const SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

// The sheet layer serializes objects/arrays into cell strings before handing
// primitive values to this transport client. The valueInputOption is chosen once
// per request, not per column.
export type SheetsApiValue = string | number | boolean | null
export type SheetsApiValues = readonly (readonly SheetsApiValue[])[]
export type SheetsValueInputOption = 'RAW' | 'USER_ENTERED'

export interface SheetsApiClientOptions {
  readonly spreadsheetId: string
  readonly sheetName: string
  readonly fetchImpl?: typeof fetch
  readonly accessTokenProvider?: typeof getGoogleAccessToken
}

export interface SheetsApiValueRange {
  readonly range: string
  readonly majorDimension?: 'ROWS' | 'COLUMNS'
  readonly values: SheetsApiValues
}

export interface SheetsApiBatchUpdateResponse {
  readonly spreadsheetId?: string
  readonly totalUpdatedRows?: number
  readonly totalUpdatedColumns?: number
  readonly totalUpdatedCells?: number
  readonly responses: readonly unknown[]
}

export interface SheetsApiAppendResponse {
  readonly spreadsheetId?: string
  readonly tableRange?: string
  readonly updates: {
    readonly updatedRows: number
    readonly updatedData: {
      readonly values: SheetsApiValues
    }
  }
}

export type WriteCertainty = 'rejected' | 'unknown'

class WriteFailure extends Error {
  readonly operation: string
  readonly certainty: WriteCertainty

  protected constructor(
    operation: string,
    certainty: WriteCertainty,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
    this.operation = operation
    this.certainty = certainty
  }
}

export class WriteRejectedError extends WriteFailure {
  constructor(operation: string, message: string) {
    super(operation, 'rejected', message)
  }
}

export class WriteTransportError extends WriteFailure {
  constructor(operation: string, message: string) {
    super(operation, 'unknown', message)
  }
}

export class WriteCommittedUnreadableError extends WriteFailure {
  constructor(operation: string, message = 'The write committed, but its response could not be read; do not retry because retrying may create duplicate rows.') {
    super(operation, 'unknown', message)
  }
}

/**
 * Thrown when a pre-write lookup finds an existing row for the row's primary
 * key before an APPEND is sent. Extends WriteRejectedError (not WriteFailure
 * directly) so every existing `instanceof WriteRejectedError` write-failure
 * classification keeps working with zero changes.
 */
export class DuplicatePrimaryKeyError extends WriteRejectedError {
  constructor(operation: string, keyColumn: string, keyValue: string) {
    super(
      operation,
      `${operation} rejected: a row with ${keyColumn} '${keyValue}' already exists.`,
    )
  }
}

type JsonRecord = Record<string, unknown>

type SheetsApiReadOptions = {
  readonly valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA'
  readonly dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING'
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSheetsApiValue(value: unknown): value is SheetsApiValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isSheetsApiValues(value: unknown): value is SheetsApiValues {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every(isSheetsApiValue))
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (value.trim() === '') {
    throw new WriteRejectedError('request', `Cannot send Sheets API request: ${fieldName} is empty.`)
  }

  return value
}

function requireValueInputOption(value: SheetsValueInputOption): SheetsValueInputOption {
  if (value !== 'RAW' && value !== 'USER_ENTERED') {
    throw new WriteRejectedError('request', 'Cannot send Sheets API request: valueInputOption is invalid.')
  }

  return value
}

function encodeRange(sheetName: string, range: string): string {
  return encodeURIComponent(`${sheetName}!${range}`)
}

function encodeSheetName(sheetName: string): string {
  return encodeURIComponent(sheetName)
}

function restoreTrailingBlanks(
  returnedValues: SheetsApiValues,
  requestedWidth: number,
): SheetsApiValues {
  return returnedValues.map((row) => {
    const normalizedRow = [...row]

    while (normalizedRow.length < requestedWidth) {
      normalizedRow.push(null)
    }

    for (let index = normalizedRow.length - 1; index >= 0 && normalizedRow[index] === ''; index -= 1) {
      normalizedRow[index] = null
    }

    return normalizedRow
  })
}

function buildUrl(spreadsheetId: string, range: string, query?: Record<string, string>): string {
  const url = new URL(`${SHEETS_API_BASE_URL}/${encodeURIComponent(spreadsheetId)}/values/${range}`)

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}

export class SheetsApiClient {
  private readonly spreadsheetId: string
  private readonly sheetName: string
  private readonly fetchImpl: typeof fetch
  private readonly accessTokenProvider: typeof getGoogleAccessToken

  constructor(options: SheetsApiClientOptions) {
    this.spreadsheetId = requireNonEmpty(options.spreadsheetId, 'spreadsheetId')
    this.sheetName = requireNonEmpty(options.sheetName, 'sheetName')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.accessTokenProvider = options.accessTokenProvider ?? getGoogleAccessToken
  }

  async readHeader(): Promise<readonly SheetsApiValue[]> {
    const body = await this.requestJson(
      'readHeader',
      'GET',
      buildUrl(this.spreadsheetId, encodeRange(this.sheetName, '1:1')),
      undefined,
      false,
    )

    const values = isRecord(body) ? body.values : undefined
    if (!Array.isArray(values) || values.length === 0 || !Array.isArray(values[0]) || !values[0].every(isSheetsApiValue)) {
      throw new WriteTransportError('readHeader', 'The Sheets API returned an unreadable header response.')
    }

    return values[0]
  }

  async readColumn(columnLetter: string): Promise<SheetsApiValues> {
    requireNonEmpty(columnLetter, 'columnLetter')

    const body = await this.requestJson(
      'readColumn',
      'GET',
      buildUrl(this.spreadsheetId, encodeRange(this.sheetName, `${columnLetter}:${columnLetter}`)),
      undefined,
      false,
    )

    const values = isRecord(body) ? body.values : undefined
    if (!isSheetsApiValues(values)) {
      throw new WriteTransportError('readColumn', 'The Sheets API returned an unreadable column response.')
    }

    return values
  }

  async readRange(range: string, options?: SheetsApiReadOptions): Promise<SheetsApiValues> {
    requireNonEmpty(range, 'range')

    const query = options === undefined
      ? undefined
      : {
          ...(options.valueRenderOption === undefined ? {} : { valueRenderOption: options.valueRenderOption }),
          ...(options.dateTimeRenderOption === undefined ? {} : { dateTimeRenderOption: options.dateTimeRenderOption }),
        }

    const body = await this.requestJson(
      'readRange',
      'GET',
      buildUrl(this.spreadsheetId, encodeRange(this.sheetName, range), query),
      undefined,
      false,
    )

    const values = isRecord(body) ? body.values : undefined
    if (!isSheetsApiValues(values)) {
      throw new WriteTransportError('readRange', 'The Sheets API returned an unreadable range response.')
    }

    return values
  }

  async appendRows(
    rows: SheetsApiValues,
    valueInputOption: SheetsValueInputOption,
    knownWidth?: number,
  ): Promise<SheetsApiAppendResponse> {
    if (rows.length === 0) {
      throw new WriteRejectedError('appendRows', 'Cannot append an empty set of rows.')
    }

    if (!isSheetsApiValues(rows)) {
      throw new WriteRejectedError('appendRows', 'Cannot append rows with invalid cell values.')
    }

    const option = requireValueInputOption(valueInputOption)
    const requestedWidth = Math.max(...rows.map((row) => row.length))
    const responseWidth = knownWidth === undefined
      ? requestedWidth
      : Math.max(requestedWidth, knownWidth)
    const body = await this.requestJson(
      'appendRows',
      'POST',
      // The header map lives in SheetRepository, which resolves ranges before calling
      // this client; the client deliberately stays at the level of plain A1 ranges and
      // knows nothing about SheetHeaderMap.
      buildUrl(this.spreadsheetId, `${encodeSheetName(this.sheetName)}:append`, {
        valueInputOption: option,
        insertDataOption: 'INSERT_ROWS',
        includeValuesInResponse: 'true',
        responseValueRenderOption: 'UNFORMATTED_VALUE',
      }),
      { majorDimension: 'ROWS', values: rows },
      true,
    )

    const updates = isRecord(body) ? body.updates : undefined
    const updatedData = isRecord(updates) ? updates.updatedData : undefined
    const updatedRows = isRecord(updates) ? updates.updatedRows : undefined
    const returnedValues = isRecord(updatedData) ? updatedData.values : undefined

    if (
      !isRecord(updates) ||
      typeof updatedRows !== 'number' ||
      updatedRows !== rows.length ||
      !isSheetsApiValues(returnedValues) ||
      returnedValues.length !== rows.length
    ) {
      throw new WriteCommittedUnreadableError('appendRows')
    }

    // A subset-column append can be narrower than the physical sheet. The caller
    // supplies the cached header width when it knows it; omitted knownWidth keeps
    // the transport client's request-width fallback.
    const normalizedValues = restoreTrailingBlanks(returnedValues, responseWidth)

    return {
      spreadsheetId: isRecord(body) && typeof body.spreadsheetId === 'string' ? body.spreadsheetId : undefined,
      tableRange: isRecord(body) && typeof body.tableRange === 'string' ? body.tableRange : undefined,
      updates: {
        updatedRows,
        updatedData: { values: normalizedValues },
      },
    }
  }

  async updateCells(
    data: readonly SheetsApiValueRange[],
    valueInputOption: SheetsValueInputOption,
  ): Promise<SheetsApiBatchUpdateResponse> {
    // Full-row GET plus primary-key verification belongs to the repository;
    // this client owns only the raw values:batchUpdate operation.
    if (data.length === 0) {
      throw new WriteRejectedError('updateCells', 'Cannot update an empty set of ranges.')
    }

    const option = requireValueInputOption(valueInputOption)
    const body = await this.requestJson(
      'updateCells',
      'POST',
      `${SHEETS_API_BASE_URL}/${encodeURIComponent(this.spreadsheetId)}/values:batchUpdate`,
      { valueInputOption: option, data },
      true,
    )

    const responses = isRecord(body) ? body.responses : undefined
    if (!Array.isArray(responses) || responses.length !== data.length) {
      throw new WriteCommittedUnreadableError('updateCells')
    }

    return {
      spreadsheetId: isRecord(body) && typeof body.spreadsheetId === 'string' ? body.spreadsheetId : undefined,
      totalUpdatedRows: isRecord(body) && typeof body.totalUpdatedRows === 'number' ? body.totalUpdatedRows : undefined,
      totalUpdatedColumns: isRecord(body) && typeof body.totalUpdatedColumns === 'number' ? body.totalUpdatedColumns : undefined,
      totalUpdatedCells: isRecord(body) && typeof body.totalUpdatedCells === 'number' ? body.totalUpdatedCells : undefined,
      responses,
    }
  }

  private async requestJson(
    operation: string,
    method: 'GET' | 'POST',
    url: string,
    requestBody: unknown,
    isWrite: boolean,
  ): Promise<unknown> {
    let accessToken: string

    try {
      accessToken = await this.accessTokenProvider()
      if (accessToken.trim() === '') {
        throw new Error('empty access token')
      }
    } catch {
      throw new WriteRejectedError(operation, 'Google authentication failed before the request was sent.')
    }

    let serializedBody: string | undefined
    try {
      serializedBody = requestBody === undefined ? undefined : JSON.stringify(requestBody)
    } catch {
      throw new WriteRejectedError(operation, 'The Sheets API request could not be constructed.')
    }

    let response: Response
    try {
      // Never retry after dispatch: a successful write with a lost response may duplicate data.
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(serializedBody === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: serializedBody,
        signal: AbortSignal.timeout(SHEETS_API_TIMEOUT_MS),
      })
    } catch {
      throw new WriteTransportError(operation, `${operation} did not receive a response from the Sheets API.`)
    }

    if (response.status < 200 || response.status >= 300) {
      let responseBodyExcerpt: string
      try {
        responseBodyExcerpt = (await response.text()).slice(0, 500)
      } catch {
        responseBodyExcerpt = '[unavailable]'
      }

      const responseBodyMessage = ` Response body: ${responseBodyExcerpt}`

      if (response.status === 400 || response.status === 403 || response.status === 404 || response.status === 409) {
        throw new WriteRejectedError(operation, `The Sheets API rejected ${operation} with HTTP ${response.status}.${responseBodyMessage}`)
      }

      throw new WriteTransportError(operation, `${operation} received no authoritative result from the Sheets API.${responseBodyMessage}`)
    }

    try {
      return await response.json()
    } catch {
      if (isWrite) {
        throw new WriteCommittedUnreadableError(operation)
      }

      throw new WriteTransportError(operation, `The Sheets API returned an unreadable response for ${operation}.`)
    }
  }
}
