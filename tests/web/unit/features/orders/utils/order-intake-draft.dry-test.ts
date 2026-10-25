import assert from 'node:assert/strict'
import test from 'node:test'
import {
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

function photo(id: string, category: OrderIntakePhoto['category']): OrderIntakePhoto {
  return { id, category, file: new File([], `${id}.jpg`), previewUrl: `blob:${id}` }
}

function garment(tag: string, itemId: string | null): OrderIntakeGarment {
  return { tag, itemId, imageUrl: `https://example.test/${tag}.jpg` }
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

test('save body lists items from rows and uploaded image URLs', () => {
  const garments = [
    garment('AAAA0001', 'i-shirt'),
    garment('AAAA0002', 'i-dress'),
    garment('AAAA0003', 'i-shirt'),
  ]
  const draft = draftOf(garments, [
    photo('p1', 'document'),
    photo('p3', 'belonging'),
  ])
  const body = orderIntakeSaveBody(draft, groupOrderIntakeGarments(garments, catalog).rows, {
    p1: { status: 'done', url: 'https://firebasestorage.googleapis.com/document' },
    p3: { status: 'done', url: 'https://firebasestorage.googleapis.com/belonging' },
  })
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
    images: [
      { imageType: 'DOCUMENT', imageUrl: 'https://firebasestorage.googleapis.com/document' },
      { imageType: 'BELONGING', imageUrl: 'https://firebasestorage.googleapis.com/belonging' },
    ],
  })
  const itemTags = body.items.flatMap((item) => item.tags).sort()
  assert.deepEqual(itemTags, garments.map((entry) => entry.tag).sort())
})

test('save body refuses Uncategorized garments', () => {
  const garments = [garment('AAAA0001', null)]
  assert.throws(() => orderIntakeSaveBody(draftOf(garments), groupOrderIntakeGarments(garments, catalog).rows, {}), /Uncategorized/)
})

test('save body refuses missing, uploading and failed photos', () => {
  const garments = [garment('AAAA0001', 'i-shirt')]
  const draft = draftOf(garments, [photo('p1', 'document')])
  const rows = groupOrderIntakeGarments(garments, catalog).rows
  for (const uploads of [{}, { p1: { status: 'uploading' as const, url: null } }, { p1: { status: 'failed' as const, url: null } }, { p1: { status: 'done' as const, url: null } }]) {
    assert.throws(() => orderIntakeSaveBody(draft, rows, uploads), /every photo to upload/)
  }
})
