<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref } from 'vue'
import { startBarcodeScanner } from '@/shared/utils/barcode-scanner'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

type ScanEntry = {
  value: string
  format: string
  scannedAt: string
}

const videoRef = ref<HTMLVideoElement | null>(null)
const scans = ref<ScanEntry[]>([])
const isStarting = ref(false)
const isRunning = ref(false)
const errorMessage = ref('')
const torchAvailable = ref(false)
const torchOn = ref(false)
const scanPulse = ref(false)
const seenValues = new Set<string>()
let stream: MediaStream | null = null
let stopDecode: (() => void) | null = null
let audioContext: AudioContext | null = null
let pulseTimer: number | null = null
let scannerStartToken = 0

const latestScan = computed(() => scans.value[0] ?? null)

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตกล้องใน browser แล้วลองใหม่'
    if (error.name === 'NotFoundError') return 'ไม่พบกล้องบนอุปกรณ์นี้'
    if (error.name === 'NotReadableError') return 'กล้องกำลังถูกใช้งานโดยแอปอื่น'
  }

  return 'เปิดกล้องไม่สำเร็จ กรุณาลองใหม่'
}

function prepareAudio() {
  if (audioContext || !('AudioContext' in window)) return

  try {
    audioContext = new AudioContext()
  } catch {
    audioContext = null
  }
}

function playScanFeedback() {
  navigator.vibrate?.(70)

  if (audioContext) {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.08, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.09)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.09)
  }

  scanPulse.value = true
  if (pulseTimer !== null) window.clearTimeout(pulseTimer)
  pulseTimer = window.setTimeout(() => {
    scanPulse.value = false
    pulseTimer = null
  }, 260)
}

function handleTerminalScanError(startToken: number) {
  if (startToken !== scannerStartToken) return

  stopScanner()
  errorMessage.value = 'กล้องหยุดทำงาน กรุณากดเปิดกล้องเพื่อลองใหม่'
}

function acceptResult(rawValue: string, format: string) {
  const value = rawValue.trim()
  if (!value || seenValues.has(value)) return

  seenValues.add(value)
  scans.value.unshift({
    value,
    format: format === 'qr_code' ? 'QR Code' : 'Code 128',
    scannedAt: new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date()),
  })
  playScanFeedback()
}

async function startScanner() {
  if (isRunning.value || isStarting.value) return

  const startToken = ++scannerStartToken
  errorMessage.value = ''
  isStarting.value = true

  if (!navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'อุปกรณ์นี้ไม่รองรับกล้องผ่าน browser หรือไม่ได้เปิดผ่าน HTTPS'
    isStarting.value = false
    return
  }

  try {
    prepareAudio()
    try {
      await audioContext?.resume()
    } catch {
    }
    await nextTick()
    if (startToken !== scannerStartToken) return
    const video = videoRef.value
    if (!video) throw new Error('Video element unavailable')

    const nextStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    if (startToken !== scannerStartToken) {
      nextStream.getTracks().forEach(track => track.stop())
      return
    }

    stream = nextStream
    video.srcObject = nextStream
    await video.play()
    const nextStop = await startBarcodeScanner(video, acceptResult, () => handleTerminalScanError(startToken))
    if (startToken !== scannerStartToken) {
      nextStop()
      return
    }

    stopDecode = nextStop
    const capabilities = nextStream.getVideoTracks()[0]?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
    torchAvailable.value = Boolean(capabilities?.torch)
    isRunning.value = true
  } catch (error) {
    if (startToken !== scannerStartToken) return
    stopScanner()
    errorMessage.value = getCameraErrorMessage(error)
  } finally {
    if (startToken === scannerStartToken) isStarting.value = false
  }
}

function stopScanner() {
  scannerStartToken++
  stopDecode?.()
  stopDecode = null
  if (videoRef.value) videoRef.value.srcObject = null
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  isStarting.value = false
  isRunning.value = false
  torchAvailable.value = false
  torchOn.value = false
}

async function toggleTorch() {
  const track = stream?.getVideoTracks()[0]
  if (!track || !torchAvailable.value) return

  try {
    const nextValue = !torchOn.value
    await track.applyConstraints({ advanced: [{ torch: nextValue } as MediaTrackConstraintSet & { torch: boolean }] })
    torchOn.value = nextValue
  } catch {
    torchAvailable.value = false
    torchOn.value = false
  }
}

function clearScans() {
  scans.value = []
  seenValues.clear()
}

function disposeScanner() {
  stopScanner()
  if (pulseTimer !== null) window.clearTimeout(pulseTimer)
  void audioContext?.close()
  audioContext = null
}

onDeactivated(stopScanner)
onBeforeUnmount(disposeScanner)
</script>

