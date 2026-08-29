import { useState } from "react"
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Plus, Repeat2, SkipForward, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Select } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { evaluateExerciseProgression } from "../../lib/workout-progression.ts"
import { findPreviousExercisePerformance, loadTypeLabel } from "../../lib/workout-drafts.ts"
import { addWorkoutSessionExercise, deleteExerciseSet, replaceSessionExercise, saveExerciseSet, setSessionExerciseStatus } from "../../services/fitness.ts"
import type { ExerciseLibraryItem, FitnessData, WorkoutSessionExercise, WorkoutSessionWithDetails } from "../../types/fitness.ts"

interface DraftSet {
  id?: string
  weight: string
  reps: string
  completed: boolean
}

function startingSets(exercise: WorkoutSessionExercise, sessions: WorkoutSessionWithDetails[]): DraftSet[] {
  const previous = findPreviousExercisePerformance(sessions, exercise.exercise_id, exercise.exercise_name_snapshot)
  const count = Math.max(exercise.target_sets, exercise.sets.length)
  return Array.from({ length: count }, (_, index) => {
    const saved = exercise.sets.find((set) => set.set_number === index + 1)
    const prior = previous?.sets[index] ?? previous?.sets.at(-1)
    return {
      id: saved?.id,
      weight: String(saved?.weight_kg ?? prior?.weight_kg ?? ""),
      reps: String(saved?.reps ?? prior?.reps ?? exercise.target_rep_min),
      completed: Boolean(saved),
    }
  })
}

interface LiveWorkoutLoggerProps {
  userId: string
  session: WorkoutSessionWithDetails
  data: FitnessData
  dumbbellMaxKg: number | null
  onRefresh: () => Promise<void>
  onFinish: () => Promise<void>
  onDiscard: () => Promise<void>
}

