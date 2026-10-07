<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import DeliveryTrackingBagList from '../components/DeliveryTrackingBagList.vue'
import DeliveryTrackingFacts from '../components/DeliveryTrackingFacts.vue'
import DeliveryTrackingFooter from '../components/DeliveryTrackingFooter.vue'
import DeliveryTrackingNotFound from '../components/DeliveryTrackingNotFound.vue'
import DeliveryTrackingPhoto from '../components/DeliveryTrackingPhoto.vue'
import DeliveryTrackingSkeleton from '../components/DeliveryTrackingSkeleton.vue'
import DeliveryTrackingTopBar from '../components/DeliveryTrackingTopBar.vue'
import DeliveryTrackingWeightTab from '../components/DeliveryTrackingWeightTab.vue'
import { useDeliveryTracking } from '../composables/useDeliveryTracking'
import { useRouteViewer } from '../composables/useRouteViewer'
import { formatTrackingDateTime } from '../utils/delivery-tracking'

defineOptions({ name: 'DeliveryTrackingPage' })

const route = useRoute()
const orderImageId = computed(() => String(route.params.orderImageId))
const { status, view } = useDeliveryTracking(orderImageId)

const weightViewer = useRouteViewer('photo', 'weight')
const proofViewer = useRouteViewer('proof', '1')

const weightImages = computed(() => {
  const url = view.value?.weightPhoto.url
  return url ? [{ id: 'weight', src: url, alt: 'Your bag on the shop scale' }] : []
})
const proofImages = computed(() => {
  const url = view.value?.proofOfDeliveryUrl
  return url ? [{ id: 'proof', src: url, alt: 'Your bags at delivery' }] : []
})

const currentBag = computed(() => {
  const current = view.value
  if (!current) return null
  return {
    orderImageId: current.orderImageId,
    bagIndex: current.bagIndex,
    weightKg: current.weightPhoto.weightKg,
    thumbnailUrl: current.weightPhoto.url,
  }
})
</script>

<template>
  <div class="flex h-full flex-col bg-surface font-body text-on-surface">
    <DeliveryTrackingTopBar />
    <ScrollRegion as="main" aria-label="Your bag">
      <div class="flex min-h-full flex-col">
        <DeliveryTrackingSkeleton v-if="status === 'loading'" />

        <DeliveryTrackingNotFound v-else-if="status === 'notFound'" :order-image-id="orderImageId" />

        <template v-else-if="view && currentBag">
          <DeliveryTrackingPhoto
            :url="view.weightPhoto.url"
            alt="Your bag on the shop scale"
            @open="weightViewer.open"
          />
          <DeliveryTrackingWeightTab
            :weight-kg="view.weightPhoto.weightKg"
            :weighed-at="view.weightPhoto.weighedAt"
            :bag-index="view.bagIndex"
            :bag-count="view.bagCount"
          />

          <div class="px-4 pb-7 pt-[22px]">
            <DeliveryTrackingBagList
              v-if="view.otherBags.length > 0"
              :current="currentBag"
              :other-bags="view.otherBags"
            />

            <div role="status" class="mb-5 flex items-center gap-2.5 rounded-xl bg-primary px-3.5 py-3 text-on-primary">
              <span class="h-2.5 w-2.5 flex-none rounded-full bg-lime" aria-hidden="true" />
              <div>
                <small class="block text-xs leading-tight text-on-primary/70">Order status</small>
                <strong class="text-[17px] font-semibold leading-snug">{{ view.statusLabel }}</strong>
              </div>
            </div>

            <DeliveryTrackingFacts
              :customer-index="view.customerIndex"
              :order-id="view.orderId"
              :received-date="view.receivedDate"
              :delivered-at="view.deliveredAt"
              :has-proof-of-delivery="view.proofOfDeliveryUrl !== null"
              @open-proof="proofViewer.open"
            />

            <div
              v-if="view.weightPhoto.note"
              class="rounded-l-sm rounded-r-[10px] border border-l-4 border-outline-variant border-l-primary-container bg-surface-container-lowest px-3.5 py-3"
            >
              <div class="text-xs font-medium text-on-surface-variant">Note on this photo</div>
              <p class="m-0 mt-0.5 font-medium">{{ view.weightPhoto.note }}</p>
            </div>
          </div>
        </template>

        <DeliveryTrackingFooter v-if="status !== 'loading'" :tag-id="view?.orderImageId" :show-questions="status === 'ready'" />
      </div>
    </ScrollRegion>

    <template v-if="view">
      <PhotoViewer
        :images="weightImages"
        :active-id="weightViewer.isOpen.value ? 'weight' : null"
        @close="weightViewer.close"
      >
        <template #footer>
          <span class="text-sm font-medium">{{ view.weightPhoto.weightKg }} kg · {{ formatTrackingDateTime(view.weightPhoto.weighedAt) }}</span>
          <span class="text-[13px] text-white/80">Bag {{ view.bagIndex }} of {{ view.bagCount }} · Tag {{ view.orderImageId }}</span>
        </template>
      </PhotoViewer>
      <PhotoViewer
        :images="proofImages"
        :active-id="proofViewer.isOpen.value ? 'proof' : null"
        @close="proofViewer.close"
      >
        <template #footer>
          <span class="text-sm font-medium">Proof of delivery · {{ view.deliveredAt ? formatTrackingDateTime(view.deliveredAt) : '' }}</span>
          <span class="text-[13px] text-white/80">Order {{ view.orderId }} · {{ view.bagCount }} {{ view.bagCount === 1 ? 'bag' : 'bags' }}</span>
        </template>
      </PhotoViewer>
    </template>
  </div>
</template>