<template>
  <AppLayout>
    <ScrollRegion as="main" class="bg-surface">
      <section class="mx-auto flex min-h-full w-full max-w-xl flex-col gap-4 p-4 pb-24">
        <header>
          <p class="font-label text-xs font-bold uppercase tracking-[0.14em] text-secondary">Prototype</p>
          <h2 class="mt-1 font-headline text-2xl font-bold text-on-surface">ทดสอบสแกนแท็ก</h2>
          <p class="mt-1 text-sm leading-6 text-on-surface-variant">
            อ่าน QR Code และ Code 128 จากกล้องหลัง ผลลัพธ์หน้านี้เป็นรหัสดิบและยังไม่ค้นหาออเดอร์
          </p>
        </header>

        <div class="overflow-hidden rounded-xl bg-black shadow-lg">
          <div class="relative aspect-[4/3]">
            <video
              ref="videoRef"
              class="h-full w-full object-cover"
              autoplay
              muted
              playsinline
            />

            <div v-if="!isRunning" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-primary px-8 text-center text-on-primary">
              <span class="material-symbols-outlined text-5xl" :class="{ 'animate-spin': isStarting }">
                {{ isStarting ? 'progress_activity' : 'qr_code_scanner' }}
              </span>
              <p class="text-sm text-on-primary/80">
                {{ isStarting ? 'กำลังเปิดกล้อง…' : 'กดเปิดกล้อง แล้วหันกล้องหลังไปที่แท็ก' }}
              </p>
            </div>

            <div v-else class="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div
                class="relative h-36 w-full rounded-lg border-2 transition-colors duration-200"
                :class="scanPulse ? 'border-lime bg-lime/15' : 'border-white/80'"
              >
                <span class="absolute -left-0.5 -top-0.5 h-7 w-7 border-l-4 border-t-4 border-lime" />
                <span class="absolute -right-0.5 -top-0.5 h-7 w-7 border-r-4 border-t-4 border-lime" />
                <span class="absolute -bottom-0.5 -left-0.5 h-7 w-7 border-b-4 border-l-4 border-lime" />
                <span class="absolute -bottom-0.5 -right-0.5 h-7 w-7 border-b-4 border-r-4 border-lime" />
              </div>
            </div>

            <div v-if="isRunning" class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8">
              <span class="rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white">
                กำลังสแกน
              </span>
              <button
                v-if="torchAvailable"
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:scale-95"
                :aria-pressed="torchOn"
                :aria-label="torchOn ? 'ปิดไฟฉาย' : 'เปิดไฟฉาย'"
                @click="toggleTorch"
              >
                <span class="material-symbols-outlined">{{ torchOn ? 'flashlight_on' : 'flashlight_off' }}</span>
              </button>
            </div>
          </div>

          <div class="flex gap-2 bg-primary p-3">
            <button
              v-if="!isRunning"
              type="button"
              class="min-h-12 flex-1 rounded-full bg-lime px-5 py-3 font-semibold text-primary active:scale-[0.98] disabled:opacity-50"
              :disabled="isStarting"
              @click="startScanner"
            >
              {{ isStarting ? 'กำลังเปิดกล้อง…' : 'เปิดกล้อง' }}
            </button>
            <button
              v-else
              type="button"
              class="min-h-12 flex-1 rounded-full border border-white/40 px-5 py-3 font-semibold text-white active:scale-[0.98]"
              @click="stopScanner"
            >
              หยุดกล้อง
            </button>
          </div>
        </div>

        <p v-if="errorMessage" role="alert" class="rounded-lg bg-error-container px-4 py-3 text-sm leading-5 text-on-error-container">
          {{ errorMessage }}
        </p>

        <section class="rounded-xl bg-surface-container-lowest p-4 shadow-sm ring-1 ring-outline-variant/50">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold text-on-surface-variant">ผลล่าสุด</p>
              <p v-if="latestScan" class="mt-1 break-all font-headline text-2xl font-bold text-primary">
                {{ latestScan.value }}
              </p>
              <p v-else class="mt-2 text-sm text-on-surface-variant">ยังไม่มีผลการสแกน</p>
            </div>
            <span v-if="latestScan" class="shrink-0 rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
              {{ latestScan.format }}
            </span>
          </div>
        </section>

        <section class="rounded-xl bg-surface-container-lowest shadow-sm ring-1 ring-outline-variant/50">
          <div class="flex items-center justify-between border-b border-outline-variant/50 px-4 py-3">
            <h3 class="font-headline font-bold">รายการที่อ่านได้ ({{ scans.length }})</h3>
            <button
              v-if="scans.length"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm font-semibold text-error active:bg-error-container"
              @click="clearScans"
            >
              ล้างรายการ
            </button>
          </div>

          <div v-if="!scans.length" class="px-4 py-8 text-center text-sm text-on-surface-variant">
            รหัสแต่ละตัวจะถูกนับครั้งเดียวจนกว่าจะล้างรายการ
          </div>
          <ol v-else class="divide-y divide-outline-variant/50">
            <li v-for="(scan, index) in scans" :key="scan.value" class="flex items-center gap-3 px-4 py-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
                {{ scans.length - index }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-on-surface">{{ scan.value }}</p>
                <p class="text-xs text-on-surface-variant">{{ scan.format }} · {{ scan.scannedAt }}</p>
              </div>
            </li>
          </ol>
        </section>
      </section>
    </ScrollRegion>
  </AppLayout>
</template>
