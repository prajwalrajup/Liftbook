<template>
  <main class="page">
    <div class="today-header">
      <span class="today-weekday">{{ weekday }}</span>
      <span class="today-date">{{ dateStr }}</span>
    </div>

    <div v-if="!scheduleStore.loaded" class="empty-state"><p>Loading…</p></div>

    <template v-else>
      <!-- Rest day -->
      <div v-if="todayEntry?.is_rest_day" class="state-card rest-card">
        <div class="state-icon">🛌</div>
        <div class="state-label">Rest Day</div>
        <p class="state-sub">Recovery is part of training.</p>
      </div>

      <!-- Has routine -->
      <div v-else-if="todayEntry?.routine_name" class="state-card routine-card">
        <div class="state-icon">💪</div>
        <div class="state-label">{{ todayEntry.routine_name }}</div>
        <RouterLink
          :to="`/workout/${todayEntry.routine_id}`"
          class="btn btn-primary btn-full start-btn"
        >
          Start Workout
        </RouterLink>
      </div>

      <!-- Nothing assigned -->
      <div v-else class="state-card empty-card">
        <div class="state-icon">📅</div>
        <div class="state-label">No routine today</div>
        <RouterLink to="/workout?s=schedule" class="btn btn-secondary btn-full" style="margin-top:16px">
          Set up schedule
        </RouterLink>
      </div>

      <!-- Weigh-in day -->
      <div v-if="todayEntry?.weigh_in" class="state-card weigh-card">
        <div class="state-icon">⚖️</div>
        <RouterLink v-if="weighedToday" to="/workout?s=body" class="weighed-link">
          <div class="state-label">Weighed in</div>
          <p class="state-sub">{{ weighedToday.weight_kg }} kg logged today. Tap to edit.</p>
        </RouterLink>
        <template v-else>
          <div class="state-label">Weigh-in day</div>
          <RouterLink to="/workout?s=body" class="btn btn-secondary btn-full start-btn">
            Log weight
          </RouterLink>
        </template>
      </div>
    </template>

    <!-- Habit checklist -->
    <section v-if="habitsStore.loaded && todaysHabits.length" class="habit-list">
      <p class="habit-list-label">Habits</p>
      <button
        v-for="h in todaysHabits"
        :key="h.id"
        class="habit-row"
        :class="{ done: habitsStore.isDone(h.id, todayISO) }"
        @click="tick(h)"
      >
        <span class="check" aria-hidden="true">{{ habitsStore.isDone(h.id, todayISO) ? '✓' : '' }}</span>
        <span class="habit-text">
          <span class="habit-name">{{ h.name }}</span>
          <span v-if="h.kind === 'quit'" class="habit-tag">Quit</span>
        </span>
        <span v-if="habitsStore.running[h.id]" class="habit-value running">● {{ clock(h.id) }}</span>
        <span v-else-if="h.metric !== 'boolean'" class="habit-value">
          {{ habitsStore.isDone(h.id, todayISO) ? formatValue(h, habitsStore.valueOf(h.id, todayISO)) : '' }}
        </span>
      </button>
    </section>

    <!-- Value entry for number / time habits -->
    <Teleport to="body">
      <div v-if="entry" class="sheet-backdrop" @click="entry = null">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <div class="sheet-body">
            <h2 class="sheet-title">{{ entry.habit.name }}</h2>

            <!-- Timer running -->
            <div v-if="habitsStore.running[entry.habit.id]" class="timer-box">
              <div class="timer-clock">{{ clock(entry.habit.id) }}</div>
              <button class="btn btn-primary btn-full" @click="stopTimer">■ Stop &amp; save</button>
              <button class="btn btn-ghost btn-full" style="margin-top:6px" @click="discardTimer">Discard this run</button>
            </div>

            <template v-else>
              <template v-if="entry.habit.metric === 'timer'">
                <button class="btn btn-primary btn-full" @click="startTimer">▶ Start timer</button>
                <p class="or">or enter time manually</p>
              </template>

              <form @submit.prevent="saveEntry">
                <label for="hv">{{ entry.habit.metric === 'timer' ? 'Minutes' : (entry.habit.unit || 'Amount') }}</label>
                <input
                  id="hv"
                  ref="valueInput"
                  v-model="entry.value"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="any"
                  :placeholder="entry.habit.metric === 'timer' ? 'e.g. 30' : 'e.g. 3'"
                />
                <p v-if="entry.error" class="entry-error">{{ entry.error }}</p>
                <button class="btn btn-secondary btn-full" style="margin-top:16px">Save</button>
                <button
                  v-if="entry.wasDone"
                  type="button"
                  class="btn btn-danger btn-full"
                  style="margin-top:10px"
                  @click="unmark"
                >
                  Unmark today
                </button>
              </form>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useScheduleStore } from '../stores/schedule.js'
import { useBodyStore } from '../stores/body.js'
import { useHabitsStore } from '../stores/habits.js'
import { formatValue } from '../lib/habitStats.js'