export function LiveWorkoutLogger({ userId, session, data, dumbbellMaxKg, onRefresh, onFinish, onDiscard }: LiveWorkoutLoggerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>(() => Object.fromEntries(
    session.session_exercises.map((exercise) => [exercise.id, startingSets(exercise, data.sessions)]),
  ))
  const [selectedExerciseId, setSelectedExerciseId] = useState(data.exercises[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const exercises = [...session.session_exercises].sort((a, b) => a.position - b.position)
  const exercise = exercises[currentIndex]

  function updateSet(index: number, change: Partial<DraftSet>) {
    if (!exercise) return
    setDrafts((current) => ({
      ...current,
      [exercise.id]: (current[exercise.id] ?? startingSets(exercise, data.sessions)).map((set, setIndex) => setIndex === index ? { ...set, ...change, completed: false } : set),
    }))
  }

  async function completeSet(index: number) {
    if (!exercise) return
    const draft = drafts[exercise.id]?.[index]
    if (!draft) return
    const weightKg = draft.weight.trim() === "" ? null : Number(draft.weight)
    const reps = Number(draft.reps)
    if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 0)) return setError("Weight cannot be negative.")
    if (!Number.isInteger(reps) || reps < 0) return setError("Reps must be a whole number of zero or more.")
    setBusy(true)
    setError("")
    try {
      const saved = await saveExerciseSet(userId, session.id, exercise.exercise_name_snapshot, index + 1, weightKg, reps, exercise.id)
      setDrafts((current) => ({ ...current, [exercise.id]: (current[exercise.id] ?? []).map((set, setIndex) => setIndex === index ? { ...set, id: saved.id, completed: true } : set) }))
      await onRefresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not complete set.")
    } finally {
      setBusy(false)
    }
  }

  function repeatLastSet() {
    if (!exercise) return
    setDrafts((current) => {
      const sets = current[exercise.id] ?? []
      const last = sets.at(-1) ?? { weight: "", reps: String(exercise.target_rep_min), completed: false }
      return { ...current, [exercise.id]: [...sets, { weight: last.weight, reps: last.reps, completed: false }] }
    })
  }

  async function removeSet(index: number) {
    if (!exercise) return
    const draft = drafts[exercise.id]?.[index]
    setBusy(true)
    setError("")
    try {
      if (draft?.id) await deleteExerciseSet(userId, draft.id)
      setDrafts((current) => ({ ...current, [exercise.id]: (current[exercise.id] ?? []).filter((_, setIndex) => setIndex !== index) }))
      if (draft?.id) await onRefresh()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove set.")
    } finally {
      setBusy(false)
    }
  }

  async function skipExercise() {
    if (!exercise) return
    setBusy(true)
    try {
      await setSessionExerciseStatus(userId, exercise.id, "skipped")
      await onRefresh()
      setCurrentIndex((index) => Math.min(index + 1, Math.max(0, exercises.length - 1)))
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : "Could not skip exercise.")
    } finally {
      setBusy(false)
    }
  }

  async function addExercise() {
    const selected = data.exercises.find((item) => item.id === selectedExerciseId)
    if (!selected) return
    setBusy(true)
    try {
      const created = await addWorkoutSessionExercise(userId, session.id, selected, exercises.length)
      setDrafts((current) => ({ ...current, [created.id]: startingSets(created, data.sessions) }))
      await onRefresh()
      setCurrentIndex(exercises.length)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add exercise.")
    } finally {
      setBusy(false)
    }
  }

  async function replaceExercise(replacementId: string) {
    if (!exercise) return
    const replacement = data.exercises.find((item) => item.id === replacementId)
    if (!replacement) return
    setBusy(true)
    try {
      await replaceSessionExercise(userId, exercise.id, replacement)
      setDrafts((current) => ({ ...current, [exercise.id]: startingSets({ ...exercise, exercise_id: replacement.id, exercise_name_snapshot: replacement.name, load_type: replacement.load_type, progression_step_kg: replacement.progression_step_kg, sets: [] }, data.sessions) }))
      await onRefresh()
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : "Could not replace exercise.")
    } finally {
      setBusy(false)
    }
  }

  const progression = exercise ? evaluateExerciseProgression({
    exercise_id: exercise.exercise_id,
    exercise_name: exercise.exercise_name_snapshot,
    target_sets: exercise.target_sets,
    target_rep_min: exercise.target_rep_min,
    target_rep_max: exercise.target_rep_max,
    progression_step_kg: exercise.progression_step_kg,
    load_type: exercise.load_type,
  }, data.sessions.filter((item) => item.id !== session.id), { dumbbellMaxKg }) : null

  return (
    <div className="grid gap-5">
      <header className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-wide text-blue-400">{session.mode} · live</p><h1 className="mt-1 text-3xl font-semibold">{session.title ?? session.template_name}</h1><p className="mt-1 text-sm text-slate-500">Record reality. Skip, replace, or add anything you need.</p></div><Button variant="ghost" size="icon" className="text-red-300" onClick={onDiscard} aria-label="Discard workout"><Trash2 /></Button></header>

      {exercise ? (
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">Exercise {currentIndex + 1} of {exercises.length}</p><h2 className="mt-1 text-xl font-semibold">{exercise.exercise_name_snapshot}</h2><p className="mt-1 text-sm text-slate-500">{loadTypeLabel(exercise.load_type)} · target {exercise.target_rep_min}–{exercise.target_rep_max}</p></div>{exercise.status === "skipped" && <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">Skipped</span>}</div>
          {progression && <p className="mt-3 rounded-xl bg-blue-500/5 p-3 text-xs leading-5 text-blue-200">{progression.reason}</p>}
          <div className="mt-5 grid gap-2">
            {(drafts[exercise.id] ?? startingSets(exercise, data.sessions)).map((set, index) => (
              <div key={index} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-end gap-2 rounded-2xl border p-3 ${set.completed ? "border-emerald-400/25 bg-emerald-400/5" : "border-slate-800 bg-slate-950/60"}`}>
                <span className="pb-3 text-xs font-medium text-slate-500">{index + 1}</span>
                <label className="min-w-0 text-xs text-slate-500"><span className="mb-1 block">{exercise.load_type === "per_dumbbell" ? "kg each" : "Weight"}</span><Input type="number" min="0" step="0.5" inputMode="decimal" disabled={exercise.load_type === "bodyweight" || exercise.load_type === "none"} value={set.weight} onChange={(event) => updateSet(index, { weight: event.target.value })} /></label>
                <label className="min-w-0 text-xs text-slate-500"><span className="mb-1 block">Reps</span><Input type="number" min="0" inputMode="numeric" value={set.reps} onChange={(event) => updateSet(index, { reps: event.target.value })} /></label>
                <Button size="icon-lg" className={`size-11 ${set.completed ? "bg-emerald-500 text-emerald-950" : "bg-blue-500"}`} disabled={busy} onClick={() => completeSet(index)} aria-label={`Complete set ${index + 1}`}>{set.completed ? <Check /> : busy ? <LoaderCircle className="animate-spin" /> : <Check />}</Button>
                <Button size="icon-sm" variant="ghost" className="mb-1 text-slate-600" disabled={busy} onClick={() => removeSet(index)} aria-label={`Remove set ${index + 1}`}><Trash2 /></Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><Button variant="ghost" onClick={repeatLastSet}><Repeat2 /> Repeat last set</Button><Button variant="ghost" onClick={() => setDrafts((current) => ({ ...current, [exercise.id]: [...(current[exercise.id] ?? []), { weight: "", reps: String(exercise.target_rep_min), completed: false }] }))}><Plus /> Add set</Button></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={skipExercise} disabled={busy || (drafts[exercise.id] ?? []).some((set) => set.completed)}><SkipForward /> Skip</Button><Select value={exercise.exercise_id ?? ""} onChange={(event) => replaceExercise(event.target.value)} disabled={(drafts[exercise.id] ?? []).some((set) => set.completed)} aria-label="Replace exercise"><option value="" disabled>Replace exercise</option>{data.exercises.filter((item) => item.id !== exercise.exercise_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
        </section>
      ) : <p className="rounded-3xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">This is an empty Quick Workout. Add your first exercise below.</p>}

      <InlineError message={error} />
      <div className="grid grid-cols-[auto_1fr_auto] gap-2"><Button variant="outline" size="icon-lg" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}><ChevronLeft /></Button><Button className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={onFinish}>Finish workout</Button><Button variant="outline" size="icon-lg" disabled={currentIndex >= exercises.length - 1} onClick={() => setCurrentIndex((index) => index + 1)}><ChevronRight /></Button></div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Select value={selectedExerciseId} onChange={(event) => setSelectedExerciseId(event.target.value)} aria-label="Add exercise to workout">{data.exercises.map((item: ExerciseLibraryItem) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Button size="icon-lg" className="size-11" disabled={busy || !selectedExerciseId} onClick={addExercise}><Plus /></Button></div>
    </div>
  )
}
