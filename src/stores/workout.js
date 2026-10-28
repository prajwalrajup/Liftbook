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

  async function loadLastSets(routineId) {
    // Previous finished session's sets, for pre-fill
    const [prevSession] = await sql`
      select id from workout_sessions
      where routine_id = ${routineId} and finished_at is not null
      order by started_at desc limit 1
    `
    const byEx = {}
    if (prevSession) {
      const prevRows = await sql`
        select exercise_id, set_number, drop_number, weight, reps
        from logged_sets where session_id = ${prevSession.id}
        order by set_number, drop_number
      `
      for (const r of prevRows) (byEx[r.exercise_id] ??= []).push(r)
    }
    lastSets.value = byEx
  }

  // Latest unfinished session (paused or just left open) from the last 24h, if any.
  async function findOpenSession(routineId = null) {
    const [row] = await sql`
      select s.id, s.routine_id, s.started_at, s.paused_at, r.name as routine_name,
             (select count(*) from logged_sets l where l.session_id = s.id and l.drop_number = 0)::int as sets_logged
      from workout_sessions s
      left join routines r on r.id = s.routine_id
      where s.finished_at is null
        and s.started_at > now() - interval '24 hours'
        and (${routineId}::uuid is null or s.routine_id = ${routineId}::uuid)
      order by s.started_at desc
      limit 1
    `
    return row ?? null
  }

  async function startSession(routineId) {
    const open = await findOpenSession(routineId)
    if (open) return resumeSession(open.id)

    const [routine] = await sql`select * from routines where id = ${routineId}`
    const exRows = await sql`
      select re.*, e.name, e.type, e.primary_muscles, e.equipment
      from routine_exercises re
      join exercises e on e.id = re.exercise_id
      where re.routine_id = ${routineId}
      order by re.position
    `
    await loadLastSets(routineId)

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

  // Continue a paused / left-open session: restores the day's plan and logged sets.
  async function resumeSession(sessionId) {
    const [sess] = await sql`select * from workout_sessions where id = ${sessionId}`
    if (!sess || sess.finished_at) throw new Error('That workout is already finished.')
    const [routine] = await sql`select * from routines where id = ${sess.routine_id}`

    let list
    let idx = 0
    if (sess.plan?.exercises) {
      list = sess.plan.exercises
      idx = sess.plan.idx ?? 0
    } else {
      list = await sql`
        select re.*, e.name, e.type, e.primary_muscles, e.equipment
        from routine_exercises re
        join exercises e on e.id = re.exercise_id
        where re.routine_id = ${sess.routine_id}
        order by re.position
      `
    }

    const rows = await sql`
      select * from logged_sets where session_id = ${sessionId} order by set_number, drop_number
    `
    const byEx = {}
    for (const r of rows) (byEx[r.exercise_id] ??= []).push(r)

    // Any exercise with logged sets must stay visible, even if it isn't in the saved plan
    const missing = Object.keys(byEx).filter(id => !list.some(e => e.exercise_id === id))
    for (const id of missing) {
      const [ex] = await sql`select id, name, type, primary_muscles, equipment from exercises where id = ${id}`
      if (ex) list = [...list, { exercise_id: ex.id, name: ex.name, type: ex.type, primary_muscles: ex.primary_muscles, equipment: ex.equipment, target_sets: null, target_reps: null, rest_seconds: null }]
    }

    await loadLastSets(sess.routine_id)
    await sql`update workout_sessions set paused_at = null where id = ${sessionId}`

    session.value = { id: sessionId, routineId: sess.routine_id, routineName: routine?.name ?? 'Workout', defaultRest: routine?.rest_between_sets_seconds ?? 90 }
    exercises.value = list
    currentIdx.value = Math.min(idx, Math.max(0, list.length - 1))
    sets.value = byEx
    status.value = 'active'
    stopRestTimer()
  }

  // Save today's plan (targets / added / removed exercises) so it survives a pause or reload
  async function persistPlan() {
    if (!session.value) return
    const plan = { exercises: exercises.value, idx: currentIdx.value }
    await sql`update workout_sessions set plan = ${JSON.stringify(plan)}::jsonb where id = ${session.value.id}`
  }

  async function pauseSession() {
    await persistPlan()
    await sql`update workout_sessions set paused_at = now() where id = ${session.value.id}`
    stopRestTimer()
    status.value = 'idle'
    session.value = null
    exercises.value = []
    sets.value = {}
    lastSets.value = {}
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

  // ── Edit today's session only. Nothing here touches routines / routine_exercises. ──

  function updateTargets(exerciseId, { targetSets, targetReps }) {
    exercises.value = exercises.value.map(e =>
      e.exercise_id === exerciseId ? { ...e, target_sets: targetSets, target_reps: targetReps } : e,
    )
    persistPlan().catch(() => {})
  }

  // exercise must already exist in `exercises` table (caller ensures FK)
  function addExercise(ex) {
    if (exercises.value.some(e => e.exercise_id === ex.id)) {
      currentIdx.value = exercises.value.findIndex(e => e.exercise_id === ex.id)
      return
    }
    exercises.value = [...exercises.value, {
      exercise_id: ex.id,
      name: ex.name,
      type: ex.type,
      primary_muscles: ex.primary_muscles,
      equipment: ex.equipment,
      target_sets: null,
      target_reps: null,
      rest_seconds: null,
    }]
    currentIdx.value = exercises.value.length - 1
    persistPlan().catch(() => {})
  }

  // Only exercises without logged sets can be removed (logged sets must stay attached to something visible)
  function canRemoveExercise(exerciseId) {
    return setsFor(exerciseId).length === 0
  }

  function removeExercise(exerciseId) {
    if (!canRemoveExercise(exerciseId)) return
    exercises.value = exercises.value.filter(e => e.exercise_id !== exerciseId)
    if (currentIdx.value >= exercises.value.length) currentIdx.value = Math.max(0, exercises.value.length - 1)
    persistPlan().catch(() => {})
  }

  async function updateSet(exerciseId, rowId, weight, reps) {
    await sql`update logged_sets set weight = ${weight ?? null}, reps = ${reps ?? null} where id = ${rowId}`
    sets.value = {
      ...sets.value,
      [exerciseId]: setsFor(exerciseId).map(s => s.id === rowId ? { ...s, weight: weight ?? null, reps: reps ?? null } : s),
    }
  }

  // Deleting a main set removes its drops too and closes the numbering gap;
  // deleting a drop closes the drop-number gap.
  async function deleteSet(exerciseId, rowId) {
    const row = setsFor(exerciseId).find(s => s.id === rowId)
    if (!row) return
    const sid = session.value.id
    if (row.drop_number === 0) {
      const n = row.set_number
      await sql`delete from logged_sets where session_id = ${sid} and exercise_id = ${exerciseId} and set_number = ${n}`
      await sql`
        update logged_sets set set_number = set_number - 1
        where session_id = ${sid} and exercise_id = ${exerciseId} and set_number > ${n}
      `
      sets.value = {
        ...sets.value,
        [exerciseId]: setsFor(exerciseId)
          .filter(s => s.set_number !== n)
          .map(s => s.set_number > n ? { ...s, set_number: s.set_number - 1 } : s),
      }
    } else {
      const { set_number: n, drop_number: d } = row
      await sql`delete from logged_sets where id = ${rowId}`
      await sql`
        update logged_sets set drop_number = drop_number - 1
        where session_id = ${sid} and exercise_id = ${exerciseId} and set_number = ${n} and drop_number > ${d}
      `
      sets.value = {
        ...sets.value,
        [exerciseId]: setsFor(exerciseId)
          .filter(s => s.id !== rowId)
          .map(s => s.set_number === n && s.drop_number > d ? { ...s, drop_number: s.drop_number - 1 } : s),
      }
    }
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

  // Created on the set-log tap so the browser's autoplay rule allows the beeps when the timer ends
  let audioCtx = null
  function beep3() {
    const ctx = audioCtx
    if (!ctx) return
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      osc.connect(gain).connect(ctx.destination)
      const t = ctx.currentTime + i * 0.4
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.setValueAtTime(0, t + 0.2)
      osc.start(t)
      osc.stop(t + 0.2)
    }
  }

  function startRestTimer(seconds) {
    stopRestTimer()
    try {
      audioCtx ??= new AudioContext()
      audioCtx.resume()
    } catch { audioCtx = null }
    restSecondsLeft.value = seconds
    restActive.value = true
    restInterval = setInterval(() => {
      restSecondsLeft.value--
      if (restSecondsLeft.value <= 0) { stopRestTimer(); beep3() }
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
    startSession, resumeSession, findOpenSession, pauseSession, logSet, logDrop, finishSession,
    updateTargets, addExercise, canRemoveExercise, removeExercise, updateSet, deleteSet,
    stopRestTimer, trimRest, goTo,
  }
})
