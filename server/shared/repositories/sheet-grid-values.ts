import { z } from 'zod'

const gridResponseSchema = z.object({
  properties: z.object({ timeZone: z.string() }),
  sheets: z.array(z.object({ data: z.array(z.object({
    rowData: z.array(z.object({ values: z.array(z.object({
      effectiveValue: z.object({
        stringValue: z.string().optional(),
        numberValue: z.number().optional(),
        boolValue: z.boolean().optional(),
        errorValue: z.object({ type: z.string() }).optional(),
      }).optional(),
      formattedValue: z.string().optional(),
      effectiveFormat: z.object({ numberFormat: z.object({ type: z.string() }).optional() }).optional(),
    })).optional() })).optional(),
  })) })),
})

export type SheetSourceValue = string | number | boolean | Date

function serialDate(serial: number, timeZone: string): Date {
  const wallTime = Math.round((serial - 25569) * 86_400_000)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  let instant = wallTime
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
    const displayed = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!)
    const offset = displayed - Math.floor(instant / 1000) * 1000
    instant = wallTime - offset
  }
  return new Date(instant)
}

export function parseSheetGridValues(input: unknown): SheetSourceValue[][] {
  const response = gridResponseSchema.parse(input)
  const rows = response.sheets[0]?.data[0]?.rowData ?? []
  let length = rows.length
  while (length > 0 && !(rows[length - 1]?.values ?? []).some((cell) => cell.effectiveValue)) length--
  return rows.slice(0, length).map((row) => (row.values ?? []).map((cell) => {
    const value = cell.effectiveValue
    if (!value) return ''
    if (value.stringValue !== undefined) return value.stringValue
    if (value.boolValue !== undefined) return value.boolValue
    if (value.numberValue !== undefined) {
      const type = cell.effectiveFormat?.numberFormat?.type
      return type === 'DATE' || type === 'DATE_TIME' || type === 'TIME'
        ? serialDate(value.numberValue, response.properties.timeZone) : value.numberValue
    }
    return cell.formattedValue ?? ''
  }))
}
