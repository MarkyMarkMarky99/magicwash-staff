import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'
import { checkAiGatewayHealth } from '@shared/ai-gateway/ai-gateway.client'
import { readSlip, type ReadSlipResult } from '@shared/ai-gateway/tasks/read-slip'
import { downscaleSlip } from '@/features/orders/utils/downscale-slip'

type SlipReadingStatus = 'idle' | 'reading' | 'done' | 'failed' | 'unavailable'

export function useSlipReading({ baseUrl, getToken, fetchImpl, prepareFile = downscaleSlip }: {
  baseUrl: string | null
  getToken: () => Promise<string | null>
  fetchImpl?: typeof fetch
  prepareFile?: (file: Blob) => Promise<Blob>
}) {
  const status = ref<SlipReadingStatus>('idle')
  const error = ref<string | null>(null)
  const warnings = ref<ReadSlipResult['warnings']>([])
  const flaggedKeys = ref<string[]>([])
  const result = shallowRef<ReadSlipResult | null>(null)
  let generation = 0
  let controller: AbortController | null = null

  function cancel(): void {
    generation += 1
    controller?.abort()
    controller = null
    status.value = 'idle'
    error.value = null
    warnings.value = []
    flaggedKeys.value = []
    result.value = null
  }

  async function read(file: Blob, priceGroup: string): Promise<void> {
    cancel()
    if (!baseUrl) return
    const current = generation
    controller = new AbortController()
    const signal = controller.signal
    status.value = 'reading'
    try {
      const health = await checkAiGatewayHealth({ baseUrl, fetchImpl, signal })
      if (current !== generation) return
      if (!health?.codexReady) {
        status.value = 'unavailable'
        return
      }
      const photo = await prepareFile(file)
      if (current !== generation) return
      const reading = await readSlip({ baseUrl, getToken, file: photo, filename: 'slip.jpg', priceGroup, signal, fetchImpl })
      if (current !== generation) return
      result.value = reading
      warnings.value = reading.warnings
      status.value = 'done'
    } catch (reason) {
      if (current !== generation) return
      error.value = reason instanceof Error ? reason.message : 'Unable to read the slip. Try again.'
      status.value = 'failed'
    }
  }

  if (getCurrentScope()) onScopeDispose(cancel)
  return { status, error, warnings, flaggedKeys, result, read, cancel }
}
