const pad = (n) => String(n).padStart(2, '0')

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromISO = (iso) => new Date(iso + 'T00:00')

// The app's day starts at 9am: before that, it is still "yesterday".
export const DAY_START_HOUR = 9
const dayShifted = (t) => new Date(new Date(t).getTime() - DAY_START_HOUR * 3600000)
// Local-midnight Date for the app day containing time `t` (default: now)
export function appDay(t = Date.now()) {
  const s = dayShifted(t)
  return new Date(s.getFullYear(), s.getMonth(), s.getDate())
}
export const appDayISO = (t = Date.now()) => toISO(appDay(t))

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function frequencyLabel(days) {
  if (days.length === 7) return 'Daily'
  // Monday-first order
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => days.includes(d))
    .map((d) => DAY_NAMES[d])
    .join(' · ')
}

export function formatMinutes(min) {
  if (min > 0 && min < 1) return '<1 min'
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

const trimNum = (v) => String(Math.round(v * 100) / 100)

export function formatValue(habit, v) {
  if (v == null) return ''
  if (habit.metric === 'timer') return formatMinutes(v)
  return `${trimNum(v)}${habit.unit ? ' ' + habit.unit : ''}`
}

// Stats for one habit over scheduled days from max(created_on, range start) to today.
// logMap: { 'YYYY-MM-DD': value|null } of days marked done.
// A scheduled past day without a log is "missed". Today only counts once done.
export function computeStats(habit, logMap, { rangeDays = null, today = appDay() } = {}) {
  const done = new Set(Object.keys(logMap))
  const todayISO = toISO(today)
  let start = fromISO(habit.created_on)
  if (rangeDays) {
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (rangeDays - 1))
    if (s > start) start = s
  }

  let success = 0
  let missed = 0
  let sum = 0
  let valued = 0
  const seq = []
  for (const d = new Date(start); toISO(d) <= todayISO; d.setDate(d.getDate() + 1)) {
    if (!habit.days.includes(d.getDay())) continue
    const iso = toISO(d)
    const ok = done.has(iso)
    if (ok) {
      success++
      const v = logMap[iso]
      if (v != null) { sum += v; valued++ }
    }
    else if (iso < todayISO) missed++
    seq.push({ iso, ok })
  }

  let i = seq.length - 1
  if (i >= 0 && seq[i].iso === todayISO && !seq[i].ok) i--
  let streak = 0
  for (; i >= 0 && seq[i].ok; i--) streak++

  const total = success + missed
  return {
    success, missed, total, rate: total ? success / total : null, streak,
    sum, avg: valued ? sum / valued : null,
  }
}

// What counts toward the calendar on a date: mandatory habits scheduled that day,
// plus the scheduled workout. Returns how many were required and how many are done.
// logs: { habitId: { 'YYYY-MM-DD': value|null } }
// workout: { dows: Set<number>, done: Set<string>, from: string|null } | null
// Workouts only count from `from` (first workout ever started) so history before
// the app was in use isn't marked as missed.
export function daySummary(habits, logs, iso, workout = null) {
  const dow = fromISO(iso).getDay()
  let total = 0
  let done = 0
  for (const h of habits) {
    if (!h.mandatory || h.created_on > iso || !h.days.includes(dow)) continue
    total++
    if (iso in (logs[h.id] ?? {})) done++
  }
  if (workout && workout.from && iso >= workout.from && workout.dows.has(dow)) {
    total++
    if (workout.done.has(iso)) done++
  }
  return { total, done }
}
