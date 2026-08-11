const MONTHS = new Map([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12],
])

/** Normalize the known sheet/GViz date shapes for comparison/UI. */
export function normalizeSheetDate(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const input = value.trim()
  if (input === '') return null

  const gvizMatch = input.match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (gvizMatch) {
    const [, year, month, day] = gvizMatch
    return validDate(year, Number(month) + 1, day)
  }

  const displayMatch = input.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (displayMatch) {
    const [, day, monthName, year] = displayMatch
    const month = MONTHS.get(monthName.toLowerCase())
    return month === undefined ? null : validDate(year, month, day)
  }

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return validDate(year, month, day)
  }

  return null
}

function validDate(year: string, month: string | number, day: string): string | null {
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay))

  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return null
  }

  return `${year.padStart(4, '0')}-${String(numericMonth).padStart(2, '0')}-${String(numericDay).padStart(2, '0')}`
}
