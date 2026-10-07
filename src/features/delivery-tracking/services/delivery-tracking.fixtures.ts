import type { DeliveryTrackingView } from '../delivery-tracking.types'

const SAMPLE = '/delivery-tracking-sample'

interface FixtureBag {
  orderImageId: string
  weightKg: number
  weighedAt: string
  note: string | null
  photoUrl: string | null
  thumbnailUrl: string | null
}

interface FixtureOrder {
  customerIndex: string
  orderId: string
  receivedDate: string
  statusLabel: string
  deliveredAt: string | null
  proofOfDeliveryUrl: string | null
  bags: FixtureBag[]
}

const FIXTURE_ORDERS: FixtureOrder[] = [
  {
    customerIndex: 'TSK',
    orderId: 'ORD-be2f58f2',
    receivedDate: '2026-10-06',
    statusLabel: 'Delivered',
    deliveredAt: '2026-10-08 14:20:00',
    proofOfDeliveryUrl: `${SAMPLE}/proof.svg`,
    bags: [
      { orderImageId: 'e06ace06', weightKg: 12.6, weighedAt: '2026-10-07 03:15:00', note: '2 pillows inside', photoUrl: `${SAMPLE}/bag-scale.svg`, thumbnailUrl: `${SAMPLE}/bag-scale.svg` },
      { orderImageId: '3f9b21c7', weightKg: 3.25, weighedAt: '2026-10-07 03:17:00', note: null, photoUrl: `${SAMPLE}/bag-scale.svg`, thumbnailUrl: `${SAMPLE}/bag-scale.svg` },
      { orderImageId: '7d40e8a5', weightKg: 8.4, weighedAt: '2026-10-07 03:19:00', note: null, photoUrl: null, thumbnailUrl: null },
    ],
  },
  {
    customerIndex: 'MNK',
    orderId: 'ORD-4c91d07a',
    receivedDate: '2026-10-07',
    statusLabel: 'Being cleaned',
    deliveredAt: null,
    proofOfDeliveryUrl: null,
    bags: [
      { orderImageId: 'a1b2c3d4', weightKg: 5.8, weighedAt: '2026-10-07 09:40:00', note: null, photoUrl: `${SAMPLE}/bag-scale.svg`, thumbnailUrl: `${SAMPLE}/bag-scale.svg` },
      { orderImageId: '5e6f7a8b', weightKg: 2.1, weighedAt: '2026-10-07 09:42:00', note: 'Delicate', photoUrl: null, thumbnailUrl: null },
    ],
  },
  {
    customerIndex: 'PLM',
    orderId: 'ORD-90ab12ce',
    receivedDate: '2026-10-06',
    statusLabel: 'Delivered',
    deliveredAt: '2026-10-08 14:20:00',
    proofOfDeliveryUrl: `${SAMPLE}/proof.svg`,
    bags: [
      { orderImageId: 'f4a11ed0', weightKg: 12.6, weighedAt: '2026-10-07 03:15:00', note: null, photoUrl: `${SAMPLE}/missing.jpg`, thumbnailUrl: null },
    ],
  },
]

export function findFixtureView(orderImageId: string): DeliveryTrackingView | null {
  for (const order of FIXTURE_ORDERS) {
    const index = order.bags.findIndex(bag => bag.orderImageId === orderImageId)
    if (index < 0) continue
    const bag = order.bags[index]!
    return {
      orderImageId: bag.orderImageId,
      weightPhoto: { url: bag.photoUrl, weightKg: bag.weightKg, weighedAt: bag.weighedAt, note: bag.note },
      bagIndex: index + 1,
      bagCount: order.bags.length,
      otherBags: order.bags
        .map((other, position) => ({ orderImageId: other.orderImageId, bagIndex: position + 1, weightKg: other.weightKg, thumbnailUrl: other.thumbnailUrl }))
        .filter(other => other.orderImageId !== orderImageId),
      customerIndex: order.customerIndex,
      orderId: order.orderId,
      receivedDate: order.receivedDate,
      statusLabel: order.statusLabel,
      deliveredAt: order.deliveredAt,
      proofOfDeliveryUrl: order.proofOfDeliveryUrl,
    }
  }
  return null
}
