import type { Detector } from './barcode-scanner-selection'

export function startScanLoop(
  video: HTMLVideoElement,
  detector: Detector,
  onResult: (value: string, format: string) => void,
  onError: (error: unknown) => void,
  shouldScan: () => boolean,
): () => void {
  let active = true
  let frameId = 0
  const useVideoFrames = typeof video.requestVideoFrameCallback === 'function'

  function stop(): void {
    active = false
    if (useVideoFrames) video.cancelVideoFrameCallback(frameId)
    else cancelAnimationFrame(frameId)
  }

  function schedule(): void {
    if (!active) return
    if (useVideoFrames) frameId = video.requestVideoFrameCallback(() => { void scan() })
    else frameId = requestAnimationFrame(() => { void scan() })
  }

  async function scan(): Promise<void> {
    if (!active) return
    try {
      if (shouldScan() && video.readyState >= 2) {
        const results = await detector.detect(video)
        if (active && shouldScan()) {
          for (const result of results) {
            if (!active || !shouldScan()) break
            onResult(result.rawValue, result.format)
          }
        }
      }
    } catch (error) {
      if (active) {
        stop()
        onError(error)
      }
    } finally {
      schedule()
    }
  }

  schedule()
  return stop
}
