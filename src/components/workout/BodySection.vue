<template>
<div>
      <div class="stat-row">
        <div class="stat card">
          <span class="stat-label">Weight</span>
          <span class="stat-value">{{ latest.weight != null ? latest.weight + ' kg' : '—' }}</span>
        </div>
        <div class="stat card">
          <span class="stat-label">Height</span>
          <span class="stat-value">{{ latest.height != null ? latest.height + ' cm' : '—' }}</span>
        </div>
        <div class="stat card">
          <span class="stat-label">BMI</span>
          <span class="stat-value">{{ bmi ?? '—' }}</span>
        </div>
      </div>

      <div class="card chart-card">
        <div class="seg">
          <button :class="{ on: metric === 'weight' }" @click="metric = 'weight'">Weight</button>
          <button :class="{ on: metric === 'height' }" @click="metric = 'height'">Height</button>
        </div>
        <LineChart
          v-if="series.length"
          :points="series"
          :label="`${metric} over time`"
        />
        <p v-else class="chart-empty">No {{ metric }} entries yet.</p>
      </div>

      <form class="card log-form" @submit.prevent="save">
        <div class="form-row">
          <div>
            <label for="bm-w">Weight (kg)</label>
            <input id="bm-w" v-model="form.weight" type="number" inputmode="decimal" step="0.1" min="0" placeholder="e.g. 72.5" />
          </div>
          <div>
            <label for="bm-h">Height (cm)</label>
            <input id="bm-h" v-model="form.height" type="number" inputmode="decimal" step="0.1" min="0" placeholder="e.g. 175" />
          </div>
        </div>
        <div style="margin-top:12px">
          <label for="bm-d">Date</label>
          <input id="bm-d" v-model="form.date" type="date" :max="todayISO" />
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="btn btn-primary btn-full" style="margin-top:14px" :disabled="saving">
          {{ saving ? 'Saving…' : 'Log entry' }}
        </button>
      </form>

      <div v-if="recent.length" class="recent">
        <div v-for="e in recent" :key="e.id" class="recent-row">
          <span class="recent-date">{{ fmtDate(e.recorded_on) }}</span>
          <span class="recent-vals">
            {{ e.weight_kg != null ? e.weight_kg + ' kg' : '' }}
            {{ e.weight_kg != null && e.height_cm != null ? '·' : '' }}
            {{ e.height_cm != null ? e.height_cm + ' cm' : '' }}
          </span>
          <button class="btn btn-ghost del" aria-label="Delete entry" @click="body.remove(e.id)">✕</button>
        </div>
      </div>
</div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useBodyStore } from '../../stores/body.js'
import LineChart from '../LineChart.vue'
import { appDayISO } from '../../lib/habitStats.js'

const body = useBodyStore()
onMounted(() => body.load())

const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayISO = appDayISO()

const metric = ref('weight')
const form = reactive({ weight: '', height: '', date: todayISO })
const saving = ref(false)
const error = ref('')

const series = computed(() => {
  const key = metric.value === 'weight' ? 'weight_kg' : 'height_cm'
  return body.entries
    .filter((e) => e[key] != null)
    .map((e) => ({ date: e.recorded_on, value: e[key] }))
})

const latestOf = (key) => {
  for (let i = body.entries.length - 1; i >= 0; i--) {
    if (body.entries[i][key] != null) return body.entries[i][key]
  }
  return null
}
const latest = computed(() => ({ weight: latestOf('weight_kg'), height: latestOf('height_cm') }))
const bmi = computed(() => {
  const { weight, height } = latest.value
  if (weight == null || height == null) return null
  return (weight / (height / 100) ** 2).toFixed(1)
})

const recent = computed(() => [...body.entries].reverse().slice(0, 5))
const fmtDate = (iso) =>
  new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

async function save() {
  error.value = ''
  const w = form.weight === '' ? null : Number(form.weight)
  const h = form.height === '' ? null : Number(form.height)
  if (w == null && h == null) { error.value = 'Enter weight or height.'; return }
  if ((w != null && !(w > 0)) || (h != null && !(h > 0))) { error.value = 'Values must be positive.'; return }
  saving.value = true
  try {
    await body.add({ recordedOn: form.date || todayISO, weightKg: w, heightCm: h })
    form.weight = ''
    form.height = ''
    form.date = todayISO
  } catch (e) {
    error.value = 'Save failed. Try again.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
.stat { padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.stat-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.stat-value { font-size: 18px; font-weight: 700; }
.chart-card { margin-bottom: 12px; }
.seg { display: flex; gap: 6px; margin-bottom: 12px; }
.seg button {
  flex: 1; min-height: 44px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border); font-size: 14px; font-weight: 600;
}
.seg button.on { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
.chart-empty { text-align: center; color: var(--text-secondary); font-size: 14px; padding: 36px 0; }
.log-form { margin-bottom: 12px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-error { color: var(--danger); font-size: 14px; margin-top: 10px; }
.recent-row { display: flex; align-items: center; gap: 8px; min-height: 44px; border-bottom: 1px solid var(--border); font-size: 14px; }
.recent-date { color: var(--text-secondary); flex: 1; }
.del { min-width: 44px; padding: 0 12px; color: var(--text-secondary); }

</style>
