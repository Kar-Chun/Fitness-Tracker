import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input, Select } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { loadTypeLabel, routineToInput } from "../../lib/workout-drafts.ts"
import type { CustomExerciseInput, ExerciseCategory, ExerciseLibraryItem, ExerciseLoadType, RoutineExerciseInput, RoutineInput, WorkoutTemplate } from "../../types/fitness.ts"

interface RoutineBuilderProps {
  routine: WorkoutTemplate | null
  library: ExerciseLibraryItem[]
  onSave: (input: RoutineInput, id?: string) => Promise<void>
  onCreateCustom: (input: CustomExerciseInput) => Promise<void>
  onCancel: () => void
}

export function RoutineBuilder({ routine, library, onSave, onCreateCustom, onCancel }: RoutineBuilderProps) {
  const initial = routine ? routineToInput(routine) : { name: "", exercises: [] }
  const [name, setName] = useState(initial.name)
  const [exercises, setExercises] = useState<RoutineExerciseInput[]>(initial.exercises)
  const [selectedId, setSelectedId] = useState(library[0]?.id ?? "")
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customCategory, setCustomCategory] = useState<ExerciseCategory>("other")
  const [customLoad, setCustomLoad] = useState<ExerciseLoadType>("per_dumbbell")
  const [customStep, setCustomStep] = useState("2.5")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const selected = useMemo(() => library.find((exercise) => exercise.id === selectedId), [library, selectedId])

  function addExercise() {
    if (!selected) return
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
  }

  async function createCustom() {
    const step = customStep.trim() === "" ? null : Number(customStep)
    if (!customName.trim()) return setError("Custom exercise name is required.")
    if (step !== null && (!Number.isFinite(step) || step < 0)) return setError("Check the progression step.")
    setSaving(true)
    setError("")
    try {
      await onCreateCustom({ name: customName, category: customCategory, loadType: customLoad, progressionStepKg: step })
      setCustomName("")
      setShowCustom(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create exercise.")
    } finally {
      setSaving(false)
    }
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
    <div className="grid gap-5">
      <FieldShell label="Routine name" htmlFor="routine-name"><Input id="routine-name" autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Chest + Triceps" /></FieldShell>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-200">Add exercise</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-label="Exercise library">
            {library.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name} · {loadTypeLabel(exercise.load_type)}</option>)}
          </Select>
          <Button size="icon-lg" className="size-11" onClick={addExercise} aria-label="Add exercise"><Plus /></Button>
        </div>
        <Button variant="ghost" className="mt-2 px-0 text-blue-300" onClick={() => setShowCustom((value) => !value)}>+ Create custom exercise</Button>
      </div>

      {showCustom && (
        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <FieldShell label="Exercise name" htmlFor="custom-exercise-name"><Input id="custom-exercise-name" value={customName} onChange={(event) => setCustomName(event.target.value)} /></FieldShell>
          <div className="grid grid-cols-2 gap-2">
            <FieldShell label="Category" htmlFor="custom-category"><Select id="custom-category" value={customCategory} onChange={(event) => setCustomCategory(event.target.value as ExerciseCategory)}>{["chest", "back", "shoulders", "arms", "legs", "core", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</Select></FieldShell>
            <FieldShell label="Load type" htmlFor="custom-load"><Select id="custom-load" value={customLoad} onChange={(event) => setCustomLoad(event.target.value as ExerciseLoadType)}><option value="per_dumbbell">Per dumbbell</option><option value="total">Total load</option><option value="bodyweight">Bodyweight</option><option value="none">No load</option></Select></FieldShell>
          </div>
          <FieldShell label="Progression step" hint="kg, optional" htmlFor="custom-step"><Input id="custom-step" type="number" min="0" step="0.5" inputMode="decimal" value={customStep} onChange={(event) => setCustomStep(event.target.value)} /></FieldShell>
          <Button variant="outline" onClick={createCustom} disabled={saving}>Create exercise</Button>
        </div>
      )}

      <div className="grid gap-3">
        {exercises.map((exercise, index) => (
          <section key={`${exercise.exerciseId}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-medium text-slate-100">{exercise.exerciseName}</h3><p className="mt-1 text-xs text-slate-500">{loadTypeLabel(exercise.loadType)}</p></div>
              <div className="flex gap-1"><Button size="icon-sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move exercise up"><ArrowUp /></Button><Button size="icon-sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === exercises.length - 1} aria-label="Move exercise down"><ArrowDown /></Button><Button size="icon-sm" variant="ghost" className="text-red-300" onClick={() => setExercises((current) => current.filter((_, exerciseIndex) => exerciseIndex !== index))} aria-label="Remove exercise"><Trash2 /></Button></div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <FieldShell label="Sets" htmlFor={`routine-${index}-sets`}><Input id={`routine-${index}-sets`} type="number" min="1" max="20" inputMode="numeric" value={exercise.targetSets} onChange={(event) => updateExercise(index, { targetSets: Number(event.target.value) })} /></FieldShell>
              <FieldShell label="Min reps" htmlFor={`routine-${index}-min`}><Input id={`routine-${index}-min`} type="number" min="0" inputMode="numeric" value={exercise.targetRepMin} onChange={(event) => updateExercise(index, { targetRepMin: Number(event.target.value) })} /></FieldShell>
              <FieldShell label="Max reps" htmlFor={`routine-${index}-max`}><Input id={`routine-${index}-max`} type="number" min="0" inputMode="numeric" value={exercise.targetRepMax} onChange={(event) => updateExercise(index, { targetRepMax: Number(event.target.value) })} /></FieldShell>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex min-h-10 items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="size-5 accent-blue-500" checked={exercise.includeInLight} onChange={(event) => updateExercise(index, { includeInLight: event.target.checked })} /> Include in Light</label>
              {exercise.includeInLight && <label className="flex items-center gap-2 text-xs text-slate-500">Light sets <Input className="w-20" type="number" min="1" max={exercise.targetSets} inputMode="numeric" value={exercise.lightTargetSets ?? Math.min(2, exercise.targetSets)} onChange={(event) => updateExercise(index, { lightTargetSets: Number(event.target.value) })} /></label>}
            </div>
          </section>
        ))}
        {!exercises.length && <p className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">Add any exercises you want. The app does not enforce a split or minimum.</p>}
      </div>
      <InlineError message={error} />
      <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" className="h-11" disabled={saving} onClick={save}>{saving && <LoaderCircle className="animate-spin" />} Save routine</Button><Button size="lg" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </div>
  )
}
