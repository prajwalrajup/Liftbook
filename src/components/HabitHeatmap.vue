<template>
  <div class="heatmap card">
    <div class="hm-head">
      <span class="hm-title">Last {{ WEEKS }} weeks</span>
    </div>

    <div class="hm-body">
      <div class="hm-days" aria-hidden="true">
        <span v-for="(l, i) in ['M', '', 'W', '', 'F', '', '']" :key="i">{{ l }}</span>
      </div>
      <div class="hm-grid">
        <button
          v-for="c in cells"
          :key="c.iso"
          class="cell"
          :class="[c.status, { today: c.iso === todayISO, sel: c.iso === selected }]"
          :aria-label="describe(c)"
          :disabled="c.status === 'future'"
          @click="selected = c.iso"
        />
      </div>
    </div>

    <p class="hm-info">{{ selectedCell ? describe(selectedCell) : 'Tap a day for details' }}</p>

    <div class="hm-legend">
      <span><i class="cell all" /> All</span>
      <span><i class="cell part" /> Some</span>
      <span><i class="cell none" /> None</span>
      <span><i class="cell off" /> Nothing required</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onMounted } from 'vue'
import { useHabitsStore } from '../stores/habits.js'
import { useScheduleStore } from '../stores/schedule.js'
import { daySummary, fromISO, toISO } from '../lib/habitStats.js'

const WEEKS = 15
const store = useHabitsStore()
const schedule = useScheduleStore()
onMounted(() => schedule.loadWorkoutDays())

const workout = computed(() => ({
  dows: new Set(
    Object.values(schedule.schedule).filter((e) => e.routine_id).map((e) => e.day_of_week),
  ),
  done: new Set(schedule.workoutDays),
  from: schedule.firstWorkoutDay,
}))

const today = new Date()
const todayISO = toISO(today)
const selected = ref(todayISO)

// Grid starts on the Monday (WEEKS - 1) weeks before this week's Monday
const start = (() => {
  const mondayOffset = (today.getDay() + 6) % 7
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (WEEKS - 1) * 7)
})()

const cells = computed(() => {
  const out = []
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const iso = toISO(d)
    const { total, done } = daySummary(store.habits, store.logs, iso, workout.value)
    let status
    if (iso > todayISO) status = 'future'
    else if (total === 0) status = 'off'
    else if (done === total) status = 'all'
    else if (done > 0) status = 'part'
    else status = iso === todayISO ? 'pending' : 'none' // today isn't a miss yet
    out.push({ iso, total, done, status })
  }
  return out
})

const selectedCell = computed(() => cells.value.find((c) => c.iso === selected.value))

function describe(c) {
  const label = fromISO(c.iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (c.status === 'future') return label
  if (c.total === 0) return `${label} · nothing required`
  return `${label} · ${c.done}/${c.total} done`
}
</script>

<style scoped>
.heatmap { padding: 14px; }
.hm-head { margin-bottom: 10px; }
.hm-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

.hm-body { display: flex; gap: 6px; }
.hm-days {
  display: grid; grid-template-rows: repeat(7, 1fr); gap: 4px;
  font-size: 10px; color: var(--text-secondary); width: 10px; text-align: center;
}
.hm-days span { display: flex; align-items: center; justify-content: center; }
.hm-grid {
  flex: 1; min-width: 0; display: grid; gap: 4px;
  grid-template-rows: repeat(7, auto);
  grid-template-columns: repeat(15, minmax(0, 1fr));
  grid-auto-flow: column;
}

.cell {
  display: block; width: 100%; aspect-ratio: 1; border-radius: 4px; border: 1px solid transparent;
  background: var(--bg-elevated); padding: 0;
}
.cell.all { background: var(--success); }
.cell.part { background: var(--warning); }
.cell.none { background: var(--danger); }
.cell.off { background: var(--bg-elevated); }
.cell.pending { background: transparent; border-color: var(--border); }
.cell.future { background: transparent; opacity: 0.25; border-color: var(--border); }
.cell.today { outline: 2px solid var(--text); outline-offset: 1px; }
.cell.sel:not(.today) { outline: 2px solid var(--text-secondary); outline-offset: 1px; }

.hm-info { font-size: 13px; color: var(--text-secondary); margin-top: 12px; min-height: 20px; }
.hm-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.hm-legend span { display: inline-flex; align-items: center; gap: 5px; }
.hm-legend .cell { width: 12px; height: 12px; aspect-ratio: auto; display: inline-block; }
</style>
