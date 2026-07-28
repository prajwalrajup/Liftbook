import { createRouter, createWebHashHistory } from 'vue-router'
import TodayView from '../views/TodayView.vue'
import DbTestView from '../views/DbTestView.vue'
import ExercisesView from '../views/ExercisesView.vue'
import RoutineFormView from '../views/RoutineFormView.vue'
import WorkoutView from '../views/WorkoutView.vue'
import RoutinesView from '../views/RoutinesView.vue'
import CalendarView from '../views/CalendarView.vue'
import HistoryView from '../views/HistoryView.vue'
import LoginView from '../views/LoginView.vue'

const routes = [
  { path: '/', redirect: '/today' },
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/today', name: 'today', component: TodayView },
  { path: '/routines', name: 'routines', component: RoutinesView },
  { path: '/calendar', name: 'calendar', component: CalendarView },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/exercises', name: 'exercises', component: ExercisesView },
  { path: '/workout/:routineId', name: 'workout', component: WorkoutView },
  { path: '/routines/new', name: 'routine-new', component: RoutineFormView },
  { path: '/routines/:id/edit', name: 'routine-edit', component: RoutineFormView },
  { path: '/dbtest', name: 'dbtest', component: DbTestView },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (sessionStorage.getItem('lb_auth') === '1') return true
  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
