export interface DeliveryTrackingWeightPhoto {
  url: string | null
  weightKg: number
  weighedAt: string
  note: string | null
}

export interface DeliveryTrackingBag {
  orderImageId: string
  bagIndex: number
  weightKg: number
  thumbnailUrl: string | null
}

export interface DeliveryTrackingView {
  orderImageId: string
  weightPhoto: DeliveryTrackingWeightPhoto
  bagIndex: number
  bagCount: number
  otherBags: DeliveryTrackingBag[]
  customerIndex: string
  orderId: string
  receivedDate: string
  statusLabel: string
  deliveredAt: string | null
  proofOfDeliveryUrl: string | null
}
