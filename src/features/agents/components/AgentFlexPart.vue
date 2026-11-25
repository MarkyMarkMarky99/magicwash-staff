<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { TeamAgentCard } from '@/data/team-agent/team-agent.service'
import BaseBadge, { type BadgeTone } from '@/shared/components/BaseBadge.vue'

type FlexBubble = Extract<TeamAgentCard, { type: 'bubble' }>
export type FlexBodyPart = FlexBubble['body'][number]
type FlexPartOf<T extends FlexBodyPart['type']> = Extract<FlexBodyPart, { type: T }>
type FlexTone = NonNullable<FlexPartOf<'text'>['tone']>
export type FlexButtonAction = FlexPartOf<'button'>['action']

const props = defineProps<{ part: FlexBodyPart; messageDisabled?: boolean }>()
const emit = defineEmits<{
  route: [location: RouteLocationRaw]
  message: [text: string]
  photo: [url: string]
}>()

const TEXT_SIZES = { sm: 'text-[12px]', md: 'text-[13.5px]', lg: 'text-base', xl: 'text-lg' } as const
const TEXT_TONES: Record<FlexTone, string> = {
  default: 'text-on-surface',
  muted: 'text-on-surface-variant',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}
const BADGE_TONES: Record<FlexTone, BadgeTone> = {
  default: 'neutral',
  muted: 'neutral',
  primary: 'brand',
  success: 'success',
  warning: 'warning',
  error: 'danger',
}
const LINE_CLAMPS: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
  7: 'line-clamp-7',
  8: 'line-clamp-8',
  9: 'line-clamp-9',
  10: 'line-clamp-10',
}
const BOX_GAPS = { none: 'gap-0', sm: 'gap-1.5', md: 'gap-3' } as const
const IMAGE_ASPECTS = { square: 'aspect-square', wide: 'aspect-video', tall: 'aspect-[3/4]' } as const
const BUTTON_BASE = 'flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50'
const BUTTON_STYLES = {
  primary: `${BUTTON_BASE} h-[46px] rounded-full bg-primary px-4 font-body text-sm font-extrabold text-on-primary`,
  secondary: `${BUTTON_BASE} h-[46px] rounded-full border-[1.5px] border-primary bg-white px-4 font-body text-sm font-extrabold text-primary`,
  link: `${BUTTON_BASE} min-h-[36px] px-2 font-body text-sm font-bold text-primary underline`,
} as const

const textClasses = computed(() => {
  const part = props.part
  if (part.type !== 'text') return ''
  return [
    TEXT_SIZES[part.size ?? 'md'],
    part.weight === 'bold' ? 'font-extrabold' : 'font-medium',
    TEXT_TONES[part.tone ?? 'default'],
    part.maxLines ? LINE_CLAMPS[part.maxLines] : '',
  ]
})

const boxClasses = computed(() => {
  const part = props.part
  if (part.type !== 'box') return ''
  const keyValue = part.contents.length === 2 && part.contents.every(content => content.type === 'text')
  return [
    part.layout === 'row' ? `flex-row flex-wrap items-baseline ${keyValue ? 'justify-between' : ''}` : 'flex-col',
    BOX_GAPS[part.gap ?? 'sm'],
  ]
})

function run(action: FlexButtonAction): void {
  if (action.type === 'message') {
    if (!props.messageDisabled) emit('message', action.text)
    return
  }
  emit('route', { name: action.route, params: action.params })
}
</script>

<template>
  <p v-if="part.type === 'text'" class="whitespace-pre-wrap font-body leading-snug [overflow-wrap:anywhere]" :class="textClasses">{{ part.text }}</p>

  <div v-else-if="part.type === 'box'" class="flex" :class="boxClasses">
    <AgentFlexPart
      v-for="(content, index) in part.contents"
      :key="index"
      :part="content"
      :message-disabled="messageDisabled"
      @route="emit('route', $event)"
      @message="emit('message', $event)"
      @photo="emit('photo', $event)"
    />
  </div>

  <BaseBadge v-else-if="part.type === 'badge'" class="self-start" :label="part.text" :tone="BADGE_TONES[part.tone ?? 'default']" size="sm" uppercase />

  <hr v-else-if="part.type === 'separator'" class="w-full border-0 border-t border-dashed border-outline-variant">

  <button v-else-if="part.type === 'image' && part.action" type="button" class="block w-full overflow-hidden rounded-lg bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" aria-label="View photo" @click="emit('photo', part.source.url)">
    <img :src="part.source.url" :alt="part.alt ?? ''" class="block w-full object-cover" :class="IMAGE_ASPECTS[part.aspect ?? 'square']" loading="lazy" decoding="async">
  </button>

  <img v-else-if="part.type === 'image'" :src="part.source.url" :alt="part.alt ?? ''" class="block w-full rounded-lg bg-surface-container object-cover" :class="IMAGE_ASPECTS[part.aspect ?? 'square']" loading="lazy" decoding="async">

  <div v-else-if="part.type === 'table'" class="w-full overflow-x-auto">
    <table class="w-full border-collapse font-body text-[12.5px]">
      <thead>
        <tr>
          <th v-for="(column, index) in part.columns" :key="index" scope="col" class="px-1 pb-1 font-label text-[10px] font-extrabold uppercase tracking-[0.06em] text-on-surface-variant" :class="column.align === 'end' ? 'text-right' : 'text-left'">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in part.rows" :key="rowIndex" class="border-t border-outline-variant">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex" class="px-1 py-1.5 align-top text-on-surface [overflow-wrap:anywhere]" :class="part.columns[cellIndex]?.align === 'end' ? 'text-right' : 'text-left'">{{ cell }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <button v-else-if="part.type === 'button'" type="button" :class="BUTTON_STYLES[part.style ?? 'primary']" :disabled="part.action.type === 'message' && messageDisabled" @click="run(part.action)">{{ part.label }}</button>
</template>
