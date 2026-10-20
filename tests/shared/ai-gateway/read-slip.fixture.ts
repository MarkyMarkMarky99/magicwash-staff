export const slipResult = {
  priceGroup: 'CRYO',
  header: {
    senderName: 'SoJa', collectionDate: { text: '13 09 2569', date: '2026-09-13' },
    deliveryDate: { text: null, date: null }, receiverName: 'Zaw', totalWeight: '8-9 kg',
  },
  items: [
    { itemCode: 'ITM-0117', nameTh: 'ชุดคลุมขาว', nameEn: 'White Bathrobe', count: 8 },
    { itemCode: 'ITM-0100', nameTh: 'ชุดคลุมน้ำเงิน', nameEn: 'Blue Bathrobe', count: null },
  ],
  unlisted: [{ name: 'ปลอกแขน', count: 2 }],
  warnings: [{ field: 'header.collectionDate', source: 'ai' as const, message: 'An additional date is written beneath the collection date.' }],
}

export const successEnvelope = (result: object = slipResult) => ({
  ok: true, requestId: 'req-1', task: 'read-slip', taskVersion: 1, ms: 123, result,
})

export const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
