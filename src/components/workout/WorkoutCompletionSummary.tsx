import { Check, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatExercisePerformance, getWorkoutProgressSummary } from "../../lib/workout-progression.ts"
import type { WorkoutSessionWithDetails, WorkoutTemplate } from "../../types/fitness.ts"

interface WorkoutCompletionSummaryProps {
  session: WorkoutSessionWithDetails
  previousSessions: WorkoutSessionWithDetails[]
  template: WorkoutTemplate | null
  onDone: () => void
}

export function WorkoutCompletionSummary({ session, previousSessions, template, onDone }: WorkoutCompletionSummaryProps) {
  const actualTemplate: WorkoutTemplate = {
    id: "session",
    user_id: session.user_id,
    name: session.title ?? template?.name ?? session.template_name,
    created_at: session.started_at,
    exercises: session.session_exercises.map((exercise) => ({
      id: exercise.id,
      user_id: exercise.user_id,
      template_id: "session",
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name_snapshot,
      position: exercise.position,
      target_sets: exercise.target_sets,
      target_rep_min: exercise.target_rep_min,
      target_rep_max: exercise.target_rep_max,
      progression_step_kg: exercise.progression_step_kg,
      include_in_light: false,
      light_target_sets: null,
      load_type: exercise.load_type,
    })),
  }
  const summaryTemplate = session.session_exercises.length ? actualTemplate : template ?? actualTemplate
  const items = getWorkoutProgressSummary(session, previousSessions, summaryTemplate)
  const completedAt = session.completed_at ? new Date(session.completed_at) : new Date()
  const durationMinutes = Math.max(1, Math.round((completedAt.getTime() - new Date(session.started_at).getTime()) / 60_000))
  const exerciseCount = new Set(session.sets.map((set) => set.exercise_name)).size

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-400/10 p-4 text-emerald-300">
        <span className="grid size-10 place-items-center rounded-full bg-emerald-400/15"><Check /></span>
        <div><p className="font-semibold">{summaryTemplate.name} complete</p><p className="mt-0.5 text-sm text-emerald-300/70">{durationMinutes} min · {exerciseCount} exercises · {session.mode}</p></div>
      </div>

      {session.mode === "light" ? (
        <p className="rounded-2xl border border-slate-800 p-4 text-sm leading-6 text-slate-400">Light session completed. It counts fully for consistency, but it does not change load progression.</p>
      ) : items.length ? (
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300"><TrendingUp className="size-4 text-blue-400" /> Meaningful progress</p>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            {items.map((item, index) => (
              <div key={item.exerciseName} className={`p-4 ${index ? "border-t border-slate-800" : ""}`}>
                <p className="font-medium text-slate-100">{item.exerciseName}</p>
                <p className="mt-1 text-sm text-slate-500">{formatExercisePerformance(item.previous)} → {formatExercisePerformance(item.current)}</p>
                {(item.recommendation.action === "increase" || item.recommendation.action === "consider_reduce") && (
                  <p className="mt-2 text-xs text-blue-300">{item.recommendation.reason} Suggested next: {item.recommendation.suggestedWeightKg}kg.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-slate-800 p-4 text-sm leading-6 text-slate-400">Solid session. Keep building reps at a sustainable pace.</p>
      )}
      <Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" onClick={onDone}>Done</Button>
    </div>
  )
}
