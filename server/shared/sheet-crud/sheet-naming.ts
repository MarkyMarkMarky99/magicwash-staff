/**
 * The field map that pairs a sheet's DB columns with their API field names.
 *
 * Sheet headers do not always follow a predictable casing rule (the Customers
 * sheet has a `Line` column the API exposes as `lineId`), so the engine no
 * longer *computes* an API field from a column name. Each module declares an
 * explicit `fieldMap` (DB column -> API field) in its `<m>-db.schema.ts`; this
 * file turns that map into the type-level and runtime translations the engine
 * needs, in both directions. A column with no entry — or a lookup that misses —
 * fails loudly rather than silently resolving to the wrong column.
 *
 * Column LETTERS (physical sheet order) are a separate concern and still derive
 * from the row schema's key order — see {@link columnLetterFor}.
 */

// ── Type-level translation ────────────────────────────────────────────────────

/** Shape of a module field map: one API field name per row column. */
export type SheetFieldMap<TRow> = Record<keyof TRow & string, string>

/** API field for a column via the map; `never` for a column the map omits. */
export type FieldFor<TMap, C> = C extends keyof TMap ? TMap[C] & string : never

/**
 * Reverse view of a field map (API field -> column). A plain mapped type, so
 * duplicate API fields silently collapse — it is a lookup, NOT a duplicate
 * detector (that guard is runtime, in {@link makeFieldResolver}).
 */
export type InvertFieldMap<TMap extends Record<string, string>> = {
  [C in keyof TMap as TMap[C]]: C & string
}

/** Column whose mapped API field is `F`; `never` when no column maps to it. */
export type ColumnFor<TMap extends Record<string, string>, F> = F extends keyof InvertFieldMap<TMap>
  ? InvertFieldMap<TMap>[F]
  : never

/** A DTO as a projection of row columns, renamed to API fields by the map. */
export type SheetDtoFor<TRow, TMap> = {
  [C in keyof TRow & string as FieldFor<TMap, C>]: TRow[C]
}

// ── Runtime translation ───────────────────────────────────────────────────────

/** Bidirectional column <-> field translator, both halves throwing on a miss. */
export interface FieldResolver {
  /** DB column -> API field. */
  toField(column: string): string
  /** API field -> DB column. */
  toColumn(field: string): string
}

/**
 * Build a {@link FieldResolver} from a module's field map. The map must be
 * bijective: a duplicate API field value throws here, at module load (the
 * type-level reverse view cannot catch it). Neither direction falls back to a
 * naming convention — an unmapped column or field throws so a wrong column is
 * never queried or written.
 */
export function makeFieldResolver(fieldMap: Record<string, string>): FieldResolver {
  const fieldToColumn = new Map<string, string>()
  for (const [column, field] of Object.entries(fieldMap)) {
    const existing = fieldToColumn.get(field)
    if (existing !== undefined) {
      throw new Error(
        `sheet-crud field map is not bijective: columns '${existing}' and '${column}' ` +
          `both map to API field '${field}'`,
      )
    }
    fieldToColumn.set(field, column)
  }

  return {
    toField(column) {
      const field = fieldMap[column]
      if (field === undefined) {
        throw new Error(`sheet-crud field map has no API field for column '${column}'`)
      }
      return field
    },
    toColumn(field) {
      const column = fieldToColumn.get(field)
      if (column === undefined) {
        throw new Error(`sheet-crud field map has no column for API field '${field}'`)
      }
      return column
    },
  }
}

/** 0 -> 'A', 25 -> 'Z', 26 -> 'AA' ... (bijective base-26, GViz letters). */
export function columnLetterFor(index: number): string {
  let n = index
  let letter = ''
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letter
}
