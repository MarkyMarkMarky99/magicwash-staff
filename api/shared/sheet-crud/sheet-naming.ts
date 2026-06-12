/**
 * The naming convention that lets one zod row schema drive everything:
 * sheet column headers are PascalCase with an uppercase `ID` suffix
 * (`PickupOrderID`), API field names are their camelCase counterparts
 * (`pickupOrderId`). Both the type-level and runtime transforms live here —
 * if a sheet ever breaks this convention, extend this file (an override map),
 * don't work around it in modules.
 */

/** Type-level column -> API field name: `AppointmentID` -> `appointmentId`. */
export type ColumnToField<S extends string> = S extends `${infer P}ID`
  ? P extends ''
    ? 'id'
    : `${Uncapitalize<P>}Id`
  : Uncapitalize<S>

/** A DTO as a projection of row columns, renamed by the convention. */
export type SheetDtoFor<TRow, TCols extends keyof TRow & string> = {
  [C in TCols as ColumnToField<C>]: TRow[C]
}

/** Runtime twin of {@link ColumnToField}. */
export function columnToField(column: string): string {
  const base = column.endsWith('ID') ? `${column.slice(0, -2)}Id` : column
  return base.charAt(0).toLowerCase() + base.slice(1)
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
