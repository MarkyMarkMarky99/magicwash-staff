import readerWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { nativeFormats, type Detector, type DetectorConstructor } from './barcode-scanner-selection'
import { startScanLoop } from './barcode-scanner-loop'

async function createDetector(): Promise<Detector> {
  const nativeWindow = window as Window & { BarcodeDetector?: DetectorConstructor }
  const native = nativeWindow.BarcodeDetector
  const formats = await nativeFormats(nativeWindow)
  if (native && formats) return new native({ formats })

  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => path.endsWith('.wasm') ? readerWasmUrl : prefix + path,
    },
  })
  return new BarcodeDetector({ formats: ['qr_code', 'code_128'] })
}

export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onResult: (value: string, format: string) => void,
  onError: (error: unknown) => void,
  shouldScan: () => boolean = () => true,
): Promise<() => void> {
  const detector = await createDetector()
  return startScanLoop(video, detector, onResult, onError, shouldScan)
}
