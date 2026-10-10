<template>
  <div class="chart">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label">
      <g v-for="t in yTicks" :key="t.y">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="t.y" :y2="t.y" class="grid" />
        <text :x="PAD_L - 6" :y="t.y + 4" class="tick" text-anchor="end">{{ t.label }}</text>
      </g>
      <path v-if="pts.length > 1" :d="line" class="line" />
      <circle
        v-for="(p, i) in pts"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        :r="i === pts.length - 1 ? 5 : 3.5"
        class="dot"
      />
      <text v-if="pts.length" :x="PAD_L" :y="H - 6" class="tick" text-anchor="start">{{ first.date }}</text>
      <text v-if="pts.length > 1" :x="W - PAD_R" :y="H - 6" class="tick" text-anchor="end">{{ last.date }}</text>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// points: [{ date: 'YYYY-MM-DD', value: number }] ascending
const props = defineProps({
  points: { type: Array, required: true },
  unit: { type: String, default: '' },
  label: { type: String, default: 'Chart' },
})

const W = 360
const H = 180
const PAD_L = 36
const PAD_R = 12
const PAD_T = 12
const PAD_B = 26

const first = computed(() => props.points[0])
const last = computed(() => props.points[props.points.length - 1])

const range = computed(() => {
  const vals = props.points.map((p) => p.value)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) { min -= 1; max += 1 }
  const pad = (max - min) * 0.15
  return { min: min - pad, max: max + pad }
})

const pts = computed(() => {
  const n = props.points.length
  const t0 = new Date(props.points[0]?.date).getTime()
  const t1 = new Date(props.points[n - 1]?.date).getTime()
  const { min, max } = range.value
  return props.points.map((p, i) => {
    // x by date when span exists, otherwise centered
    const frac = n === 1 ? 0.5 : t1 === t0 ? i / (n - 1) : (new Date(p.date).getTime() - t0) / (t1 - t0)
    return {
      x: PAD_L + frac * (W - PAD_L - PAD_R),
      y: PAD_T + (1 - (p.value - min) / (max - min)) * (H - PAD_T - PAD_B),
    }
  })
})

const line = computed(() => pts.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

const yTicks = computed(() => {
  const { min, max } = range.value
  return [0, 0.5, 1].map((f) => {
    const v = min + (max - min) * f
    return {
      y: PAD_T + (1 - f) * (H - PAD_T - PAD_B),
      label: v.toFixed(v >= 100 ? 0 : 1),
    }
  })
})
</script>

<style scoped>
.chart svg { width: 100%; height: auto; display: block; }
.grid { stroke: var(--border); stroke-width: 1; }
.tick { fill: var(--text-secondary); font-size: 10px; }
.line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.dot { fill: var(--accent); stroke: var(--bg-surface); stroke-width: 2; }
</style>
