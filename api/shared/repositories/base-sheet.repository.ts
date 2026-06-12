import type { AppScriptClient } from '../google-sheets/appscript.client'
import type { GVizClient } from '../google-sheets/gviz.client'

export interface BaseSheetRepositoryOptions {
  sheet: string
  gvizClient: GVizClient
  appScriptClient: AppScriptClient
}

/**
 * One sheet (tab) behind the GViz-read / Apps Script-write pair. The generic
 * `ResourceRepository` contract (`shared/sheet-crud`) is what services depend
 * on; this class is just the thin transport those repositories — and complex
 * modules with their own queries — build on.
 */
export class BaseSheetRepository<
  TRow = unknown,
  TCreate = Partial<TRow>,
  TUpdate = Partial<TRow>,
> {
  protected readonly sheet: string
  protected readonly gvizClient: GVizClient
  protected readonly appScriptClient: AppScriptClient

  constructor(options: BaseSheetRepositoryOptions) {
    this.sheet = options.sheet
    this.gvizClient = options.gvizClient
    this.appScriptClient = options.appScriptClient
  }

  get(query: string): Promise<TRow[]> {
    return this.gvizClient.request<TRow>(this.sheet, query)
  }

  create(data: TCreate): Promise<unknown> {
    return this.appScriptClient.append(this.sheet, data)
  }

  update(data: TUpdate): Promise<unknown> {
    return this.appScriptClient.update(this.sheet, data)
  }
}
