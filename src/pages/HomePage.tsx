import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, Plus, Scale, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CalorieReviewCard } from "../components/calories/CalorieReviewCard.tsx"
import { IconBadge, PageHeader, ProgressBar, Surface } from "../components/shared/Visual.tsx"
import { caloriesConsumed, caloriesRemaining, entriesForToday, getWeightTrend } from "../lib/calculations.ts"
import type { AdaptiveReviewResult } from "../lib/calorie-adaptation.ts"
import type { FitnessData } from "../types/fitness.ts"

interface HomePageProps {
  data: FitnessData
  onAddFood: () => void
  onLogWeight: () => void
  onOpenWorkout: () => void
  adaptiveReview?: AdaptiveReviewResult
  onOpenCalorieReview: () => void
}

function daysSince(iso: string | null) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function HomePage({ data, onAddFood, onLogWeight, onOpenWorkout, adaptiveReview, onOpenCalorieReview }: HomePageProps) {
  const todayEntries = entriesForToday(data.foodEntries)
  const consumed = caloriesConsumed(todayEntries)
  const target = data.calorieTarget?.calories ?? 0
  const remaining = caloriesRemaining(target, consumed)
  const percentage = target > 0 ? Math.min(100, Math.max(0, (consumed / target) * 100)) : 0
  const recentWorkout = data.sessions.find((session) => session.completed_at)
  const trend = getWeightTrend(data.weightEntries)
  const completedExercises = recentWorkout?.session_exercises.filter((exercise) => exercise.status === "completed").length ?? 0
  const workoutAge = daysSince(recentWorkout?.completed_at ?? null)

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Today" title="Keep it steady." description="Your daily nutrition, training, and weight at a glance." />

      <Surface className="relative overflow-hidden p-5 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-blue-400/35" />
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5"><IconBadge icon={Utensils} /><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Calories</p></div>
            <p className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-slate-50 tabular-nums sm:text-5xl">{consumed.toLocaleString()} <span className="text-base font-normal tracking-normal text-slate-500 sm:text-lg">/ {target.toLocaleString()} kcal</span></p>
            <p className={`mt-2 text-sm ${remaining < 0 ? "text-amber-300" : "text-slate-400"}`}><span className="font-semibold tabular-nums text-slate-200">{Math.abs(remaining).toLocaleString()}</span> kcal {remaining >= 0 ? "remaining" : "over target"}</p>
          </div>
          <Button size="lg" className="h-11 px-5" onClick={onAddFood}><Plus /> Add food</Button>
        </div>
        <ProgressBar className="mt-7" value={percentage} label="Daily calorie progress" over={remaining < 0} />
        <div className="mt-3 flex justify-between text-xs text-slate-600"><span>0</span><span>{target.toLocaleString()} target</span></div>
      </Surface>

      {adaptiveReview && <CalorieReviewCard result={adaptiveReview} compact onReview={onOpenCalorieReview} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-slate-500">{recentWorkout ? "Last workout" : "Workout"}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{recentWorkout?.title ?? recentWorkout?.template_name ?? "Ready to train?"}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{recentWorkout ? `${workoutAge === 0 ? "Today" : `${workoutAge}d ago`} · ${completedExercises} exercises` : `${data.templates.length} routines ready · Quick Workout available`}</p>
            </div>
            <IconBadge icon={Dumbbell} />
          </div>
          <Button size="lg" className="mt-6 h-11" onClick={onOpenWorkout}>{recentWorkout ? "Open workout" : "Choose workout"} <ArrowRight /></Button>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-slate-500">Weight</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{trend.latest !== null ? `${trend.latest.toFixed(1)} kg` : "No entries"}</p>
            </div>
            <IconBadge icon={Scale} className="border-slate-700 bg-slate-800/70 text-slate-300" />
          </div>
          {trend.currentAverage !== null ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>7-day average <span className="text-slate-300 tabular-nums">{trend.currentAverage.toFixed(1)} kg</span></span>
              {trend.change !== null && <span className="flex items-center text-blue-300">{trend.change <= 0 ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}{Math.abs(trend.change).toFixed(1)} kg</span>}
            </div>
          ) : <p className="mt-4 text-sm leading-6 text-slate-500">Keep logging your weight to build a 7-day trend.</p>}
          <Button size="lg" variant="outline" className="mt-6 h-11" onClick={onLogWeight}><Plus /> Log weight</Button>
        </Surface>
      </div>
    </div>
  )
}
