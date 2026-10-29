import { requestBagTagPrint } from '../../server/modules/bag-tag-prints/bag-tag-print-client.js'

const bagId = process.argv[2] ?? 'e7f8a9b0'
const pad = (n: number) => String(n).padStart(2, '0')
const d = new Date()
const packedAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

for (const [label, barcodeValue, weightKg] of [['MWB (new)', `MWB-${bagId}`, 1.1], ['8 chars (old)', bagId, 8.8]] as const) {
  const result = await requestBagTagPrint({
    qrValue: `${process.env.BAG_TAG_TRACKING_URL_BASE ?? ''}${bagId}`,
    barcodeValue,
    customerIndex: null,
    weightKg,
    itemCount: null,
    packedAt,
  })
  console.log(label, barcodeValue, '->', result.outcome)
}
