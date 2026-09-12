import { CalendarCheck, ChartNoAxesCombined, ChevronRight, Dumbbell, Scale, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getWeightTrend, weeklyCalorieAverage } from "../lib/calculations.ts"
import { getStrengthProgress } from "../lib/workout-progression.ts"
import { CalorieReviewCard } from "../components/calories/CalorieReviewCard.tsx"
import { EmptyState, IconBadge, MetricCard, MobilePageHeader, SectionHeader, Surface } from "../components/shared/Visual.tsx"
import type { AdaptiveReviewResult } from "../lib/calorie-adaptation.ts"
import { daysAgo, formatDateTime, formatShortDate, toLocalDateKey } from "../lib/date.ts"
import type { FitnessData, WeightEntry } from "../types/fitness.ts"

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

  return (
    <div className="grid gap-5 sm:gap-6">
      <MobilePageHeader title="Progress" subtitle="Track your consistency." />

      <Surface className="steady-card-glow overflow-hidden p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <IconBadge icon={Scale} className="border-cyan-300/15 bg-cyan-400/10 text-cyan-300" />
            <div className="min-w-0"><p className="text-[0.7rem] font-semibold text-slate-400">Weight trend</p><h2 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.045em] tabular-nums text-slate-50">{trend.latest !== null ? `${trend.latest.toFixed(1)} kg` : "No data yet"}</h2></div>
          </div>
          {trend.change !== null && <p className={`pt-1 text-xs font-medium tabular-nums ${trend.change <= 0 ? "text-cyan-300" : "text-blue-300"}`}>{trend.change > 0 ? "+" : ""}{trend.change.toFixed(1)} kg</p>}
        </div>

        {recentWeights.length >= 2 ? (
          <div className="mt-4">
            <WeightTrendChart entries={recentWeights} />
            <div className="mt-1 flex justify-between text-[0.65rem] text-slate-600"><span>{formatShortDate(recentWeights[0]?.recorded_on ?? toLocalDateKey())}</span><span>{formatShortDate(recentWeights.at(-1)?.recorded_on ?? toLocalDateKey())}</span></div>
            {trend.currentAverage !== null && <p className="mt-2 text-xs text-slate-500">7-day average <span className="font-medium tabular-nums text-slate-300">{trend.currentAverage.toFixed(1)} kg</span></p>}
          </div>
        ) : <div className="mt-4"><EmptyState compact icon={Scale} title={recentWeights.length ? "One weigh-in logged" : "Your trend starts here"} description="Log a few more weigh-ins to build your trend." action={<Button variant="outline" onClick={onLogWeight}>Log weight</Button>} /></div>}
      </Surface>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={ChartNoAxesCombined} label="Calories this week" value={calorieAverage?.toLocaleString() ?? "—"} suffix="kcal" detail="Average logged day" />
        <MetricCard icon={CalendarCheck} label="Workouts this week" value={completedThisWeek.length} detail={`${normalThisMonth} Normal · ${lightThisMonth} Light this month`} />
      </div>

      {adaptiveReview && <CalorieReviewCard result={adaptiveReview} compact onReview={onOpenCalorieReview} />}

      <Surface className="p-4 sm:p-6">
        <SectionHeader eyebrow="Normal workouts" title="Strength progress" />
        {strengthProgress.length ? <div className="mt-3 divide-y divide-[#1b2d45]">{strengthProgress.map((item) => (
          <div key={item.exerciseName} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
            <IconBadge icon={TrendingUp} className="size-8 border-cyan-300/10 bg-cyan-400/[0.08] text-cyan-300" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{item.exerciseName}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{item.fromWeightKg} kg → {item.toWeightKg} kg</p></div>
            <p className="shrink-0 text-xs font-semibold tabular-nums text-cyan-300">+{(item.toWeightKg - item.fromWeightKg).toFixed(1)} kg</p>
          </div>
        ))}</div> : <EmptyState compact icon={Dumbbell} title="Build your strength history" description="Complete more Normal workouts to begin comparing performance." />}
        <p className="mt-4 text-xs text-slate-600">This month: {completedThisMonth.length} workouts · {normalThisMonth} Normal · {lightThisMonth} Light.</p>
      </Surface>

      <Surface className="p-4 sm:p-6">
        <SectionHeader eyebrow="Calories" title="Target history" />
        {data.calorieTargetHistory.length ? <div className="mt-3">{data.calorieTargetHistory.slice(0, 8).map((target, index) => (
          <div key={target.id} className="relative flex items-center justify-between gap-4 py-3 pl-6">
            <span className={`absolute left-0 size-2 rounded-full ${index === 0 ? "bg-cyan-300 ring-4 ring-cyan-300/10" : "bg-slate-700"}`} />
            {index < Math.min(data.calorieTargetHistory.length, 8) - 1 && <span className="absolute bottom-0 left-[0.22rem] top-5 w-px bg-[#1b2d45]" />}
            <div><p className="text-sm font-medium text-slate-300">{target.calories.toLocaleString()} kcal</p><p className="mt-0.5 text-xs text-slate-600">{formatShortDate(target.effective_from)}</p></div>
            <div className="text-right"><p className="text-xs text-slate-500">{target.reason === "initial_estimate" ? "Starting estimate" : target.reason === "profile_recalculation" ? "Profile recalculation" : "Adaptive adjustment"}</p>{index === 0 && <span className="mt-1 inline-block text-[0.62rem] font-semibold uppercase tracking-wider text-blue-400">Current</span>}</div>
          </div>
        ))}</div> : <EmptyState compact icon={ChartNoAxesCombined} title="No calorie targets yet" description="Your starting estimate will appear here after onboarding." />}
      </Surface>

      <section>
        <SectionHeader eyebrow="History" title="Recent sessions" />
        {data.sessions.some((session) => session.completed_at) ? <Surface className="overflow-hidden">{data.sessions.filter((session) => session.completed_at).slice(0, 6).map((session, index) => {
          const duration = session.completed_at ? Math.max(1, Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60_000)) : null
          return <div key={session.id} className={`flex items-center gap-3 px-4 py-3.5 ${index ? "border-t border-[#1b2d45]" : ""}`}><IconBadge icon={Dumbbell} className="size-8" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{session.title ?? session.template_name}</p><p className="mt-1 text-[0.68rem] text-slate-600">{session.completed_at ? formatDateTime(session.completed_at) : ""}{duration ? ` · ${duration} min` : ""}</p></div><span className="rounded-full border border-blue-400/10 bg-blue-500/[0.08] px-2 py-1 text-[0.62rem] font-medium capitalize text-blue-300">{session.mode}</span><ChevronRight className="size-4 text-slate-700" /></div>
        })}</Surface> : <EmptyState compact icon={Dumbbell} title="No sessions yet" description="Complete a workout to begin building your training history." />}
      </section>
    </div>
  )
}

