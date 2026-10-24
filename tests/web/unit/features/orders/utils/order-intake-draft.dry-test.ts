import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allIntakePhotos,
  orderIntakeSaveBody,
  type OrderIntakeDraft,
  type OrderIntakeGarment,
  type OrderIntakePhoto,
} from '@/features/orders/utils/order-intake-draft'
import { groupOrderIntakeGarments } from '@/features/orders/utils/order-intake-items'

const catalog = [
  { id: 'i-shirt', displayNameTh: 'เสื้อเชิ้ต', displayNameEn: 'Shirt' },
  { id: 'i-dress', displayNameTh: 'ชุดเดรส', displayNameEn: 'Dress' },
]

function photo(id: string, category: OrderIntakePhoto['category'], extra: Partial<OrderIntakePhoto> = {}): OrderIntakePhoto {
  return { id, category, file: new File([], `${id}.jpg`), previewUrl: `blob:${id}`, tag: null, weight: null, ...extra }
}

function garment(tag: string, itemId: string | null, extra: Partial<OrderIntakeGarment> = {}): OrderIntakeGarment {
  return { tag, itemId, imageUrl: `https://example.test/${tag}.jpg`, note: null, defectPhotos: [], ...extra }
}

function draftOf(garments: OrderIntakeGarment[], photos: OrderIntakePhoto[] = []): OrderIntakeDraft {
  return {
    customerId: 'CUS-1',
    orderName: '  Weekend  ',
    note: '   ',
    serviceType: 'WSIR',
    receivedDate: '2026-10-24',
    dueDate: '2026-10-26',
    garments,
    photos,
  }
}

test('save body lists items from rows, garments, and image placeholders', () => {
  const garments = [
    garment('AAAA0001', 'i-shirt', { note: '  missing button ', defectPhotos: [photo('d1', 'defect', { tag: 'AAAA0001' })] }),
    garment('AAAA0002', 'i-dress'),
    garment('AAAA0003', 'i-shirt'),
  ]
  const draft = draftOf(garments, [
    photo('p1', 'document'),
    photo('p2', 'weight', { weight: 4.5 }),
    photo('p3', 'belonging'),
  ])
  const body = orderIntakeSaveBody(draft, groupOrderIntakeGarments(garments, catalog).rows)
  assert.deepEqual(body, {
    customerId: 'CUS-1',
    receivedDate: '2026-10-24',
    dueDate: '2026-10-26',
    serviceType: 'WSIR',
    orderName: 'Weekend',
    note: null,
    items: [
      { itemId: 'i-dress', tags: ['AAAA0002'] },
      { itemId: 'i-shirt', tags: ['AAAA0001', 'AAAA0003'] },
    ],
    garments: [
      { tag: 'AAAA0001', note: 'missing button', defectImageUrls: [], registrationImageUrl: null },
      { tag: 'AAAA0002', note: null, defectImageUrls: [], registrationImageUrl: null },
      { tag: 'AAAA0003', note: null, defectImageUrls: [], registrationImageUrl: null },
    ],
    images: [
      { imageType: 'DOCUMENT', imageUrl: '', quantity: null },
      { imageType: 'WEIGHT', imageUrl: '', quantity: 4.5 },
      { imageType: 'BELONGING', imageUrl: '', quantity: null },
    ],
  })
  const itemTags = body.items.flatMap((item) => item.tags).sort()
  assert.deepEqual(itemTags, body.garments.map((entry) => entry.tag).sort())
})

test('save body refuses Uncategorized garments', () => {
  const garments = [garment('AAAA0001', null)]
  assert.throws(() => orderIntakeSaveBody(draftOf(garments), groupOrderIntakeGarments(garments, catalog).rows), /Uncategorized/)
})

test('all photos include the defect photos of every garment', () => {
  const draft = draftOf(
    [garment('AAAA0001', 'i-shirt', { defectPhotos: [photo('d1', 'defect', { tag: 'AAAA0001' })] })],
    [photo('p1', 'document')],
  )
  assert.deepEqual(allIntakePhotos(draft).map((entry) => entry.id), ['p1', 'd1'])
})
