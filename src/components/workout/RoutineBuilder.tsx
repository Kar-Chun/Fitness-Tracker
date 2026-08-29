import { useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, LoaderCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { ExerciseSearch } from "./ExerciseSearch.tsx"
import { loadTypeLabel, routineToInput } from "../../lib/workout-drafts.ts"
import type { CustomExerciseInput, ExerciseLibraryItem, RoutineExerciseInput, RoutineInput, WorkoutSessionWithDetails, WorkoutTemplate } from "../../types/fitness.ts"

interface RoutineBuilderProps {
  routine: WorkoutTemplate | null
  library: ExerciseLibraryItem[]
  sessions: WorkoutSessionWithDetails[]
  onSave: (input: RoutineInput, id?: string) => Promise<void>
  onCreateCustom: (input: CustomExerciseInput) => Promise<ExerciseLibraryItem>
  onCancel: () => void
}

export function RoutineBuilder({ routine, library, sessions, onSave, onCreateCustom, onCancel }: RoutineBuilderProps) {
  const initial = routine ? routineToInput(routine) : { name: "", exercises: [] }
  const [name, setName] = useState(initial.name)
  const [exercises, setExercises] = useState<RoutineExerciseInput[]>(initial.exercises)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function addExercise(selected: ExerciseLibraryItem) {
    const nextIndex = exercises.length
    setExercises((current) => [...current, {
      exerciseId: selected.id,
      exerciseName: selected.name,
      loadType: selected.load_type,
      targetSets: 3,
      targetRepMin: 8,
      targetRepMax: 12,
      includeInLight: current.length < 2,
      lightTargetSets: 2,
      progressionStepKg: selected.progression_step_kg,
    }])
    setExpandedIndex(nextIndex)
    setHighlightedIndex(nextIndex)
    window.setTimeout(() => setHighlightedIndex(null), 1_500)
  }

  function updateExercise(index: number, change: Partial<RoutineExerciseInput>) {
    setExercises((current) => current.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, ...change } : exercise))
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= exercises.length) return
    setExercises((current) => {
      const next = [...current]
      const item = next[index]
      if (!item) return current
      next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
    setExpandedIndex(nextIndex)
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      await onSave({ name, exercises }, routine?.id)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save routine.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <FieldShell label="Routine name" htmlFor="routine-name"><Input id="routine-name" autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Chest + Triceps" /></FieldShell>

      <section className="grid gap-3" aria-labelledby="routine-exercises-title">
        <div><h2 id="routine-exercises-title" className="font-medium text-slate-100">Exercises</h2><p className="mt-1 text-sm text-slate-500">Targets stay inline and can be changed at any time.</p></div>
        <div className="grid gap-2">
          {exercises.map((exercise, index) => {
            const expanded = expandedIndex === index
            return (
              <article key={`${exercise.exerciseId}-${index}`} className={`rounded-2xl border bg-slate-950/55 transition duration-300 ${highlightedIndex === index ? "border-blue-400/60 ring-2 ring-blue-400/15" : "border-slate-800"}`}>
                <div className="flex min-h-16 items-center justify-between gap-3 p-3 sm:p-4">
                  <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => setExpandedIndex(expanded ? null : index)} aria-expanded={expanded}>
                    <p className="truncate font-medium text-slate-100">{exercise.exerciseName}</p>
                    <p className="mt-1 text-xs text-slate-500">{exercise.targetSets} sets · {exercise.targetRepMin}–{exercise.targetRepMax} reps · {loadTypeLabel(exercise.loadType)}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5"><Button type="button" size="icon-sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${exercise.exerciseName} up`}><ArrowUp /></Button><Button type="button" size="icon-sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === exercises.length - 1} aria-label={`Move ${exercise.exerciseName} down`}><ArrowDown /></Button><Button type="button" size="icon-sm" variant="ghost" className="text-red-300" onClick={() => { setExercises((current) => current.filter((_, exerciseIndex) => exerciseIndex !== index)); setExpandedIndex(null) }} aria-label={`Remove ${exercise.exerciseName}`}><Trash2 /></Button><Button type="button" size="icon-sm" variant="ghost" onClick={() => setExpandedIndex(expanded ? null : index)} aria-label={`${expanded ? "Collapse" : "Edit"} ${exercise.exerciseName}`}><ChevronDown className={`transition ${expanded ? "rotate-180" : ""}`} /></Button></div>
                </div>
                {expanded && (
                  <div className="grid gap-4 border-t border-slate-800 p-3 sm:p-4">
                    <div className="grid grid-cols-3 gap-2">
                      <FieldShell label="Sets" htmlFor={`routine-${index}-sets`}><Input id={`routine-${index}-sets`} type="number" min="1" max="20" inputMode="numeric" value={exercise.targetSets} onChange={(event) => updateExercise(index, { targetSets: Number(event.target.value) })} /></FieldShell>
                      <FieldShell label="Min reps" htmlFor={`routine-${index}-min`}><Input id={`routine-${index}-min`} type="number" min="0" inputMode="numeric" value={exercise.targetRepMin} onChange={(event) => updateExercise(index, { targetRepMin: Number(event.target.value) })} /></FieldShell>
                      <FieldShell label="Max reps" htmlFor={`routine-${index}-max`}><Input id={`routine-${index}-max`} type="number" min="0" inputMode="numeric" value={exercise.targetRepMax} onChange={(event) => updateExercise(index, { targetRepMax: Number(event.target.value) })} /></FieldShell>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex min-h-10 items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="size-5 accent-blue-500" checked={exercise.includeInLight} onChange={(event) => updateExercise(index, { includeInLight: event.target.checked })} /> Include in Light</label>
                      {exercise.includeInLight && <label className="flex items-center gap-2 text-xs text-slate-500">Light sets <Input className="w-20" type="number" min="1" max={exercise.targetSets} inputMode="numeric" value={exercise.lightTargetSets ?? Math.min(2, exercise.targetSets)} onChange={(event) => updateExercise(index, { lightTargetSets: Number(event.target.value) })} /></label>}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
          {!exercises.length && <p className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">Add any exercises you want. There is no enforced split or minimum.</p>}
        </div>
      </section>

      <section className="grid gap-3"><div><h2 className="font-medium text-slate-100">Add exercise</h2><p className="mt-1 text-sm text-slate-500">Search the library or create one without leaving this routine.</p></div><ExerciseSearch library={library} sessions={sessions} excludedIds={exercises.map((exercise) => exercise.exerciseId)} onAdd={addExercise} onCreateCustom={onCreateCustom} /></section>
      <InlineError message={error} />
      <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" className="h-11" disabled={saving} onClick={save}>{saving && <LoaderCircle className="animate-spin" />} Save routine</Button><Button size="lg" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  )
}
