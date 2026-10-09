import type { Department } from './department-work'
import type { PackagingOrder } from './packaging-bags'

export async function loadPackagingOrder(orderId: string): Promise<PackagingOrder> {
  const garment = (tagId: string, confirmedBagId: string | null = null, waitingFor: Department | null = null) =>
    ({ tagId, imageUrl: null, waitingFor, confirmedBagId })
  return {
    orderId,
    customerName: 'Tanaporn S.',
    customerIndex: 'TSK',
    statusLabel: 'Approved',
    garments: [
      garment('k3m9x2qa', 'bag-1'),
      garment('p7d4n8rt', 'bag-1'),
      garment('w2c6v5hj', 'bag-1'),
      garment('h8t1b3ze', 'bag-1'),
      garment('m5y9f2ud', 'bag-2'),
      garment('q4r7s6lk', 'bag-2'),
      garment('x9a3e5pn'),
      garment('b6j2g8wc'),
      garment('z1n4u7ov'),
      garment('f3k8d2ys'),
      garment('r5t9c1ma', null, 'Ironing'),
      garment('d8v2h6xi', null, 'Washing'),
    ],
    confirmedBags: [
      { id: 'bag-1', photoUrl: null, confirmedAt: '2026-10-09 10:42:00' },
      { id: 'bag-2', photoUrl: null, confirmedAt: '2026-10-09 10:58:00' },
    ],
  }
}
