<template>
  <main class="page">
    <div class="header-row">
      <h1 class="page-title" style="margin:0">Habits</h1>
      <button class="btn btn-primary" @click="openNew">+ New</button>
    </div>

    <div v-if="!store.loaded" class="empty-state"><p>Loading…</p></div>

    <div v-else-if="store.habits.length === 0" class="empty-state card">
      <p>No habits yet.<br />Add one to build or quit.</p>
    </div>

    <template v-else>
      <div class="seg">
        <button v-for="r in ranges" :key="r.label" :class="{ on: range === r.days }" @click="range = r.days">
          {{ r.label }}
        </button>
      </div>

      <div v-for="group in groups" :key="group.kind" class="group">
        <p v-if="group.habits.length" class="group-label">{{ group.title }}</p>
        <button
          v-for="h in group.habits"
          :key="h.id"
          class="habit-card card"
          @click="openEdit(h)"
        >
          <HabitRing :rate="h.stats.rate" :size="64" />
          <div class="habit-info">
            <span class="habit-name">{{ h.name }}</span>
            <span class="habit-freq">{{ frequencyLabel(h.days) }}</span>
            <span class="habit-stats">
              <b class="ok">{{ h.stats.success }}</b> kept ·
              <b class="bad">{{ h.stats.missed }}</b> missed
              <template v-if="h.stats.streak"> · 🔥 {{ h.stats.streak }}</template>
            </span>
            <span v-if="h.metric !== 'boolean' && h.stats.avg != null" class="habit-stats">
              Avg {{ formatValue(h, h.stats.avg) }} · Total {{ formatValue(h, h.stats.sum) }}
            </span>
          </div>
        </button>
      </div>
    </template>

    <Teleport to="body">
      <div v-if="sheet" class="sheet-backdrop" @click="sheet = null">
        <div class="sheet" @click.stop>
          <div class="sheet-handle" />
          <form class="sheet-body" @submit.prevent="save">
            <h2 class="sheet-title">{{ sheet.id ? 'Edit habit' : 'New habit' }}</h2>

            <label for="h-name">Name</label>
            <input id="h-name" v-model="form.name" type="text" maxlength="60" placeholder="e.g. Read 20 pages" />

            <label style="margin-top:16px">Type</label>
            <div class="seg">
              <button type="button" :class="{ on: form.kind === 'build' }" @click="form.kind = 'build'">Build a habit</button>
              <button type="button" :class="{ on: form.kind === 'quit' }" @click="form.kind = 'quit'">Quit a habit</button>
            </div>

            <label style="margin-top:16px">Track as</label>
            <div class="seg">
              <button type="button" :class="{ on: form.metric === 'boolean' }" @click="form.metric = 'boolean'">Yes / No</button>
              <button type="button" :class="{ on: form.metric === 'numeric' }" @click="form.metric = 'numeric'">Number</button>
              <button type="button" :class="{ on: form.metric === 'timer' }" @click="form.metric = 'timer'">Time</button>
            </div>
            <input
              v-if="form.metric === 'numeric'"
              v-model="form.unit"
              type="text"
              maxlength="16"
              placeholder="Unit, e.g. glasses, L, pages"
              style="margin-top:10px"
            />
            <p v-if="form.metric === 'timer'" class="hint">Enter minutes for the day, or run a start/stop timer from Overview.</p>

            <label style="margin-top:16px">Frequency</label>
            <div class="seg">
              <button type="button" :class="{ on: form.days.length === 7 }" @click="form.days = [0, 1, 2, 3, 4, 5, 6]">Daily</button>
              <button type="button" :class="{ on: form.days.length < 7 }" @click="customDays">Days of week</button>
            </div>
            <div v-if="form.days.length < 7" class="chips">
              <button
                v-for="d in weekdays"
                :key="d.dow"
                type="button"
                class="chip"
                :class="{ on: form.days.includes(d.dow) }"
                :aria-label="d.full"
                @click="toggleDay(d.dow)"
              >
                {{ d.short }}
              </button>
            </div>

            <p v-if="error" class="form-error">{{ error }}</p>

            <button class="btn btn-primary btn-full" style="margin-top:20px" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
            <button
              v-if="sheet.id"
              type="button"
              class="btn btn-danger btn-full"
              style="margin-top:10px"
              @click="del"
            >
              Delete habit
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useHabitsStore } from '../stores/habits.js'
import { computeStats, formatValue, frequencyLabel } from '../lib/habitStats.js'
import HabitRing from '../components/HabitRing.vue'

