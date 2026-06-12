export enum AppScriptAction {
  APPEND = 'APPEND',
  UPDATE = 'UPDATE',
}

export interface AppScriptRequest<TData = unknown> {
  action: AppScriptAction
  sheet: string
  data: TData
}

export interface AppScriptResponse<TData = unknown> {
  success: boolean
  data?: TData
  error?: string
}

export interface GVizColumn {
  id?: string
  label?: string
  type?: string
}

export interface GVizCell {
  v?: unknown
  f?: string
}

export interface GVizTable {
  cols: GVizColumn[]
  rows: Array<{
    c: Array<GVizCell | null>
  }>
}

export interface GVizResponse {
  table: GVizTable
}

export interface GVizClientOptions {
  spreadsheetId: string
  baseUrl?: string
}

export interface AppScriptClientOptions {
  scriptUrl: string
}
