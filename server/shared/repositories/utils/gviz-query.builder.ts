import type { MappedReadQuery } from '../base.repository.js'
import type {
  ReadQueryPagination,
  ReadQuerySearch,
  ReadQuerySort,
} from '../../dtos/read-query.dto.js'
import { cellTypeOf } from '../../contracts/sheet-cell-type.js'

export type GSheetColumnMap = Record<string, string>

/**
 * Per-column GViz literal type, derived from the row schema's cell-type
 * markers (see `sheet-cell-type.ts`). Only columns explicitly marked
 * `sheetDate()`/`sheetDateTime()` appear here; every other column is absent
 * and keeps the default quoted-string literal.
 */
export type GSheetCellTypeMap = Partial<Record<string, 'date' | 'datetime'>>

export interface GSheetRowSchema {
  shape: Record<string, unknown>
}

export function deriveGVizColumns(rowSchema: GSheetRowSchema): GSheetColumnMap {
  const columns: GSheetColumnMap = {}

  Object.keys(rowSchema.shape).forEach((field, index) => {
    columns[field] = columnLetterFor(index)
  })

  return columns
}

/**
 * Derives which columns are native Sheets date/datetime cells from the same
 * row schema `deriveGVizColumns` reads. Type is taken from the schema ONLY
 * — never sniffed from a value's shape — so a plain string column holding
 * an ISO-looking value is never misrendered as a typed literal.
 */
export function deriveGVizCellTypes(rowSchema: GSheetRowSchema): GSheetCellTypeMap {
  const cellTypes: GSheetCellTypeMap = {}

  for (const [field, fieldSchema] of Object.entries(rowSchema.shape)) {
    const cellType = cellTypeOf(fieldSchema)
    if (cellType) {
      cellTypes[field] = cellType
    }
  }

  return cellTypes
}

export class GVizQueryBuilder {
  private selectClause = 'select *'
  private whereParts: string[] = []
  private sortClause = ''
  private paginationClause = ''

  constructor(
    private readonly columns: GSheetColumnMap,
    private readonly cellTypes: GSheetCellTypeMap = {},
  ) {}

  static fromColumns(columns: GSheetColumnMap, cellTypes: GSheetCellTypeMap = {}): GVizQueryBuilder {
    return new GVizQueryBuilder(columns, cellTypes)
  }

  fromQuery(query?: MappedReadQuery<Record<string, unknown>>): this {
    return this
      .select(query?.select)
      .where(query?.where)
      .search(query?.search)
      .sort(query?.sort)
      .pagination(query?.pagination)
  }

  select(fields?: readonly string[]): this {
    if (!fields || fields.length === 0) {
      this.selectClause = 'select *'
      return this
    }

    this.selectClause = `select ${fields.map((field) => this.resolveColumn(field)).join(', ')}`
    return this
  }

  where(where?: Record<string, unknown>): this {
    if (!where) {
      return this
    }

    for (const [field, value] of Object.entries(where)) {
      if (this.isIgnoredValue(value)) {
        continue
      }

      this.whereParts.push(`${this.resolveColumn(field)} = ${this.renderLiteral(field, value)}`)
    }

    return this
  }

  search(search?: ReadQuerySearch): this {
    if (!search || this.isIgnoredValue(search.keyword) || search.fields.length === 0) {
      return this
    }

    const keyword = this.sanitizeValue(search.keyword)
    const parts = search.fields.map(
      (field) => `${this.resolveColumn(field)} contains '${keyword}'`,
    )

    this.whereParts.push(parts.length === 1 ? parts[0] : `(${parts.join(' or ')})`)
    return this
  }

  sort(sort?: ReadQuerySort): this {
    if (!sort) {
      return this
    }

    this.sortClause = `order by ${this.resolveColumn(sort.field)} ${sort.order}`
    return this
  }

  pagination(pagination?: ReadQueryPagination): this {
    if (!pagination) {
      return this
    }

    const offset = (pagination.page - 1) * pagination.perPage
    this.paginationClause = `limit ${pagination.perPage}\noffset ${offset}`
    return this
  }

  build(): string {
    const whereClause =
      this.whereParts.length > 0 ? `where ${this.whereParts.join(' and ')}` : ''

    return [this.selectClause, whereClause, this.sortClause, this.paginationClause]
      .filter(Boolean)
      .join('\n')
  }

  private resolveColumn(field: string): string {
    const column = this.columns[field]
    if (!column) {
      throw new Error(`No GViz column resolves for field '${field}'`)
    }

    return column
  }

  /**
   * Renders an equality-filter literal for `field`. A native Sheets date or
   * datetime cell only matches a TYPED literal (`date '...'`/`datetime
   * '...'`) — a quoted string compares against nothing and GViz silently
   * returns zero rows. The type comes solely from `this.cellTypes`, which is
   * derived from the row schema; it is never inferred from `value`'s shape.
   */
  private renderLiteral(field: string, value: unknown): string {
    const sanitized = this.sanitizeValue(String(value))
    const cellType = this.cellTypes[field]

    if (cellType === 'date') {
      return `date '${sanitized}'`
    }
    if (cellType === 'datetime') {
      return `datetime '${sanitized}'`
    }
    return `'${sanitized}'`
  }

  private sanitizeValue(value: string): string {
    return value.replace(/'/g, '')
  }

  private isIgnoredValue(value: unknown): boolean {
    return value === null || value === undefined || value === ''
  }
}

function columnLetterFor(index: number): string {
  let value = index + 1
  let letter = ''

  while (value > 0) {
    value -= 1
    letter = String.fromCharCode(65 + (value % 26)) + letter
    value = Math.floor(value / 26)
  }

  return letter
}
