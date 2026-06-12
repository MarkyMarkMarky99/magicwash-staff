import {
  AppScriptAction,
  type AppScriptClientOptions,
  type AppScriptRequest,
  type AppScriptResponse,
} from './google-sheets.types'

export class AppScriptClient {
  private readonly scriptUrl: string

  constructor(options: AppScriptClientOptions) {
    this.scriptUrl = options.scriptUrl
  }

  async request<TResponse = unknown, TData = unknown>(
    action: AppScriptAction,
    sheet: string,
    data: TData,
  ): Promise<TResponse> {
    const response = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        sheet,
        data,
      } satisfies AppScriptRequest<TData>),
    })

    if (!response.ok) {
      throw new Error(`Apps Script request failed: ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as AppScriptResponse<TResponse>

    if (!payload.success) {
      throw new Error(payload.error ?? 'Apps Script request failed')
    }

    return payload.data as TResponse
  }

  append<TResponse = unknown, TData = unknown>(
    sheet: string,
    data: TData,
  ): Promise<TResponse> {
    return this.request<TResponse, TData>(AppScriptAction.APPEND, sheet, data)
  }

  update<TResponse = unknown, TData = unknown>(
    sheet: string,
    data: TData,
  ): Promise<TResponse> {
    return this.request<TResponse, TData>(AppScriptAction.UPDATE, sheet, data)
  }

}
