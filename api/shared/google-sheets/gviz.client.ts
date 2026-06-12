import type { GVizClientOptions, GVizResponse } from './google-sheets.types'

export class GVizClient {
  private readonly spreadsheetId: string
  private readonly baseUrl: string

  constructor(options: GVizClientOptions) {
    this.spreadsheetId = options.spreadsheetId
    this.baseUrl = options.baseUrl ?? 'https://docs.google.com/spreadsheets/d'
  }

  async request<TRow = Record<string, unknown>>(sheet: string, query: string): Promise<TRow[]> {
    const url = this.buildUrl(sheet, query)
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`GViz request failed: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    const payload = this.parseResponse(text)

    return this.mapRows<TRow>(payload)
  }

  private buildUrl(sheet: string, query: string): string {
    const url = new URL(`${this.baseUrl}/${this.spreadsheetId}/gviz/tq`)
    url.searchParams.set('sheet', sheet)
    url.searchParams.set('headers', '1')
    url.searchParams.set('tq', query)
    url.searchParams.set('tqx', 'out:json')
    return url.toString()
  }

  private parseResponse(text: string): GVizResponse {
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('GViz response is not valid JSONP')
    }

    return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GVizResponse
  }

  private mapRows<TRow>(payload: GVizResponse): TRow[] {
    const columns = payload.table.cols.map((column, index) => {
      return column.label || column.id || `column_${index}`
    })

    return payload.table.rows.map((row) => {
      return row.c.reduce<Record<string, unknown>>((record, cell, index) => {
        record[columns[index]] = cell?.v ?? null
        return record
      }, {}) as TRow
    })
  }
}