function WeightTrendChart({ entries }: { entries: WeightEntry[] }) {
  const values = entries.map((entry) => entry.weight_kg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const actualRange = max - min
  const range = Math.max(actualRange, 0.5)
  const chartMin = min - (range - actualRange) / 2
  const points = entries.map((entry, index) => {
    const x = entries.length === 1 ? 160 : 8 + (index / (entries.length - 1)) * 304
    const y = 78 - ((entry.weight_kg - chartMin) / range) * 58
    return `${x},${y}`
  }).join(" ")
  const area = `8,86 ${points} 312,86`

  return (
    <svg className="h-24 w-full overflow-visible" viewBox="0 0 320 90" role="img" aria-label="Recent weight trend">
      <defs><linearGradient id="steady-weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs>
      <path d="M8 28H312 M8 56H312 M8 84H312" stroke="#1b2d45" strokeWidth="1" strokeDasharray="3 5" />
      <polygon points={area} fill="url(#steady-weight-fill)" />
      <polyline points={points} fill="none" stroke="#36d8f2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {entries.map((entry, index) => {
        const [x, y] = points.split(" ")[index].split(",")
        return <circle key={entry.id} cx={x} cy={y} r={index === entries.length - 1 ? 3.5 : 2} fill="#07111f" stroke="#67e8f9" strokeWidth="2"><title>{formatShortDate(entry.recorded_on)}: {entry.weight_kg} kg</title></circle>
      })}
    </svg>
  )
}
