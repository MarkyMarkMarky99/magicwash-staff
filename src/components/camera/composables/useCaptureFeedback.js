import { nextTick, ref } from 'vue'

const CAPTURE_FEEDBACK_MS = 900

export function drawCanvasCover(targetCanvas, sourceCanvas) {
  const rect = targetCanvas.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio || 1
  const targetWidth = Math.max(1, Math.round(rect.width * pixelRatio))
  const targetHeight = Math.max(1, Math.round(rect.height * pixelRatio))

  targetCanvas.width = targetWidth
  targetCanvas.height = targetHeight

  const sourceRatio = sourceCanvas.width / sourceCanvas.height
  const targetRatio = targetWidth / targetHeight
  let sx = 0
  let sy = 0
  let sw = sourceCanvas.width
  let sh = sourceCanvas.height

  if (sourceRatio > targetRatio) {
    sw = Math.round(sourceCanvas.height * targetRatio)
    sx = Math.round((sourceCanvas.width - sw) / 2)
  } else {
    sh = Math.round(sourceCanvas.width / targetRatio)
    sy = Math.round((sourceCanvas.height - sh) / 2)
  }

  const context = targetCanvas.getContext('2d')
  if (!context) throw new Error('Canvas context unavailable')
  context.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
}

export function useCaptureFeedback(flyoutCanvasRef) {
  const flashActive = ref(false)
  const flyoutActive = ref(false)
  const previewPulse = ref(false)

  let flashTimer = null
  let flyoutTimer = null
  let previewStartTimer = null
  let previewTimer = null
  let shutterTimer = null

  function clearPreviewTimers() {
    window.clearTimeout(flyoutTimer)
    window.clearTimeout(previewStartTimer)
    window.clearTimeout(previewTimer)
    flyoutTimer = null
    previewStartTimer = null
    previewTimer = null
  }

  function clearTimers() {
    clearPreviewTimers()
    window.clearTimeout(flashTimer)
    window.clearTimeout(shutterTimer)
    flashTimer = null
    shutterTimer = null
  }

  function showShutterFlash() {
    window.clearTimeout(flashTimer)
    flashActive.value = true

    flashTimer = window.setTimeout(() => {
      flashActive.value = false
      flashTimer = null
    }, 140)
  }

  function scheduleShutterRelease(callback) {
    window.clearTimeout(shutterTimer)
    shutterTimer = window.setTimeout(() => {
      callback()
      shutterTimer = null
    }, CAPTURE_FEEDBACK_MS)
  }

  async function showFlyout(canvas) {
    try {
      clearPreviewTimers()
      flyoutActive.value = false
      previewPulse.value = false

      await nextTick()
      flyoutActive.value = true

      await nextTick()
      if (flyoutCanvasRef.value) drawCanvasCover(flyoutCanvasRef.value, canvas)

      flyoutTimer = window.setTimeout(() => {
        flyoutActive.value = false
        flyoutTimer = null
      }, CAPTURE_FEEDBACK_MS)
    } catch {
      flyoutActive.value = false
      previewPulse.value = false
    }
  }

  function pulsePreview() {
    window.clearTimeout(previewStartTimer)
    window.clearTimeout(previewTimer)
    previewPulse.value = false

    previewStartTimer = window.setTimeout(() => {
      previewPulse.value = true
    }, 0)

    previewTimer = window.setTimeout(() => {
      previewPulse.value = false
      previewTimer = null
    }, 340)
  }

  function resetFeedback() {
    flashActive.value = false
    flyoutActive.value = false
    previewPulse.value = false
    clearTimers()
  }

  return {
    flashActive,
    flyoutActive,
    previewPulse,
    showShutterFlash,
    scheduleShutterRelease,
    showFlyout,
    pulsePreview,
    resetFeedback,
  }
}
