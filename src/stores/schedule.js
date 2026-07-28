import { defineStore } from 'pinia'
import { ref } from 'vue'
import sql from '../lib/db.js'

export const useScheduleStore = defineStore('schedule', () => {
  // Keyed by day_of_week (0=Sun … 6=Sat)
  const schedule = ref({})
  const loaded = ref(false)

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
      await sql`delete from weekly_schedule where day_of_week = ${dayOfWeek}`
    }
    // Reload affected day
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

  return { schedule, loaded, load, setDay, todayEntry }
})
