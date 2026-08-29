import { useState } from "react"
import { Copy, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { Surface } from "../shared/Visual.tsx"
import { ExerciseSearch } from "./ExerciseSearch.tsx"
import { loadTypeLabel } from "../../lib/workout-drafts.ts"
import { createBlankSetDrafts, getFirstSetError, getSetDraftState, getValidSetValues, type EditableSetDraft } from "../../lib/workout-logger.ts"
import type { CustomExerciseInput, ExerciseLibraryItem, ExerciseLoadType, FinishedWorkoutInput, FitnessData, WorkoutSessionWithDetails, WorkoutTemplate } from "../../types/fitness.ts"

interface EditableFinishedExercise {
  exerciseId: string | null
  exerciseName: string
  loadType: ExerciseLoadType
  targetSets: number
  targetRepMin: number
  targetRepMax: number
  progressionStepKg: number | null
  sets: EditableSetDraft[]
}

interface FinishedWorkoutLoggerProps {
  data: FitnessData
  routine: WorkoutTemplate | null
  recentSession: WorkoutSessionWithDetails | null
  onCreateCustom: (input: CustomExerciseInput) => Promise<ExerciseLibraryItem>
  onSave: (input: FinishedWorkoutInput) => Promise<void>
  onCancel: () => void
}

function fromRoutine(routine: WorkoutTemplate | null): EditableFinishedExercise[] {
  if (!routine) return []
  return [...routine.exercises].sort((a, b) => a.position - b.position).map((exercise) => ({
    exerciseId: exercise.exercise_id,
    exerciseName: exercise.exercise_name,
    loadType: exercise.load_type,
    targetSets: exercise.target_sets,
    targetRepMin: exercise.target_rep_min,
    targetRepMax: exercise.target_rep_max,
    progressionStepKg: exercise.progression_step_kg,
    sets: createBlankSetDrafts(exercise.target_sets),
  }))
}

function fromSession(session: WorkoutSessionWithDetails | null): EditableFinishedExercise[] {
  if (!session) return []
  return session.session_exercises.filter((exercise) => exercise.status !== "skipped").sort((a, b) => a.position - b.position).map((exercise) => ({
    exerciseId: exercise.exercise_id,
    exerciseName: exercise.exercise_name_snapshot,
    loadType: exercise.load_type,
    targetSets: exercise.target_sets,
    targetRepMin: exercise.target_rep_min,
    targetRepMax: exercise.target_rep_max,
    progressionStepKg: exercise.progression_step_kg,
    sets: exercise.sets.map((set) => ({ weight: set.weight_kg === null ? "" : String(set.weight_kg), reps: String(set.reps) })),
  }))
}

export function FinishedWorkoutLogger({ data, routine, recentSession, onCreateCustom, onSave, onCancel }: FinishedWorkoutLoggerProps) {
  const [title, setTitle] = useState(recentSession?.title ?? recentSession?.template_name ?? routine?.name ?? "Workout")
  const [draft, setDraft] = useState<EditableFinishedExercise[]>(() => recentSession ? fromSession(recentSession) : fromRoutine(routine))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const matchingLast = routine ? data.sessions.find((session) => session.completed_at && session.template_id === routine.id) ?? null : null

  function updateSet(exerciseIndex: number, setIndex: number, currentSet: EditableSetDraft, change: Partial<EditableSetDraft>) {
    setDraft((current) => current.map((exercise, index) => index === exerciseIndex ? {
      ...exercise,
      sets: exercise.sets.map((set, indexOfSet) => indexOfSet === setIndex ? { ...currentSet, ...change } : set),
    } : exercise))
    setError("")
  }

  function addExercise(exercise: ExerciseLibraryItem) {
    const nextIndex = draft.length
    setDraft((current) => [...current, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      loadType: exercise.load_type,
      targetSets: 3,
      targetRepMin: 8,
      targetRepMax: 12,
      progressionStepKg: exercise.progression_step_kg,
      sets: createBlankSetDrafts(3),
    }])
    setHighlightedIndex(nextIndex)
    window.setTimeout(() => setHighlightedIndex(null), 1_500)
  }

  async function save() {
    const validationError = getFirstSetError(draft.map((exercise) => ({ exerciseName: exercise.exerciseName, loadType: exercise.loadType, sets: exercise.sets })))
    if (validationError) return setError(validationError)
    const performed = draft.flatMap((exercise) => {
      const sets = exercise.sets.map((set) => getValidSetValues(set, exercise.loadType)).filter((values) => values !== null)
      if (!sets.length) return []
      return [{
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        loadType: exercise.loadType,
        targetSets: Math.max(1, exercise.targetSets),
        targetRepMin: exercise.targetRepMin,
        targetRepMax: exercise.targetRepMax,
        progressionStepKg: exercise.progressionStepKg,
        skipped: false,
        sets: sets.map((set) => ({ weightKg: set.weightKg, reps: set.reps, completed: true })),
      }]
    })
    if (!performed.length) return setError("Enter at least one performed set before saving.")
    setSaving(true)
    setError("")
    try {
      await onSave({ title, templateId: routine?.id ?? recentSession?.template_id ?? null, mode: "normal", exercises: performed })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save workout.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <FieldShell label="Workout name" htmlFor="finished-workout-name"><Input id="finished-workout-name" value={title} onChange={(event) => setTitle(event.target.value)} /></FieldShell>
      {matchingLast && matchingLast.id !== recentSession?.id && <Button variant="outline" className="w-fit" onClick={() => setDraft(fromSession(matchingLast))}><Copy /> Copy Last Workout</Button>}

      <div className="grid gap-4">
        {draft.map((exercise, exerciseIndex) => (
          <Surface key={`${exercise.exerciseId}-${exerciseIndex}`} as="article" className={`p-4 transition duration-300 ${highlightedIndex === exerciseIndex ? "border-blue-400/60 ring-2 ring-blue-400/15" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-slate-100">{exercise.exerciseName}</h3><p className="mt-1 text-xs text-slate-500">{loadTypeLabel(exercise.loadType)}</p></div><Button size="icon-sm" variant="ghost" className="text-slate-600 hover:text-red-300" onClick={() => setDraft((current) => current.filter((_, index) => index !== exerciseIndex))} aria-label={`Remove ${exercise.exerciseName}`}><Trash2 /></Button></div>
            <div className="mt-4 grid gap-2">
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1 text-[0.62rem] font-semibold uppercase tracking-wider text-slate-600"><span>Set</span><span>{exercise.loadType === "per_dumbbell" ? "Kg each" : exercise.loadType === "total" ? "Kg total" : "Load"}</span><span>Reps</span><span /></div>
              {exercise.sets.map((set, setIndex) => {
                const state = getSetDraftState(set, exercise.loadType)
                const invalid = state === "partial" || state === "invalid"
                return <div key={setIndex} className={`grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-xl border px-1.5 py-1.5 ${invalid ? "border-red-400/45 bg-red-500/5" : state === "valid" ? "border-blue-400/20 bg-blue-500/5" : "border-slate-800 bg-slate-950/40"}`}><span className="text-center text-sm font-semibold text-slate-500">{setIndex + 1}</span>{exercise.loadType === "bodyweight" || exercise.loadType === "none" ? <span className="px-2 text-sm text-slate-500">{exercise.loadType === "bodyweight" ? "Bodyweight" : "No load"}</span> : <Input aria-label={`${exercise.exerciseName} set ${setIndex + 1} weight`} className="h-11 min-w-0 text-center text-lg font-semibold tabular-nums" type="number" min="0" step="0.5" inputMode="decimal" value={set.weight} onChange={(event) => updateSet(exerciseIndex, setIndex, set, { weight: event.target.value })} />}<Input aria-label={`${exercise.exerciseName} set ${setIndex + 1} reps`} className="h-11 min-w-0 text-center text-lg font-semibold tabular-nums" type="number" min="0" inputMode="numeric" value={set.reps} onChange={(event) => updateSet(exerciseIndex, setIndex, set, { reps: event.target.value })} /><Button size="icon-sm" variant="ghost" className="text-slate-600 hover:text-red-300" onClick={() => setDraft((current) => current.map((item, index) => index === exerciseIndex ? { ...item, sets: item.sets.filter((_, currentSetIndex) => currentSetIndex !== setIndex) } : item))} aria-label={`Delete set ${setIndex + 1}`}><Trash2 /></Button></div>
              })}
              <Button variant="ghost" className="w-fit text-blue-300" onClick={() => setDraft((current) => current.map((item, index) => index === exerciseIndex ? { ...item, sets: [...item.sets, { weight: "", reps: "" }] } : item))}><Plus /> Add set</Button>
            </div>
          </Surface>
        ))}
      </div>

      <section className="grid gap-3"><div><h2 className="font-medium text-slate-100">Add exercise</h2><p className="mt-1 text-sm text-slate-500">Add anything else you performed.</p></div><ExerciseSearch library={data.exercises} sessions={data.sessions} excludedIds={draft.map((exercise) => exercise.exerciseId).filter((id): id is string => Boolean(id))} onAdd={addExercise} onCreateCustom={onCreateCustom} /></section>
      <InlineError message={error} />
      <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" className="h-11" disabled={saving} onClick={save}>{saving && <LoaderCircle className="animate-spin" />} Save Workout</Button><Button size="lg" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  )
}
