import { CalendarCheck, ChartNoAxesCombined, Dumbbell, Scale, TrendingUp } from "lucide-react"
import { getWeightTrend, weeklyCalorieAverage } from "../lib/calculations.ts"
import { getStrengthProgress } from "../lib/workout-progression.ts"
import { CalorieReviewCard } from "../components/calories/CalorieReviewCard.tsx"
import type { AdaptiveReviewResult } from "../lib/calorie-adaptation.ts"
import { daysAgo, formatDateTime, formatShortDate, toLocalDateKey } from "../lib/date.ts"
import type { FitnessData } from "../types/fitness.ts"

export function ProgressPage({ data, adaptiveReview, onOpenCalorieReview }: { data: FitnessData; adaptiveReview?: AdaptiveReviewResult; onOpenCalorieReview: () => void }) {
  const trend = getWeightTrend(data.weightEntries)
  const calorieAverage = weeklyCalorieAverage(data.foodEntries)
  const weekStart = daysAgo(6)
  const completedThisWeek = data.sessions.filter((session) => session.completed_at && new Date(session.completed_at) >= weekStart)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const completedThisMonth = data.sessions.filter((session) => session.completed_at && new Date(session.completed_at) >= monthStart)
  const normalThisMonth = completedThisMonth.filter((session) => session.mode === "normal").length
  const lightThisMonth = completedThisMonth.filter((session) => session.mode === "light").length
  const strengthProgress = getStrengthProgress(data.sessions, data.templates, monthStart)
  const recentWeights = data.weightEntries.slice(0, 14).reverse()
  const values = recentWeights.map((entry) => entry.weight_kg)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const range = Math.max(max - min, 0.5)

  return (
    <div className="grid gap-6">
      <header><p className="text-sm text-slate-500">Recent consistency</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Progress</h1></header>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Scale className="size-5" /></span><div><p className="text-sm text-slate-500">Latest weight</p><h2 className="text-2xl font-semibold">{trend.latest !== null ? `${trend.latest.toFixed(1)} kg` : "No data yet"}</h2></div></div>
        {recentWeights.length ? (
          <>
            <div className="mt-8 flex h-28 items-end gap-1.5" aria-label="Recent weight entries">
              {recentWeights.map((entry) => {
                const height = 28 + ((entry.weight_kg - min) / range) * 68
                return <div key={entry.id} className="group relative flex min-w-0 flex-1 items-end" title={`${formatShortDate(entry.recorded_on)}: ${entry.weight_kg} kg`}><div className="w-full rounded-t-md bg-blue-500/70 transition group-hover:bg-blue-400" style={{ height: `${height}%` }} /></div>
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600"><span>{formatShortDate(recentWeights[0].recorded_on)}</span><span>{formatShortDate(recentWeights.at(-1)?.recorded_on ?? toLocalDateKey())}</span></div>
            <p className="mt-5 text-sm text-slate-400">{trend.currentAverage !== null ? `Current 7-day average: ${trend.currentAverage.toFixed(1)} kg${trend.change !== null ? ` (${trend.change > 0 ? "+" : ""}${trend.change.toFixed(1)} kg vs prior week)` : ""}` : "Keep logging your weight to build a 7-day trend."}</p>
          </>
        ) : <p className="mt-6 text-sm text-slate-500">Your weight history will appear here after your first entry.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-center gap-3"><ChartNoAxesCombined className="text-blue-400" /><h2 className="font-semibold">Calories this week</h2></div>
          <p className="mt-6 text-3xl font-semibold tabular-nums">{calorieAverage?.toLocaleString() ?? "—"} <span className="text-sm font-normal text-slate-500">avg kcal / logged day</span></p>
          <p className="mt-2 text-sm text-slate-500">Starting target: {data.calorieTarget?.calories.toLocaleString() ?? "—"} kcal</p>
        </section>
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-center gap-3"><CalendarCheck className="text-blue-400" /><h2 className="font-semibold">Workouts this week</h2></div>
          <p className="mt-6 text-3xl font-semibold tabular-nums">{completedThisWeek.length} <span className="text-sm font-normal text-slate-500">completed</span></p>
          <p className="mt-2 text-sm text-slate-500">Light sessions count equally. Showing up is the point.</p>
        </section>
      </div>

      {adaptiveReview && <CalorieReviewCard result={adaptiveReview} onReview={onOpenCalorieReview} />}

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <h2 className="font-semibold">Calorie target history</h2>
        <p className="mt-1 text-xs text-slate-500">Starting estimates and accepted adjustments are preserved.</p>
        {data.calorieTargetHistory.length ? <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">{data.calorieTargetHistory.slice(0, 8).map((target, index) => <div key={target.id} className={`flex items-center justify-between gap-4 p-3 ${index ? "border-t border-slate-800" : ""}`}><div><p className="text-sm text-slate-300">{formatShortDate(target.effective_from)}</p><p className="mt-0.5 text-xs text-slate-600">{target.reason === "initial_estimate" ? "Starting estimate" : target.reason === "profile_recalculation" ? "Profile recalculation" : "Adaptive adjustment"}</p></div><p className="font-medium tabular-nums text-blue-300">{target.calories.toLocaleString()} kcal</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No calorie targets yet.</p>}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="flex items-center gap-3"><Dumbbell className="text-blue-400" /><div><h2 className="font-semibold">Recent strength progress</h2><p className="mt-0.5 text-xs text-slate-500">Completed Normal exercise history</p></div></div>
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300"><TrendingUp className="size-4 text-blue-400" /> Working-load changes</p>
          {strengthProgress.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              {strengthProgress.map((item, index) => (
                <div key={item.exerciseName} className={`flex items-center justify-between gap-4 p-3 ${index ? "border-t border-slate-800" : ""}`}><span className="text-sm text-slate-300">{item.exerciseName}</span><span className="shrink-0 text-sm font-medium text-blue-300">{item.fromWeightKg}kg → {item.toWeightKg}kg</span></div>
              ))}
            </div>
          ) : <p className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm leading-6 text-slate-500">Keep logging workouts to build exercise history. Light and skipped exercises do not alter load progression.</p>}
        </div>
        <p className="mt-4 text-xs text-slate-500">This month: {completedThisMonth.length} workouts · {normalThisMonth} Normal · {lightThisMonth} Light. Every completed session counts.</p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-400">Recent sessions</h2>
        {data.sessions.some((session) => session.completed_at) ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {data.sessions.filter((session) => session.completed_at).slice(0, 6).map((session, index) => (
              <div key={session.id} className={`flex items-center justify-between gap-4 p-4 ${index ? "border-t border-slate-800" : ""}`}><div><p className="font-medium">{session.template_name}</p><p className="mt-1 text-xs text-slate-500">{session.completed_at ? formatDateTime(session.completed_at) : ""}</p></div><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs capitalize text-slate-300">{session.mode}</span></div>
            ))}
          </div>
        ) : <p className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">Complete a workout to start your session history.</p>}
      </section>
    </div>
  )
}
