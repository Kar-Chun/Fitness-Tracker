import { useState } from "react"
import { LoaderCircle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { copySessionToDraft, createRoutineWorkoutDraft, loadTypeLabel } from "../../lib/workout-drafts.ts"
import type { FinishedWorkoutInput, FitnessData, WorkoutDraftExerciseInput, WorkoutSessionWithDetails, WorkoutTemplate } from "../../types/fitness.ts"

interface FinishedWorkoutLoggerProps {
  data: FitnessData
  routine: WorkoutTemplate | null
  recentSession: WorkoutSessionWithDetails | null
  onSave: (input: FinishedWorkoutInput) => Promise<void>
  onCancel: () => void
}

function draftFromSources(data: FitnessData, routine: WorkoutTemplate | null, recent: WorkoutSessionWithDetails | null) {
  if (recent) return copySessionToDraft(recent)
  if (routine) return createRoutineWorkoutDraft(routine, data.sessions, "normal").map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => ({ ...set, completed: true })) }))
  return []
}

export function FinishedWorkoutLogger({ data, routine, recentSession, onSave, onCancel }: FinishedWorkoutLoggerProps) {
  const [title, setTitle] = useState(recentSession?.title ?? recentSession?.template_name ?? routine?.name ?? "Workout")
  const [draft, setDraft] = useState<WorkoutDraftExerciseInput[]>(() => draftFromSources(data, routine, recentSession))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const matchingLast = routine ? data.sessions.find((session) => session.completed_at && session.template_id === routine.id) ?? null : null

  function updateExercise(index: number, change: Partial<WorkoutDraftExerciseInput>) {
    setDraft((current) => current.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, ...change } : exercise))
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: "weightKg" | "reps", value: number | null) {
    setDraft((current) => current.map((exercise, index) => index === exerciseIndex ? {
      ...exercise,
      sets: exercise.sets.map((set, indexOfSet) => indexOfSet === setIndex ? { ...set, [field]: value, completed: true } : set),
    } : exercise))
  }

  async function save() {
    if (!draft.some((exercise) => !exercise.skipped && exercise.sets.length)) return setError("Add at least one performed exercise.")
    setSaving(true)
    setError("")
    try {
      await onSave({ title, templateId: routine?.id ?? recentSession?.template_id ?? null, mode: "normal", exercises: draft })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save workout.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5">
      <FieldShell label="Workout name" htmlFor="finished-workout-name"><Input id="finished-workout-name" value={title} onChange={(event) => setTitle(event.target.value)} /></FieldShell>
      {matchingLast && matchingLast.id !== recentSession?.id && <Button variant="outline" onClick={() => setDraft(copySessionToDraft(matchingLast))}>Copy last {routine?.name}</Button>}
      <div className="grid gap-3">
        {draft.map((exercise, exerciseIndex) => (
          <section key={`${exercise.exerciseId}-${exerciseIndex}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{exercise.exerciseName}</h3><p className="mt-1 text-xs text-slate-500">{loadTypeLabel(exercise.loadType)}</p></div><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" className="size-5 accent-blue-500" checked={exercise.skipped} onChange={(event) => updateExercise(exerciseIndex, { skipped: event.target.checked })} /> Skipped</label></div>
            {!exercise.skipped && <div className="mt-4 grid gap-2">{exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2"><span className="pb-3 text-xs text-slate-600">{setIndex + 1}</span><label className="text-xs text-slate-500"><span className="mb-1 block">{exercise.loadType === "per_dumbbell" ? "kg each" : "Weight"}</span><Input type="number" min="0" step="0.5" inputMode="decimal" disabled={exercise.loadType === "bodyweight" || exercise.loadType === "none"} value={set.weightKg ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, "weightKg", event.target.value === "" ? null : Number(event.target.value))} /></label><label className="text-xs text-slate-500"><span className="mb-1 block">Reps</span><Input type="number" min="0" inputMode="numeric" value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, "reps", Number(event.target.value))} /></label><Button size="icon-sm" variant="ghost" className="mb-1 text-red-300" onClick={() => updateExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}><Trash2 /></Button></div>
            ))}<Button variant="ghost" onClick={() => updateExercise(exerciseIndex, { sets: [...exercise.sets, { weightKg: exercise.sets.at(-1)?.weightKg ?? null, reps: exercise.sets.at(-1)?.reps ?? exercise.targetRepMin, completed: true }] })}><Plus /> Add set</Button></div>}
          </section>
        ))}
      </div>
      <InlineError message={error} />
      <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" className="h-11" disabled={saving} onClick={save}>{saving && <LoaderCircle className="animate-spin" />} Save workout</Button><Button size="lg" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  )
}
