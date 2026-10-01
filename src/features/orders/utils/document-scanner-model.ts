export const DETECTION_OPTIONS = {
  detector: 'ml' as const,
  mode: 'detect' as const,
  ml: { assetBaseUrl: '/scanic-ml/' },
}

type ScannerInstance = InstanceType<typeof import('scanic').Scanner>

let scannerPromise: Promise<ScannerInstance> | null = null
let preloadScheduled = false

export function loadDocumentScanner(): Promise<ScannerInstance> {
  if (!scannerPromise) {
    scannerPromise = import('scanic').then(async ({ Scanner }) => {
      const scanner = new Scanner(DETECTION_OPTIONS)
      await scanner.initialize()
      return scanner
    }).catch((error: unknown) => {
      scannerPromise = null
      throw error
    })
  }
  return scannerPromise
}

export function preloadDocumentScanner(): void {
  if (preloadScheduled || scannerPromise) return
  preloadScheduled = true
  const start = () => { void loadDocumentScanner().catch(() => {}) }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 5000 })
  else setTimeout(start, 2000)
}
