import { ArrowRight, CalendarCheck, ChartNoAxesCombined, Dumbbell, Scale, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getWeightTrend, weeklyCalorieAverage } from "../lib/calculations.ts"
import { getStrengthProgress } from "../lib/workout-progression.ts"
import { CalorieReviewCard } from "../components/calories/CalorieReviewCard.tsx"
import { EmptyState, IconBadge, MetricCard, PageHeader, SectionHeader, Surface } from "../components/shared/Visual.tsx"
import type { AdaptiveReviewResult } from "../lib/calorie-adaptation.ts"
import { daysAgo, formatDateTime, formatShortDate, toLocalDateKey } from "../lib/date.ts"
import type { FitnessData } from "../types/fitness.ts"

interface ProgressPageProps {
  data: FitnessData
  adaptiveReview?: AdaptiveReviewResult
  onOpenCalorieReview: () => void
  onLogWeight: () => void
}

export function ProgressPage({ data, adaptiveReview, onOpenCalorieReview, onLogWeight }: ProgressPageProps) {
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
      <PageHeader eyebrow="Recent consistency" title="Progress" description="See the few signals that matter: trend, consistency, and strength." />

      <Surface className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3"><IconBadge icon={Scale} /><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Weight trend</p><h2 className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{trend.latest !== null ? `${trend.latest.toFixed(1)} kg` : "No data yet"}</h2></div></div>
          {trend.currentAverage !== null && <div className="text-right"><p className="text-xs text-slate-600">7-day average</p><p className="mt-1 font-medium tabular-nums text-slate-300">{trend.currentAverage.toFixed(1)} kg</p>{trend.change !== null && <p className="mt-0.5 text-xs tabular-nums text-blue-300">{trend.change > 0 ? "+" : ""}{trend.change.toFixed(1)} kg vs prior week</p>}</div>}
        </div>
        {recentWeights.length >= 2 ? (
          <>
            <div className="mt-7 flex h-32 items-end gap-1.5 border-b border-slate-800/80 px-1" aria-label="Recent weight entries">
              {recentWeights.map((entry) => {
                const height = 25 + ((entry.weight_kg - min) / range) * 70
                return <div key={entry.id} className="group relative flex min-w-0 flex-1 items-end" title={`${formatShortDate(entry.recorded_on)}: ${entry.weight_kg} kg`}><div className="w-full rounded-t bg-blue-500/55 transition duration-200 group-hover:bg-blue-400" style={{ height: `${height}%` }} /></div>
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600"><span>{formatShortDate(recentWeights[0]?.recorded_on ?? toLocalDateKey())}</span><span>{formatShortDate(recentWeights.at(-1)?.recorded_on ?? toLocalDateKey())}</span></div>
          </>
        ) : <div className="mt-6"><EmptyState compact icon={Scale} title={recentWeights.length ? "One weigh-in logged" : "Your trend starts here"} description="Log at least two weigh-ins to begin seeing direction without overreacting to a single day." action={<Button variant="outline" onClick={onLogWeight}>Log weight</Button>} /></div>}
      </Surface>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={ChartNoAxesCombined} label="Calories" value={calorieAverage?.toLocaleString() ?? "—"} suffix="avg / day" detail={`Target ${data.calorieTarget?.calories.toLocaleString() ?? "—"} kcal`} />
        <MetricCard icon={CalendarCheck} label="Workouts" value={completedThisWeek.length} suffix="this week" detail={`${normalThisMonth} Normal · ${lightThisMonth} Light this month`} />
      </div>

      {adaptiveReview && <CalorieReviewCard result={adaptiveReview} onReview={onOpenCalorieReview} />}

      <Surface className="p-5 sm:p-6">
        <SectionHeader eyebrow="Calories" title="Target history" />
        {data.calorieTargetHistory.length ? <div className="mt-4">{data.calorieTargetHistory.slice(0, 8).map((target, index) => (
          <div key={target.id} className="relative flex items-center justify-between gap-4 py-3 pl-6">
            <span className={`absolute left-0 size-2 rounded-full ${index === 0 ? "bg-blue-400 ring-4 ring-blue-400/10" : "bg-slate-700"}`} />
            {index < Math.min(data.calorieTargetHistory.length, 8) - 1 && <span className="absolute bottom-0 left-[0.22rem] top-5 w-px bg-slate-800" />}
            <div><p className="text-sm text-slate-300">{formatShortDate(target.effective_from)}</p><p className="mt-0.5 text-xs text-slate-600">{target.reason === "initial_estimate" ? "Starting estimate" : target.reason === "profile_recalculation" ? "Profile recalculation" : "Adaptive adjustment"}</p></div>
            <div className="text-right"><p className="font-semibold tabular-nums text-slate-100">{target.calories.toLocaleString()} kcal</p>{index === 0 && <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-blue-400">Current</span>}</div>
          </div>
        ))}</div> : <EmptyState compact icon={ChartNoAxesCombined} title="No calorie targets yet" description="Your starting estimate will appear here after onboarding." />}
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionHeader eyebrow="Normal workouts" title="Strength progress" />
        {strengthProgress.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{strengthProgress.map((item) => (
          <div key={item.exerciseName} className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-200">{item.exerciseName}</p><p className="mt-2 text-lg font-semibold tabular-nums text-blue-300">{item.fromWeightKg}kg → {item.toWeightKg}kg</p></div><TrendingUp className="size-4 text-blue-400" /></div><p className="mt-1 text-xs text-slate-600">+{(item.toWeightKg - item.fromWeightKg).toFixed(1)} kg working load</p></div>
        ))}</div> : <EmptyState compact icon={Dumbbell} title="Strength progress starts after another session" description="Complete another Normal workout to compare exercise performance. Light and skipped work remain excluded." />}
        <p className="mt-4 text-xs text-slate-600">This month: {completedThisMonth.length} workouts · {normalThisMonth} Normal · {lightThisMonth} Light.</p>
      </Surface>

      <section>
        <SectionHeader eyebrow="History" title="Recent sessions" />
        {data.sessions.some((session) => session.completed_at) ? <Surface className="overflow-hidden">{data.sessions.filter((session) => session.completed_at).slice(0, 6).map((session, index) => {
          const duration = session.completed_at ? Math.max(1, Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60_000)) : null
          return <div key={session.id} className={`flex items-center gap-4 px-4 py-3.5 ${index ? "border-t border-slate-800/80" : ""}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{session.title ?? session.template_name}</p><p className="mt-1 text-xs text-slate-600">{session.completed_at ? formatDateTime(session.completed_at) : ""}{duration ? ` · ${duration} min` : ""} · <span className="capitalize">{session.mode}</span></p></div><ArrowRight className="size-4 text-slate-700" /></div>
        })}</Surface> : <EmptyState compact icon={Dumbbell} title="No sessions yet" description="Complete a workout to begin building your training history." />}
      </section>
    </div>
  )
}
