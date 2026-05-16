import { nextTick, ref } from 'vue'

const DEFAULT_CAMERA_CONSTRAINTS = {
  video: true,
  audio: false,
}

const ENVIRONMENT_CAMERA_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
}

function getCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') return 'ไม่ได้รับอนุญาตให้ใช้กล้อง'
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'ไม่พบกล้องในอุปกรณ์นี้'
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') return 'กล้องกำลังถูกใช้งานโดยแอปอื่น'
  return 'เปิดกล้องไม่สำเร็จ'
}

async function requestCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia(DEFAULT_CAMERA_CONSTRAINTS)
  } catch (error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'NotReadableError') throw error
    return navigator.mediaDevices.getUserMedia(ENVIRONMENT_CAMERA_CONSTRAINTS)
  }
}

async function logCameraDevices(error) {
  try {
    const permission = await navigator.permissions?.query?.({ name: 'camera' })
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices.filter((device) => device.kind === 'videoinput')
    console.error('Camera start failed:', {
      name: error?.name,
      message: error?.message,
      isSecureContext: window.isSecureContext,
      permissionState: permission?.state,
      videoInputCount: videoInputs.length,
      videoInputs: videoInputs.map((device) => ({
        deviceId: device.deviceId,
        groupId: device.groupId,
        label: device.label,
      })),
    })
  } catch {
    console.error('Camera start failed:', error)
  }
}

export function useCameraStream(videoRef, isActive = () => true) {
  const stream = ref(null)
  const errorMessage = ref('')
  const isStarting = ref(false)
  let startToken = 0

  async function startCamera() {
    if (!isActive() || stream.value || isStarting.value) return

    const token = ++startToken
    errorMessage.value = ''

    if (!navigator.mediaDevices?.getUserMedia) {
      errorMessage.value = 'กล้องใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost'
      return
    }

    isStarting.value = true

    try {
      const mediaStream = await requestCameraStream()

      if (!isActive() || token !== startToken) {
        mediaStream.getTracks().forEach((track) => track.stop())
        return
      }

      stream.value = mediaStream
      await nextTick()

      if (!isActive() || token !== startToken) {
        mediaStream.getTracks().forEach((track) => track.stop())
        if (stream.value === mediaStream) stream.value = null
        return
      }

      if (videoRef.value) {
        videoRef.value.srcObject = mediaStream
        await videoRef.value.play()
      }
    } catch (err) {
      if (!isActive() || token !== startToken) return
      logCameraDevices(err)
      errorMessage.value = getCameraErrorMessage(err)
    } finally {
      if (token === startToken) isStarting.value = false
    }
  }

  function stopCamera() {
    startToken++
    if (videoRef.value) videoRef.value.srcObject = null
    stream.value?.getTracks().forEach((track) => track.stop())
    stream.value = null
    isStarting.value = false
  }

  return {
    stream,
    errorMessage,
    isStarting,
    startCamera,
    stopCamera,
  }
}
