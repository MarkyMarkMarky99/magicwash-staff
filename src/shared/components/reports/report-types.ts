export interface ReportOption<Key extends string = string> {
  key: Key
  label: string
}

export interface ReportBar {
  key: string
  label: string
  value: number
  highlight: boolean
}

export interface ReportDay {
  date: string
  value: number
}

export type ReportStatTone = 'warning' | 'info' | 'lime'

export interface ReportStat {
  key: string
  label: string
  icon: string
  value: string | number
  /** Fill width as a percentage (0-100). */
  share: number
  tone: ReportStatTone
}

export interface ReportRing {
  percentage: number
  completed: number
  total: number
  label: string
  caption?: string
  countText?: string
}

export interface ReportBreakdownRow {
  key: string
  label: string
  /** Muted text after the label. */
  detail?: string
  value: string | number
  /** Muted text after the value. */
  suffix?: string
  /** Bar width as a percentage (0-100). */
  width: number
}
