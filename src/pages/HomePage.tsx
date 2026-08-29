import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, Plus, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { caloriesConsumed, caloriesRemaining, entriesForToday, getWeightTrend } from "../lib/calculations.ts"
import type { FitnessData } from "../types/fitness.ts"

interface HomePageProps {
  data: FitnessData
  onAddFood: () => void
  onLogWeight: () => void
  onOpenWorkout: () => void
}

export function HomePage({ data, onAddFood, onLogWeight, onOpenWorkout }: HomePageProps) {
  const todayEntries = entriesForToday(data.foodEntries)
  const consumed = caloriesConsumed(todayEntries)
  const target = data.calorieTarget?.calories ?? 0
  const remaining = caloriesRemaining(target, consumed)
  const percentage = target > 0 ? Math.min(100, Math.max(0, (consumed / target) * 100)) : 0
  const recentWorkout = data.sessions.find((session) => session.completed_at)
  const trend = getWeightTrend(data.weightEntries)

  return (
    <div className="grid gap-5">
      <header className="mb-2">
        <p className="text-sm text-slate-500">Today</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Keep it steady.</h1>
      </header>

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-400">Calories</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl">{consumed.toLocaleString()} <span className="text-lg font-normal text-slate-500">/ {target.toLocaleString()} kcal</span></p>
          </div>
          <Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" onClick={onAddFood}><Plus /> <span className="hidden sm:inline">Add food</span></Button>
        </div>
        <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Daily calorie progress" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-amber-400" : "bg-blue-500"}`} style={{ width: `${percentage}%` }} />
        </div>
        <p className={`mt-3 text-sm ${remaining < 0 ? "text-amber-300" : "text-slate-400"}`}>
          {remaining >= 0 ? `${remaining.toLocaleString()} kcal remaining` : `${Math.abs(remaining).toLocaleString()} kcal over your estimate`}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-400">WORKOUT</p>
              <h2 className="mt-2 text-2xl font-semibold">{recentWorkout?.title ?? recentWorkout?.template_name ?? "Choose how you train"}</h2>
              <p className="mt-1 text-sm text-slate-500">{recentWorkout ? "Start again, choose a routine, or log a finished workout." : `${data.templates.length} routines ready · Quick Workout available`}</p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-400"><Dumbbell /></span>
          </div>
          <Button size="lg" className="mt-6 h-11 w-full bg-blue-500 hover:bg-blue-400" onClick={onOpenWorkout}>Open workouts <ArrowRight /></Button>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Weight</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{trend.latest !== null ? `${trend.latest.toFixed(1)} kg` : "No entries"}</p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-slate-800 text-slate-300"><Scale /></span>
          </div>
          {trend.currentAverage !== null ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <span>7-day average {trend.currentAverage.toFixed(1)} kg</span>
              {trend.change !== null && <span className={`flex items-center ${trend.change <= 0 ? "text-emerald-400" : "text-amber-300"}`}>{trend.change <= 0 ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}{Math.abs(trend.change).toFixed(1)} kg</span>}
            </div>
          ) : <p className="mt-4 text-sm leading-6 text-slate-500">Keep logging your weight to build a 7-day trend.</p>}
          <Button size="lg" variant="outline" className="mt-6 h-11 w-full" onClick={onLogWeight}><Plus /> Log weight</Button>
        </section>
      </div>
    </div>
  )
}
