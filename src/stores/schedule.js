import { defineStore } from 'pinia'
import { ref } from 'vue'
import sql from '../lib/db.js'

export const useScheduleStore = defineStore('schedule', () => {
  // Keyed by day_of_week (0=Sun … 6=Sat)
  const schedule = ref({})
  const loaded = ref(false)
  // Local dates ('YYYY-MM-DD') with a finished workout, and the first date any workout was started
  const workoutDays = ref([])
  const firstWorkoutDay = ref(null)

  async function load() {
    if (loaded.value) return
    const rows = await sql`
      select ws.*, r.name as routine_name
      from weekly_schedule ws
      left join routines r on r.id = ws.routine_id
    `
    const map = {}
    for (const row of rows) map[row.day_of_week] = row
    schedule.value = map
    loaded.value = true
  }

  async function loadWorkoutDays() {
    const rows = await sql`select started_at, finished_at is not null as finished from workout_sessions`
    const iso = (t) => {
      const d = new Date(t)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const days = new Set()
    let first = null
    for (const r of rows) {
      const day = iso(r.started_at)
      if (first == null || day < first) first = day
      if (r.finished) days.add(day)
    }
    workoutDays.value = [...days]
    firstWorkoutDay.value = first
  }

  async function setDay(dayOfWeek, { routineId, isRestDay }) {
    if (routineId) {
      await sql`
        insert into weekly_schedule (day_of_week, routine_id, is_rest_day)
        values (${dayOfWeek}, ${routineId}, false)
        on conflict (day_of_week) do update
          set routine_id = excluded.routine_id, is_rest_day = false
      `
    } else if (isRestDay) {
      await sql`
        insert into weekly_schedule (day_of_week, routine_id, is_rest_day)
        values (${dayOfWeek}, null, true)
        on conflict (day_of_week) do update
          set routine_id = null, is_rest_day = true
      `
    } else {
      await sql`
        update weekly_schedule set routine_id = null, is_rest_day = false
        where day_of_week = ${dayOfWeek}
      `
      await prune(dayOfWeek)
    }
    await reloadDay(dayOfWeek)
  }

  async function setWeighIn(dayOfWeek, weighIn) {
    await sql`
      insert into weekly_schedule (day_of_week, routine_id, is_rest_day, weigh_in)
      values (${dayOfWeek}, null, false, ${weighIn})
      on conflict (day_of_week) do update set weigh_in = excluded.weigh_in
    `
    await prune(dayOfWeek)
    await reloadDay(dayOfWeek)
  }

  // Drop rows that carry no schedule info at all
  async function prune(dayOfWeek) {
    await sql`
      delete from weekly_schedule
      where day_of_week = ${dayOfWeek}
        and routine_id is null and not is_rest_day and not weigh_in
    `
  }

  async function reloadDay(dayOfWeek) {
    const rows = await sql`
      select ws.*, r.name as routine_name
      from weekly_schedule ws
      left join routines r on r.id = ws.routine_id
      where ws.day_of_week = ${dayOfWeek}
    `
    const updated = { ...schedule.value }
    if (rows.length) updated[dayOfWeek] = rows[0]
    else delete updated[dayOfWeek]
    schedule.value = updated
  }

  function todayEntry() {
    const dow = new Date().getDay()
    return schedule.value[dow] ?? null
  }

  return { schedule, loaded, workoutDays, firstWorkoutDay, loadWorkoutDays, load, setDay, setWeighIn, todayEntry }
})
