import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import sql from '../lib/db.js'

export const useWorkoutStore = defineStore('workout', () => {
  const session = ref(null)
  const exercises = ref([])
  const currentIdx = ref(0)
  const sets = ref({})        // { [exercise_id]: [{ id, set_number, drop_number, weight, reps }] }
  const lastSets = ref({})    // { [exercise_id]: [{ set_number, drop_number, weight, reps }] } from prev session
  const status = ref('idle')

  const restSecondsLeft = ref(0)
  const restActive = ref(false)
  let restInterval = null

  const currentExercise = computed(() => exercises.value[currentIdx.value] ?? null)

  function setsFor(exerciseId) { return sets.value[exerciseId] ?? [] }
  function lastSetsFor(exerciseId) { return lastSets.value[exerciseId] ?? [] }

  function nextSetNumber(exerciseId) {
    return setsFor(exerciseId).filter(s => s.drop_number === 0).length + 1
  }

  // Returns the previous session's set row matching the given set number (main set only)
  function lastSetForNumber(exerciseId, setNumber) {
    return lastSetsFor(exerciseId).find(s => s.set_number === setNumber && s.drop_number === 0) ?? null
  }

  async function startSession(routineId) {
    const [routine] = await sql`select * from routines where id = ${routineId}`
    const exRows = await sql`
      select re.*, e.name, e.type, e.primary_muscles, e.equipment
      from routine_exercises re
      join exercises e on e.id = re.exercise_id
      where re.routine_id = ${routineId}
      order by re.position
    `

    // Fetch last finished session's sets for pre-fill
    const [prevSession] = await sql`
      select id from workout_sessions
      where routine_id = ${routineId} and finished_at is not null
      order by started_at desc limit 1
    `
    if (prevSession) {
      const prevRows = await sql`
        select exercise_id, set_number, drop_number, weight, reps
        from logged_sets where session_id = ${prevSession.id}
        order by set_number, drop_number
      `
      const byEx = {}
      for (const r of prevRows) {
        if (!byEx[r.exercise_id]) byEx[r.exercise_id] = []
        byEx[r.exercise_id].push(r)
      }
      lastSets.value = byEx
    } else {
      lastSets.value = {}
    }

    const [sess] = await sql`
      insert into workout_sessions (routine_id) values (${routineId}) returning *
    `
    session.value = { id: sess.id, routineId, routineName: routine.name, defaultRest: routine.rest_between_sets_seconds }
    exercises.value = exRows
    currentIdx.value = 0
    sets.value = {}
    status.value = 'active'
    stopRestTimer()
  }

  async function logSet(exerciseId, weight, reps) {
    const setNumber = nextSetNumber(exerciseId)
    const [row] = await sql`
      insert into logged_sets (session_id, exercise_id, set_number, drop_number, weight, reps)
      values (${session.value.id}, ${exerciseId}, ${setNumber}, 0, ${weight ?? null}, ${reps ?? null})
      returning *
    `
    if (!sets.value[exerciseId]) sets.value[exerciseId] = []
    sets.value[exerciseId].push(row)
    const ex = exercises.value.find(e => e.exercise_id === exerciseId)
    startRestTimer(ex?.rest_seconds ?? session.value.defaultRest)
  }

  async function logDrop(exerciseId, setNumber, weight, reps) {
    const dropNumber = setsFor(exerciseId).filter(s => s.set_number === setNumber).length
    const [row] = await sql`
      insert into logged_sets (session_id, exercise_id, set_number, drop_number, weight, reps)
      values (${session.value.id}, ${exerciseId}, ${setNumber}, ${dropNumber}, ${weight ?? null}, ${reps ?? null})
      returning *
    `
    sets.value[exerciseId].push(row)
    const ex = exercises.value.find(e => e.exercise_id === exerciseId)
    startRestTimer(ex?.rest_seconds ?? session.value.defaultRest)
  }

  async function finishSession() {
    stopRestTimer()
    await sql`update workout_sessions set finished_at = now() where id = ${session.value.id}`
    status.value = 'finished'
    session.value = null
    exercises.value = []
    sets.value = {}
    lastSets.value = {}
  }

  function startRestTimer(seconds) {
    stopRestTimer()
    restSecondsLeft.value = seconds
    restActive.value = true
    restInterval = setInterval(() => {
      restSecondsLeft.value--
      if (restSecondsLeft.value <= 0) stopRestTimer()
    }, 1000)
  }

  function stopRestTimer() {
    if (restInterval) { clearInterval(restInterval); restInterval = null }
    restActive.value = false
    restSecondsLeft.value = 0
  }

  function trimRest(seconds) {
    restSecondsLeft.value = Math.max(0, restSecondsLeft.value - seconds)
    if (restSecondsLeft.value === 0) stopRestTimer()
  }

  function goTo(idx) {
    if (idx >= 0 && idx < exercises.value.length) currentIdx.value = idx
  }

  return {
    session, exercises, currentIdx, sets, lastSets, status,
    restSecondsLeft, restActive,
    currentExercise, setsFor, lastSetsFor, nextSetNumber, lastSetForNumber,
    startSession, logSet, logDrop, finishSession,
    stopRestTimer, trimRest, goTo,
  }
})
