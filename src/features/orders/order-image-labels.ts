export const ORDER_IMAGE_TYPES = ['WEIGHT', 'BELONGING', 'DOCUMENT'] as const

export type OrderImageType = (typeof ORDER_IMAGE_TYPES)[number]

export const orderImageTypeLabels = {
  WEIGHT: 'น้ำหนัก',
  BELONGING: 'ของลูกค้า',
  DOCUMENT: 'เอกสาร',
} as const

export const orderImageTypeIcons = {
  WEIGHT: 'scale',
  BELONGING: 'shopping_bag',
  DOCUMENT: 'description',
} as const

export const UNKNOWN_ORDER_IMAGE_TYPE_LABEL = 'อื่นๆ'

export function getOrderImageTypeLabel(imageType: string | null | undefined): string {
  const key = (imageType ?? '').trim()
  if (key === '') return UNKNOWN_ORDER_IMAGE_TYPE_LABEL
  return orderImageTypeLabels[key as OrderImageType] ?? key
}