const store = useHabitsStore()
onMounted(() => store.load())

const ranges = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'All time', days: null },
]
const range = ref(30)

const weekdays = [
  { dow: 1, short: 'M', full: 'Monday' },
  { dow: 2, short: 'T', full: 'Tuesday' },
  { dow: 3, short: 'W', full: 'Wednesday' },
  { dow: 4, short: 'T', full: 'Thursday' },
  { dow: 5, short: 'F', full: 'Friday' },
  { dow: 6, short: 'S', full: 'Saturday' },
  { dow: 0, short: 'S', full: 'Sunday' },
]

const withStats = computed(() =>
  store.habits.map((h) => ({
    ...h,
    stats: computeStats(h, store.logs[h.id] ?? {}, { rangeDays: range.value }),
  })),
)
const groups = computed(() => [
  { kind: 'build', title: 'Building', habits: withStats.value.filter((h) => h.kind === 'build') },
  { kind: 'quit', title: 'Quitting', habits: withStats.value.filter((h) => h.kind === 'quit') },
])

// ── Add / edit sheet ──
const sheet = ref(null)
const form = reactive({ name: '', kind: 'build', metric: 'boolean', unit: '', days: [0, 1, 2, 3, 4, 5, 6] })
const saving = ref(false)
const error = ref('')

function openNew() {
  Object.assign(form, { name: '', kind: 'build', metric: 'boolean', unit: '', days: [0, 1, 2, 3, 4, 5, 6] })
  error.value = ''
  sheet.value = {}
}
function openEdit(h) {
  Object.assign(form, { name: h.name, kind: h.kind, metric: h.metric, unit: h.unit ?? '', days: [...h.days] })
  error.value = ''
  sheet.value = { id: h.id }
}
function customDays() {
  // switching from Daily: start from nothing selected, user picks
  if (form.days.length === 7) form.days = []
}
function toggleDay(dow) {
  form.days = form.days.includes(dow) ? form.days.filter((d) => d !== dow) : [...form.days, dow]
}

async function save() {
  const name = form.name.trim()
  if (!name) { error.value = 'Give it a name.'; return }
  if (form.days.length === 0) { error.value = 'Pick at least one day.'; return }
  saving.value = true
  error.value = ''
  try {
    const unit = form.metric === 'numeric' ? form.unit.trim() || null : null
    const payload = { name, kind: form.kind, metric: form.metric, unit, days: [...form.days].sort() }
    if (sheet.value.id) await store.update(sheet.value.id, payload)
    else await store.add(payload)
    sheet.value = null
  } catch (e) {
    error.value = 'Save failed. Try again.'
  } finally {
    saving.value = false
  }
}

async function del() {
  if (!confirm('Delete this habit and its history?')) return
  await store.remove(sheet.value.id)
  sheet.value = null
}
</script>

<style scoped>
.header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }

.seg { display: flex; gap: 6px; margin-bottom: 4px; }
.seg button {
  flex: 1; min-height: 44px; padding: 0 6px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border); font-size: 14px; font-weight: 600;
}
.seg button.on { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
.page > .seg { margin-bottom: 20px; }

.group { margin-bottom: 20px; }
.group-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }

.habit-card {
  display: flex; align-items: center; gap: 14px; width: 100%;
  text-align: left; color: var(--text); margin-bottom: 10px; cursor: pointer;
}
.habit-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.habit-name { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.habit-freq { font-size: 13px; color: var(--text-secondary); }
.habit-stats { font-size: 13px; color: var(--text-secondary); }
.habit-stats .ok { color: var(--success); }
.habit-stats .bad { color: var(--danger); }

.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 200; display: flex; align-items: flex-end;
}
.sheet {
  background: var(--bg-surface); border-radius: 20px 20px 0 0;
  width: 100%; max-height: 90dvh; overflow-y: auto;
  border-top: 1px solid var(--border);
}
.sheet-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 12px auto 4px; }
.sheet-body { padding: 12px 20px calc(32px + var(--safe-bottom)); }
.sheet-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; }

.chips { display: flex; gap: 6px; margin-top: 10px; }
.chip {
  flex: 1; min-height: 44px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border); font-size: 15px; font-weight: 600;
}
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }

.hint { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
.form-error { color: var(--danger); font-size: 14px; margin-top: 12px; }
</style>
