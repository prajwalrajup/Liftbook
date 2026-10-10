import { defineStore } from 'pinia'
import { ref } from 'vue'
import sql from '../lib/db.js'

export const useBodyStore = defineStore('body', () => {
  const entries = ref([]) // ascending by recorded_on
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    const rows = await sql`
      select id, to_char(recorded_on, 'YYYY-MM-DD') as recorded_on,
             weight_kg::float as weight_kg, height_cm::float as height_cm
      from body_metrics
      order by recorded_on asc, created_at asc
    `
    entries.value = rows
    loaded.value = true
  }

  async function add({ recordedOn, weightKg, heightCm }) {
    const [row] = await sql`
      insert into body_metrics (recorded_on, weight_kg, height_cm)
      values (${recordedOn}, ${weightKg}, ${heightCm})
      returning id, to_char(recorded_on, 'YYYY-MM-DD') as recorded_on,
                weight_kg::float as weight_kg, height_cm::float as height_cm
    `
    entries.value = [...entries.value, row].sort((a, b) =>
      a.recorded_on.localeCompare(b.recorded_on),
    )
  }

  async function remove(id) {
    await sql`delete from body_metrics where id = ${id}`
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  return { entries, loaded, load, add, remove }
})
