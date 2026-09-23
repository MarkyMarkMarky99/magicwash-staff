export type BarcodeFormat = 'qr_code' | 'code_128'
export type Detector = { detect(video: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]> }
export type DetectorConstructor = {
  new (options: { formats: BarcodeFormat[] }): Detector
  getSupportedFormats(): Promise<readonly string[]>
}

export async function nativeFormats({ BarcodeDetector: constructor }: { BarcodeDetector?: DetectorConstructor }): Promise<BarcodeFormat[] | null> {
  if (!constructor) return null
  const supported = await constructor.getSupportedFormats()
  if (!supported.includes('qr_code')) return null
  return supported.includes('code_128') ? ['qr_code', 'code_128'] : ['qr_code']
}
