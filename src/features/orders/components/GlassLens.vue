<script setup lang="ts">
import { computed, useId } from 'vue'
import { LENS_BLEED_PX, type LensView } from '../composables/use-glass-lens'

const props = withDefaults(defineProps<{
  view: LensView
  edge?: number
  strength?: number
}>(), {
  edge: 0.62,
  strength: 30,
})

const baseId = `glass-lens-${useId()}`
const mapCache = new Map<string, string>()

function displacementMap(width: number, height: number, edgeRatio: number): string {
  const key = `${width}x${height}@${edgeRatio}`
  const cached = mapCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''
  const image = context.createImageData(width, height)
  const radius = height / 2
  const edge = Math.max(1, radius * edgeRatio)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cx = Math.min(Math.max(x + 0.5, radius), width - radius)
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - radius
      const distance = Math.hypot(dx, dy)
      const inset = radius - distance
      let vx = 0
      let vy = 0
      if (distance > 0 && inset < edge) {
        const falloff = (1 - Math.max(0, inset) / edge) ** 2.2
        vx = -(dx / distance) * falloff
        vy = -(dy / distance) * falloff
      }
      const offset = (y * width + x) * 4
      image.data[offset] = Math.round(128 + 127 * vx)
      image.data[offset + 1] = Math.round(128 + 127 * vy)
      image.data[offset + 2] = 128
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const url = canvas.toDataURL()
  mapCache.set(key, url)
  return url
}

const width = computed(() => Math.max(1, Math.round(props.view.width)))
const height = computed(() => Math.max(1, Math.round(props.view.height)))
const outerWidth = computed(() => width.value + LENS_BLEED_PX * 2)
const outerHeight = computed(() => height.value + LENS_BLEED_PX * 2)
const ready = computed(() => props.view.width > 0 && props.view.height > 0)
const map = computed(() => (ready.value ? displacementMap(width.value, height.value, props.edge) : ''))
const filterId = computed(() => `${baseId}-${width.value}x${height.value}`)
</script>

<template>
  <div v-if="ready" class="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]" aria-hidden="true">
    <svg class="absolute size-0">
      <filter
        :id="filterId"
        x="0"
        y="0"
        :width="outerWidth"
        :height="outerHeight"
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
      >
        <feFlood flood-color="rgb(128,128,128)" result="neutral" />
        <feImage :href="map" :x="LENS_BLEED_PX" :y="LENS_BLEED_PX" :width="width" :height="height" preserveAspectRatio="none" result="lens" />
        <feComposite in="lens" in2="neutral" operator="over" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" :scale="strength * 1.1" xChannelSelector="R" yChannelSelector="G" result="shiftR" />
        <feDisplacementMap in="SourceGraphic" in2="map" :scale="strength" xChannelSelector="R" yChannelSelector="G" result="shiftG" />
        <feDisplacementMap in="SourceGraphic" in2="map" :scale="strength * 0.9" xChannelSelector="R" yChannelSelector="G" result="shiftB" />
        <feColorMatrix in="shiftR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
        <feColorMatrix in="shiftG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
        <feColorMatrix in="shiftB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
        <feComposite in="red" in2="green" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="redGreen" />
        <feComposite in="redGreen" in2="blue" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
      </filter>
    </svg>
    <div
      class="lens-source absolute bg-surface"
      :style="{
        left: `${-LENS_BLEED_PX}px`,
        top: `${-LENS_BLEED_PX}px`,
        width: `${outerWidth}px`,
        height: `${outerHeight}px`,
        filter: `url(#${filterId}) blur(0.5px) saturate(1.7) brightness(0.9) contrast(1.05)`,
      }"
    >
      <img
        v-for="(tile, index) in view.tiles"
        :key="`${tile.src}-${index}`"
        :src="tile.src"
        alt=""
        draggable="false"
        class="absolute max-w-none object-cover"
        :style="{ left: `${tile.x}px`, top: `${tile.y}px`, width: `${tile.width}px`, height: `${tile.height}px` }"
      >
    </div>
  </div>
</template>
