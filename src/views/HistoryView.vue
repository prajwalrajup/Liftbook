<template>
  <main class="page">
    <h1 class="page-title">History</h1>

    <div v-if="loading" class="empty-state"><p>Loading…</p></div>

    <div v-else-if="sessions.length === 0" class="empty-state card">
      <p>No sessions yet.<br />Complete a workout to see it here.</p>
    </div>

    <div v-else class="session-list">
      <button
        v-for="s in sessions"
        :key="s.id"
        class="session-card card"
        @click="openSession(s)"
      >
        <div class="session-left">
          <span class="session-name">{{ s.routine_name ?? 'Workout' }}</span>
          <span class="session-meta">{{ formatDate(s.started_at) }} · {{ duration(s) }}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- Session detail sheet -->
    <Teleport to="body">
      <div v-if="detail" class="detail-overlay">
        <div class="detail-header">
          <button class="btn btn-ghost icon-only" @click="detail = null">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="detail-title-wrap">
            <span class="detail-title">{{ detail.session.routine_name ?? 'Workout' }}</span>
            <span class="detail-sub">{{ formatDate(detail.session.started_at) }} · {{ duration(detail.session) }}</span>
          </div>
        </div>

        <div class="detail-scroll">
          <div v-if="detailLoading" class="empty-state"><p>Loading…</p></div>

          <template v-else>
            <!-- Per-exercise sections -->
            <div v-for="ex in detail.exercises" :key="ex.exercise_id" class="ex-section">
              <div class="ex-section-header">
                <span class="ex-section-name">{{ ex.name }}</span>
                <span class="ex-section-best">Best: {{ bestSet(ex.sets) }}</span>
              </div>

              <!-- Sets table -->
              <div class="sets-table">
                <template v-for="(mainSet, idx) in mainSetsOf(ex.sets)" :key="mainSet.set_number">
                  <div class="sets-table-row">
                    <span class="col-set">{{ mainSet.set_number }}</span>
                    <span class="col-weight">{{ mainSet.weight != null ? mainSet.weight + ' kg' : '—' }}</span>
                    <span class="col-x">×</span>
                    <span class="col-reps">{{ mainSet.reps != null ? mainSet.reps + ' reps' : '—' }}</span>
                    <span class="col-vol">{{ vol(mainSet) }}</span>
                  </div>
                  <div
                    v-for="drop in dropSetsOf(ex.sets, mainSet.set_number)"
                    :key="drop.drop_number"
                    class="sets-table-row drop"
                  >
                    <span class="col-set drop-label">↳ d{{ drop.drop_number }}</span>
                    <span class="col-weight">{{ drop.weight != null ? drop.weight + ' kg' : '—' }}</span>
                    <span class="col-x">×</span>
                    <span class="col-reps">{{ drop.reps != null ? drop.reps + ' reps' : '—' }}</span>
                    <span class="col-vol">{{ vol(drop) }}</span>
                  </div>
                  <!-- Rest time before next set -->
                  <div
                    v-if="idx < mainSetsOf(ex.sets).length - 1"
                    class="rest-between"
                  >
                    <span class="rest-between-text">
                      {{ restBetween(mainSet, mainSetsOf(ex.sets)[idx + 1]) }}
                    </span>
                  </div>
                </template>
              </div>

              <!-- Volume trend sparkline -->
              <div v-if="ex.trend.length > 1" class="trend-row">
                <span class="trend-label">Volume trend</span>
                <svg class="sparkline" :viewBox="`0 0 ${sparkW} ${sparkH}`" preserveAspectRatio="none">
                  <polyline
                    :points="sparkPoints(ex.trend)"
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="trend-delta" :class="trendDir(ex.trend)">
                  {{ trendDelta(ex.trend) }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import sql from '../lib/db.js'

const loading = ref(true)
const sessions = ref([])
const detail = ref(null)
const detailLoading = ref(false)

const sparkW = 80
const sparkH = 24

onMounted(async () => {
  try {
    sessions.value = await sql`
      select ws.*, r.name as routine_name
      from workout_sessions ws
      left join routines r on r.id = ws.routine_id
      where ws.finished_at is not null
      order by ws.started_at desc
      limit 100
    `
  } finally {
    loading.value = false
  }
})

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function duration(s) {
  if (!s.finished_at) return 'In progress'
  const mins = Math.round((new Date(s.finished_at) - new Date(s.started_at)) / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

async function openSession(s) {
  detail.value = { session: s, exercises: [] }
  detailLoading.value = true
  try {
    // Get all logged sets for this session, grouped by exercise
    const rows = await sql`
      select ls.*, e.name
      from logged_sets ls
      join exercises e on e.id = ls.exercise_id
      where ls.session_id = ${s.id}
      order by ls.exercise_id, ls.set_number, ls.drop_number
    `

    // Group by exercise
    const byEx = {}
    for (const row of rows) {
      if (!byEx[row.exercise_id]) byEx[row.exercise_id] = { exercise_id: row.exercise_id, name: row.name, sets: [], trend: [] }
      byEx[row.exercise_id].sets.push(row)
    }

    // Fetch volume trend per exercise (last 10 sessions of same routine)
    const exIds = Object.keys(byEx)
    for (const exId of exIds) {
      const trend = await sql`
        select ws.started_at,
               sum(ls.weight * ls.reps) filter (where ls.weight is not null and ls.reps is not null and ls.drop_number = 0) as volume
        from workout_sessions ws
        join logged_sets ls on ls.session_id = ws.id
        where ws.routine_id = ${s.routine_id}
          and ls.exercise_id = ${exId}
          and ws.finished_at is not null
        group by ws.id, ws.started_at
        order by ws.started_at desc
        limit 10
      `
      byEx[exId].trend = trend.reverse().map(r => Number(r.volume ?? 0))
    }

    detail.value.exercises = Object.values(byEx)
  } finally {
    detailLoading.value = false
  }
}

function mainSetsOf(sets) {
  return sets.filter(s => s.drop_number === 0)
}

function dropSetsOf(sets, setNumber) {
  return sets.filter(s => s.set_number === setNumber && s.drop_number > 0)
}

function vol(s) {
  if (s.weight == null || s.reps == null) return ''
  return `${(s.weight * s.reps).toFixed(0)} kg`
}

function restBetween(setA, setB) {
  if (!setA?.logged_at || !setB?.logged_at) return ''
  const secs = Math.round((new Date(setB.logged_at) - new Date(setA.logged_at)) / 1000)
  if (secs < 5) return ''
  const m = Math.floor(secs / 60), s = secs % 60
  const label = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  return `↳ rest ${label}`
}

function bestSet(sets) {
  const main = sets.filter(s => s.drop_number === 0 && s.weight != null && s.reps != null)
  if (!main.length) return '—'
  const best = main.reduce((a, b) => (a.weight > b.weight ? a : b))
  return `${best.weight} kg × ${best.reps}`
}

function sparkPoints(trend) {
  if (trend.length < 2) return ''
  const min = Math.min(...trend)
  const max = Math.max(...trend)
  const range = max - min || 1
  return trend.map((v, i) => {
    const x = (i / (trend.length - 1)) * sparkW
    const y = sparkH - ((v - min) / range) * (sparkH - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function trendDelta(trend) {
  if (trend.length < 2) return ''
  const first = trend[0], last = trend[trend.length - 1]
  if (!first) return ''
  const pct = Math.round(((last - first) / first) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

function trendDir(trend) {
  if (trend.length < 2) return ''
  return trend[trend.length - 1] >= trend[0] ? 'up' : 'down'
}
</script>

<style scoped>
.session-list { display: flex; flex-direction: column; gap: 10px; }
.session-card {
  display: flex; align-items: center; gap: 12px;
  cursor: pointer; width: 100%; text-align: left; border: none;
  background: var(--bg-surface);
}
.session-card:active { opacity: 0.7; }
.session-left { flex: 1; }
.session-name { display: block; font-size: 16px; font-weight: 600; }
.session-meta { display: block; font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

/* Detail overlay */
.detail-overlay {
  position: fixed; inset: 0; background: var(--bg);
  z-index: 200; display: flex; flex-direction: column;
}
.detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 12px 10px;
  background: var(--bg-surface); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.icon-only { padding: 0; width: 44px; min-height: 44px; }
.detail-title-wrap { flex: 1; }
.detail-title { display: block; font-size: 16px; font-weight: 700; }
.detail-sub { display: block; font-size: 12px; color: var(--text-secondary); }

.detail-scroll {
  flex: 1; overflow-y: auto; padding: 16px 16px 40px;
  -webkit-overflow-scrolling: touch;
}

.ex-section { margin-bottom: 24px; }
.ex-section-header {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 8px;
}
.ex-section-name { font-size: 15px; font-weight: 700; }
.ex-section-best { font-size: 12px; color: var(--text-secondary); }

.sets-table { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.sets-table-group { display: flex; flex-direction: column; gap: 2px; }
.sets-table-row {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; background: var(--bg-surface);
  border-radius: var(--radius-sm); font-size: 14px;
}
.sets-table-row.drop { background: var(--bg-elevated); margin-left: 16px; }
.col-set { font-size: 12px; font-weight: 700; color: var(--accent); min-width: 20px; }
.drop-label { color: var(--text-secondary); min-width: 36px; font-size: 11px; }
.col-weight { font-weight: 600; min-width: 60px; }
.col-x { color: var(--text-secondary); font-size: 12px; }
.col-reps { flex: 1; }
.col-vol { font-size: 12px; color: var(--text-secondary); text-align: right; }

.rest-between {
  padding: 2px 10px 2px 28px;
}
.rest-between-text {
  font-size: 11px; color: var(--text-secondary); font-style: italic;
}

.trend-row {
  display: flex; align-items: center; gap: 10px;
}
.trend-label { font-size: 11px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
.sparkline { width: 80px; height: 24px; flex-shrink: 0; }
.trend-delta { font-size: 13px; font-weight: 700; }
.trend-delta.up { color: var(--success); }
.trend-delta.down { color: var(--danger); }
</style>
