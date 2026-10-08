<script setup lang="ts">
import { computed } from 'vue'

/**
 * A step is a message between two participants, or an action inside one participant when `from` and `to` match.
 */
interface Step {
  from: string
  to: string
  label: string
  /** A second, smaller line under the label, e.g. the call or payload. */
  detail?: string
  /** Responses are drawn dashed. */
  response?: boolean
}

const props = defineProps<{
  title: string
  participants: string[]
  steps: Step[]
}>()

const sidePadding = 30

/**
 * Rough text widths at the diagram's font sizes, so boxes and columns fit their longest line.
 */
function textWidth(text: string, mono: boolean): number {
  return text.length * (mono ? 7.4 : 8.4)
}

function stepWidth(step: Step): number {
  return Math.max(textWidth(step.label, false), step.detail ? textWidth(step.detail, true) : 0) + 32
}

/**
 * One fixed column width keeps every diagram on the site at the same scale; keep labels short enough to fit.
 */
const columnWidth = computed(() => 300)
const headerHeight = 44
const stepHeight = 70
const top = 16

const width = computed(() => sidePadding * 2 + columnWidth.value * props.participants.length)
const height = computed(() => top + headerHeight + 24 + props.steps.length * stepHeight + 24)

function centerOf(name: string): number {
  const index = props.participants.indexOf(name)

  return sidePadding + columnWidth.value * index + columnWidth.value / 2
}

const rows = computed(() =>
  props.steps.map((step, index) => {
    const y = top + headerHeight + 24 + index * stepHeight + stepHeight / 2
    const x1 = centerOf(step.from)
    const x2 = centerOf(step.to)

    return { ...step, index, y, x1, x2, self: step.from === step.to, rightward: x2 >= x1, boxWidth: stepWidth(step) }
  }),
)

const lifelineBottom = computed(() => height.value - 12)
</script>

<template>
  <figure class="lx-seq">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{{ title }}</title>
      <defs>
        <marker id="lx-seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="lx-seq-arrowhead" />
        </marker>
      </defs>

      <g v-for="name in participants" :key="name">
        <line
          :x1="centerOf(name)"
          :x2="centerOf(name)"
          :y1="top + headerHeight"
          :y2="lifelineBottom"
          class="lx-seq-lifeline"
        />
        <rect
          :x="centerOf(name) - (columnWidth - 40) / 2"
          :y="top"
          :width="columnWidth - 40"
          :height="headerHeight"
          rx="10"
          class="lx-seq-actor"
        />
        <text :x="centerOf(name)" :y="top + headerHeight / 2 + 5" text-anchor="middle" class="lx-seq-actor-text">{{ name }}</text>
      </g>

      <g v-for="row in rows" :key="row.index">
        <template v-if="row.self">
          <rect
            :x="row.x1 - row.boxWidth / 2"
            :y="row.y - 24"
            :width="row.boxWidth"
            height="48"
            rx="8"
            class="lx-seq-action"
          />
          <text :x="row.x1" :y="row.detail ? row.y - 4 : row.y + 5" text-anchor="middle" class="lx-seq-label">{{ row.label }}</text>
          <text v-if="row.detail" :x="row.x1" :y="row.y + 14" text-anchor="middle" class="lx-seq-detail">{{ row.detail }}</text>
        </template>
        <template v-else>
          <line
            :x1="row.x1 + (row.rightward ? 4 : -4)"
            :x2="row.x2 + (row.rightward ? -6 : 6)"
            :y1="row.y + 8"
            :y2="row.y + 8"
            :class="['lx-seq-message', { 'is-response': row.response }]"
            marker-end="url(#lx-seq-arrow)"
          />
          <text :x="(row.x1 + row.x2) / 2" :y="row.detail ? row.y - 18 : row.y" text-anchor="middle" class="lx-seq-label lx-seq-on-line">{{ row.label }}</text>
          <text v-if="row.detail" :x="(row.x1 + row.x2) / 2" :y="row.y" text-anchor="middle" class="lx-seq-detail lx-seq-on-line">{{ row.detail }}</text>
        </template>
      </g>
    </svg>
    <figcaption>{{ title }}</figcaption>
  </figure>
</template>
