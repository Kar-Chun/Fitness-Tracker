import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, Flame, Plus, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CalorieReviewCard } from "../components/calories/CalorieReviewCard.tsx"
import { CircularProgress, IconBadge, MobilePageHeader, ProgressBar, Surface } from "../components/shared/Visual.tsx"
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
  const isOverTarget = target > 0 && remaining < 0
  const recentWorkout = data.sessions.find((session) => session.completed_at)
  const trend = getWeightTrend(data.weightEntries)
  const completedExercises = recentWorkout?.session_exercises.filter((exercise) => exercise.status === "completed").length ?? 0
  const workoutAge = daysSince(recentWorkout?.completed_at ?? null)

  return (
    <div className="grid gap-4 sm:gap-6">
      <MobilePageHeader eyebrow="Good morning." title="Keep it steady." subtitle="Your day, clearly at a glance." />

      <Surface className="steady-card-glow relative overflow-hidden p-4 sm:p-7">
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><IconBadge icon={Flame} className="size-8 text-cyan-300" /><p className="text-[0.72rem] font-semibold text-slate-300">Calories</p></div>
          <span className="rounded-full border border-blue-400/10 bg-blue-500/8 px-2.5 py-1 text-[0.65rem] font-medium text-blue-300">Today</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[2.35rem] font-semibold leading-none tracking-[-0.055em] text-slate-50 tabular-nums sm:text-5xl">{consumed.toLocaleString()}</p>
            <p className="mt-2 text-xs tabular-nums text-slate-500">of {target.toLocaleString()} kcal</p>
          </div>
          <CircularProgress value={percentage} label="Daily calorie progress" over={isOverTarget} />
        </div>
        <ProgressBar className="mt-5" value={percentage} label="Daily calorie progress" over={isOverTarget} />
        {target > 0 ? <p className={`mt-3 text-[0.78rem] ${isOverTarget ? "text-amber-300" : "text-slate-400"}`}><span className="font-semibold tabular-nums text-slate-100">{Math.abs(remaining).toLocaleString()} kcal</span> {remaining >= 0 ? "remaining" : "over target"}</p> : <p className="mt-3 text-[0.78rem] text-slate-500">No calorie target yet.</p>}
        <Button size="lg" className="mt-4 h-11 w-full" onClick={onAddFood}><Plus /> Add food</Button>
      </Surface>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Surface className="flex min-h-[10.5rem] min-w-0 flex-col p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-[0.7rem] font-semibold text-slate-400">Weight</p><IconBadge icon={Scale} className="size-7 border-cyan-400/10 bg-cyan-400/8 text-cyan-300" /></div>
          <p className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-slate-50 tabular-nums sm:text-3xl">{trend.latest !== null ? `${trend.latest.toFixed(1)} kg` : "No entry"}</p>
          {trend.currentAverage !== null ? (
            <div className="mt-1.5 text-[0.68rem] leading-4 text-slate-500">
              <p>7-day avg <span className="text-slate-300 tabular-nums">{trend.currentAverage.toFixed(1)} kg</span></p>
              {trend.change !== null && <p className="mt-1 flex items-center text-cyan-300">{trend.change <= 0 ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}{Math.abs(trend.change).toFixed(1)} kg</p>}
            </div>
          ) : <p className="mt-1.5 text-[0.68rem] leading-4 text-slate-600">Keep logging to build your trend.</p>}
          <Button size="sm" variant="ghost" className="mt-auto h-9 justify-start px-0 text-blue-300" onClick={onLogWeight}>Log weight <ArrowRight /></Button>
        </Surface>

        <Surface className="flex min-h-[10.5rem] min-w-0 flex-col p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-[0.7rem] font-semibold text-slate-400">{recentWorkout ? "Recent workout" : "Workout"}</p><IconBadge icon={Dumbbell} className="size-7" /></div>
          <p className="mt-3 line-clamp-2 text-base font-semibold leading-5 tracking-tight text-slate-100 sm:text-lg">{recentWorkout?.title ?? recentWorkout?.template_name ?? "Ready to train?"}</p>
          <p className="mt-1.5 text-[0.68rem] leading-4 text-slate-600">{recentWorkout ? `${workoutAge === 0 ? "Today" : `${workoutAge}d ago`} · ${completedExercises} exercises` : `${data.templates.length} routines ready`}</p>
          <Button size="sm" variant="ghost" className="mt-auto h-9 justify-start px-0 text-blue-300" onClick={onOpenWorkout}>{recentWorkout ? "Open workout" : "Choose workout"} <ArrowRight /></Button>
        </Surface>
      </div>

      {adaptiveReview && <CalorieReviewCard result={adaptiveReview} compact onReview={onOpenCalorieReview} />}
    </div>
  )
}
