import { defineStore } from 'pinia'
import { ref } from 'vue'
import sql from '../lib/db.js'
import { toISO } from '../lib/habitStats.js'

export const useHabitsStore = defineStore('habits', () => {
  const habits = ref([])
  const logs = ref({}) // habit_id -> { 'YYYY-MM-DD': value|null } for days marked done
  const running = ref({}) // habit_id -> { id, startedAt (ms) } for timers in progress
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    const [hRows, lRows, rRows] = await Promise.all([
      sql`select id, name, kind, days, metric, unit, mandatory, to_char(created_on, 'YYYY-MM-DD') as created_on
          from habits order by created_at asc`,
      sql`select habit_id, to_char(log_date, 'YYYY-MM-DD') as log_date, value::float as value from habit_logs`,
      sql`select id, habit_id, started_at from habit_sessions where ended_at is null`,
    ])
    const map = {}
    for (const l of lRows) (map[l.habit_id] ??= {})[l.log_date] = l.value
    const run = {}
    for (const r of rRows) run[r.habit_id] = { id: r.id, startedAt: new Date(r.started_at).getTime() }
    running.value = run
    habits.value = hRows
    logs.value = map
    loaded.value = true
  }

  async function add({ name, kind, days, metric, unit, mandatory }) {
    const [row] = await sql`
      insert into habits (name, kind, days, metric, unit, mandatory, created_on)
      values (${name}, ${kind}, ${days}, ${metric}, ${unit}, ${mandatory}, ${toISO(new Date())})
      returning id, name, kind, days, metric, unit, mandatory, to_char(created_on, 'YYYY-MM-DD') as created_on
    `
    habits.value = [...habits.value, row]
  }

  async function update(id, { name, kind, days, metric, unit, mandatory }) {
    await sql`
      update habits set name = ${name}, kind = ${kind}, days = ${days}, metric = ${metric}, unit = ${unit},
          mandatory = ${mandatory}
      where id = ${id}
    `
    habits.value = habits.value.map((h) => (h.id === id ? { ...h, name, kind, days, metric, unit, mandatory } : h))
  }

  async function remove(id) {
    await sql`delete from habits where id = ${id}`
    habits.value = habits.value.filter((h) => h.id !== id)
    const { [id]: _, ...rest } = logs.value
    logs.value = rest
    const { [id]: __, ...runRest } = running.value
    running.value = runRest
  }

  const isDone = (id, date) => date in (logs.value[id] ?? {})
  const valueOf = (id, date) => logs.value[id]?.[date] ?? null

  // Mark a day done (with optional value) or undo it (value === undefined).
  async function setLog(id, date, value) {
    const prev = logs.value[id] ?? {}
    const next = { ...prev }
    if (value === undefined) delete next[date]
    else next[date] = value
    logs.value = { ...logs.value, [id]: next } // optimistic
    try {
      if (value === undefined) {
        await sql`delete from habit_logs where habit_id = ${id} and log_date = ${date}`
      } else {
        await sql`
          insert into habit_logs (habit_id, log_date, value) values (${id}, ${date}, ${value})
          on conflict (habit_id, log_date) do update set value = excluded.value
        `
      }
    } catch (e) {
      logs.value = { ...logs.value, [id]: prev }
      throw e
    }
  }

  // ── Timer sessions: raw start/stop kept for analytics, day total goes into habit_logs.value ──
  async function startTimer(id) {
    if (running.value[id]) return
    const startedAt = Date.now()
    const [row] = await sql`
      insert into habit_sessions (habit_id, started_at)
      values (${id}, ${new Date(startedAt).toISOString()})
      returning id
    `
    running.value = { ...running.value, [id]: { id: row.id, startedAt } }
  }

  async function stopTimer(id) {
    const r = running.value[id]
    if (!r) return
    const end = Date.now()
    const minutes = Math.round(((end - r.startedAt) / 60000) * 100) / 100
    await sql`
      update habit_sessions
      set ended_at = ${new Date(end).toISOString()}, minutes = ${minutes}
      where id = ${r.id}
    `
    const { [id]: _, ...rest } = running.value
    running.value = rest
    // Day total = existing minutes for the day the session began + this session
    const day = toISO(new Date(r.startedAt))
    const total = Math.round(((valueOf(id, day) ?? 0) + minutes) * 100) / 100
    await setLog(id, day, total)
    return minutes
  }

  async function discardTimer(id) {
    const r = running.value[id]
    if (!r) return
    await sql`delete from habit_sessions where id = ${r.id}`
    const { [id]: _, ...rest } = running.value
    running.value = rest
  }

  return { running, startTimer, stopTimer, discardTimer, habits, logs, loaded, load, add, update, remove, isDone, valueOf, setLog }
})