const scheduleStore = useScheduleStore()
const body = useBodyStore()
const habitsStore = useHabitsStore()
onMounted(() => {
  scheduleStore.load()
  body.load()
  habitsStore.load()
  tickTimer = setInterval(() => (nowMs.value = Date.now()), 1000)
})
onUnmounted(() => clearInterval(tickTimer))

let tickTimer
const nowMs = ref(Date.now())
function clock(id) {
  const r = habitsStore.running[id]
  if (!r) return ''
  const sec = Math.max(0, Math.floor((nowMs.value - r.startedAt) / 1000))
  const h = Math.floor(sec / 3600)
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`
}

const now = new Date()
const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

const todayEntry = computed(() => scheduleStore.todayEntry())

const pad = (n) => String(n).padStart(2, '0')
const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const todaysHabits = computed(() =>
  habitsStore.habits.filter((h) => h.days.includes(now.getDay())),
)
const entry = ref(null)
const valueInput = ref(null)
const fail = () => alert('Could not save. Try again.')

function tick(h) {
  if (h.metric === 'boolean') {
    habitsStore.setLog(h.id, todayISO, habitsStore.isDone(h.id, todayISO) ? undefined : null).catch(fail)
    return
  }
  const wasDone = habitsStore.isDone(h.id, todayISO)
  const v = habitsStore.valueOf(h.id, todayISO)
  entry.value = { habit: h, value: v ?? '', wasDone, error: '' }
  nextTick(() => valueInput.value?.focus())
}

async function saveEntry() {
  const v = Number(entry.value.value)
  if (entry.value.value === '' || !(v > 0)) { entry.value.error = 'Enter a value above 0.'; return }
  try {
    await habitsStore.setLog(entry.value.habit.id, todayISO, v)
    entry.value = null
  } catch { fail() }
}

async function startTimer() {
  try {
    await habitsStore.startTimer(entry.value.habit.id)
    entry.value = null
  } catch { fail() }
}

async function stopTimer() {
  try {
    await habitsStore.stopTimer(entry.value.habit.id)
    entry.value = null
  } catch { fail() }
}

async function discardTimer() {
  if (!confirm('Discard this run? Nothing will be saved.')) return
  try {
    await habitsStore.discardTimer(entry.value.habit.id)
    entry.value = null
  } catch { fail() }
}

async function unmark() {
  try {
    await habitsStore.setLog(entry.value.habit.id, todayISO, undefined)
    entry.value = null
  } catch { fail() }
}

const weighedToday = computed(() =>
  body.entries.find((e) => e.recorded_on === todayISO && e.weight_kg != null),
)
</script>

<style scoped>
.today-header {
  margin-bottom: 28px;
}
.today-weekday {
  display: block;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.today-date {
  display: block;
  font-size: 15px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.state-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px 20px 28px;
  text-align: center;
}
.state-icon { font-size: 48px; margin-bottom: 12px; }
.state-label { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.state-sub { color: var(--text-secondary); font-size: 14px; }

.habit-list { margin-top: 24px; }
.habit-list-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
.habit-row {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 56px;
  padding: 10px 16px; margin-bottom: 8px; text-align: left; color: var(--text);
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
  font-size: 16px; cursor: pointer;
}
.check {
  flex: none; width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid var(--border); display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800; color: #fff;
}
.habit-row.done .check { background: var(--success); border-color: var(--success); }
.habit-row.done .habit-name { color: var(--text-secondary); text-decoration: line-through; }
.habit-text { display: flex; align-items: center; gap: 8px; min-width: 0; }
.habit-name { font-weight: 500; overflow-wrap: anywhere; }
.habit-tag { font-size: 11px; font-weight: 700; color: var(--danger); border: 1px solid var(--danger); border-radius: 6px; padding: 1px 6px; }
.habit-value { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--success); white-space: nowrap; }
.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 200; display: flex; align-items: flex-end;
}
.sheet {
  background: var(--bg-surface); border-radius: 20px 20px 0 0; width: 100%;
  border-top: 1px solid var(--border);
}
.sheet-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 12px auto 4px; }
.sheet-body { padding: 12px 20px 48px; }
.sheet-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
.habit-value.running { color: var(--accent); font-variant-numeric: tabular-nums; }
.timer-box { text-align: center; }
.timer-clock { font-size: 48px; font-weight: 800; font-variant-numeric: tabular-nums; margin: 4px 0 20px; }
.or { text-align: center; color: var(--text-secondary); font-size: 13px; margin: 16px 0; }
.entry-error { color: var(--danger); font-size: 14px; margin-top: 10px; }
.weigh-card { margin-top: 16px; }
.weighed-link { display: block; color: inherit; text-decoration: none; }
.routine-card .state-label { color: var(--text); }
.start-btn { margin-top: 24px; min-height: 52px; font-size: 17px; }
</style>
