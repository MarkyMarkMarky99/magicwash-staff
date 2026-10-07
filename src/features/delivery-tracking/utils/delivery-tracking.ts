import { formatSheetDateTime } from '@/shared/utils/sheet-date'

export const DELIVERY_TRACKING_ROUTE_NAME = 'delivery-tracking'

export const SHOP_LINE_ID = '@magicwash'
export const SHOP_LINE_URL = 'https://line.me/R/ti/p/@magicwash'
export const SHOP_PHONE = '02-xxx-xxxx'
export const SHOP_PHONE_URL = 'tel:02-xxx-xxxx'

export function formatTrackingDateTime(value: string): string {
  const formatted = formatSheetDateTime(value)
  const match = /^(.+) (\d{2}:\d{2}):\d{2}$/.exec(formatted)
  return match ? `${match[1]} · ${match[2]}` : formatted
}

export function toDatetimeAttribute(value: string): string {
  return `${value.replace(' ', 'T')}+07:00`
}
