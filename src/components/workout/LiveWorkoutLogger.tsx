import { useEffect, useRef, useState } from "react"
import { Clock3, Copy, Ellipsis, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { PageHeader, Surface } from "../shared/Visual.tsx"
import { ExerciseSearch } from "./ExerciseSearch.tsx"
import { evaluateExerciseProgression } from "../../lib/workout-progression.ts"
import { KeyedMutationQueue } from "../../lib/keyed-mutation-queue.ts"
import { findPreviousExercisePerformance, loadTypeLabel } from "../../lib/workout-drafts.ts"
import { copyLastSets, createBlankSetDrafts, getFirstSetError, getSetDraftState, getValidSetValues, type EditableSetDraft } from "../../lib/workout-logger.ts"
import { addWorkoutSessionExercise, deleteExerciseSet, deleteExerciseSetsForSessionExercise, deleteWorkoutSessionExercise, saveExerciseSet, setSessionExerciseStatus } from "../../services/workout.ts"
import type { CustomExerciseInput, ExerciseLibraryItem, ExerciseSet, FitnessData, WorkoutSessionExercise, WorkoutSessionWithDetails } from "../../types/fitness.ts"

function startingSets(exercise: WorkoutSessionExercise) {
  return createBlankSetDrafts(exercise.target_sets, exercise.sets)
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

interface LiveWorkoutLoggerProps {
  userId: string
  session: WorkoutSessionWithDetails
  data: FitnessData
  dumbbellMaxKg: number | null
  onCreateCustom: (input: CustomExerciseInput) => Promise<ExerciseLibraryItem>
  onFinish: (completedSession: WorkoutSessionWithDetails) => Promise<void>
  onDiscard: () => Promise<void>
}

export function LiveWorkoutLogger({ userId, session, data, dumbbellMaxKg, onCreateCustom, onFinish, onDiscard }: LiveWorkoutLoggerProps) {
  const [exercises, setExercises] = useState(() => [...session.session_exercises].sort((a, b) => a.position - b.position))
  const [drafts, setDrafts] = useState<Record<string, EditableSetDraft[]>>(() => Object.fromEntries(
    session.session_exercises.map((exercise) => [exercise.id, startingSets(exercise)]),
  ))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [elapsed, setElapsed] = useState(0)
  const [highlightedId, setHighlightedId] = useState("")
  const saveTimers = useRef<Record<string, number>>({})
  const saveVersions = useRef<Record<string, number>>({})
  const saveQueue = useRef(new KeyedMutationQueue())
  const draftsRef = useRef(drafts)
  const exerciseRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => { draftsRef.current = drafts }, [drafts])
  useEffect(() => {
    function updateElapsed() {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)))
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1_000)
    return () => window.clearInterval(timer)
  }, [session.started_at])
  useEffect(() => () => Object.values(saveTimers.current).forEach((timer) => window.clearTimeout(timer)), [])

  async function persistSet(exercise: WorkoutSessionExercise, index: number, draft: EditableSetDraft, version: number) {
    const key = `${exercise.id}:${index}`
    if (saveVersions.current[key] !== version) return
    const state = getSetDraftState(draft, exercise.load_type)
    try {
      if (state === "valid") {
        const values = getValidSetValues(draft, exercise.load_type)
        if (!values) return
        const saved = await saveExerciseSet(userId, session.id, exercise.exercise_name_snapshot, index + 1, values.weightKg, values.reps, exercise.id)
        if (saveVersions.current[key] === version) {
          setDrafts((current) => ({ ...current, [exercise.id]: (current[exercise.id] ?? []).map((set, setIndex) => setIndex === index ? { ...set, id: saved.id } : set) }))
        } else {
          const latest = draftsRef.current[exercise.id]?.[index]
          if (!latest || getSetDraftState(latest, exercise.load_type) !== "valid") await deleteExerciseSet(userId, saved.id)
        }
      } else if (state === "blank" && draft.id) {
        await deleteExerciseSet(userId, draft.id)
        setDrafts((current) => ({ ...current, [exercise.id]: (current[exercise.id] ?? []).map((set, setIndex) => setIndex === index ? { weight: set.weight, reps: set.reps } : set) }))
      }
      if (saveVersions.current[key] === version) setSaveState("saved")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not autosave this set.")
      setSaveState("idle")
    }
  }

  function queueSave(exercise: WorkoutSessionExercise, index: number, draft: EditableSetDraft) {
    const key = `${exercise.id}:${index}`
    const version = (saveVersions.current[key] ?? 0) + 1
    saveVersions.current[key] = version
    window.clearTimeout(saveTimers.current[key])
    const state = getSetDraftState(draft, exercise.load_type)
    if (state === "partial" || state === "invalid" || (state === "blank" && !draft.id)) {
      setSaveState("idle")
      return
    }
    setSaveState("saving")
    saveTimers.current[key] = window.setTimeout(() => {
      void saveQueue.current.enqueue(key, () => persistSet(exercise, index, draft, version))
    }, 700)
  }

  function updateSet(exercise: WorkoutSessionExercise, index: number, currentSet: EditableSetDraft, change: Partial<EditableSetDraft>) {
    const next = { ...currentSet, ...change }
    const currentDrafts = draftsRef.current
    const nextDrafts = {
      ...currentDrafts,
      [exercise.id]: (currentDrafts[exercise.id] ?? startingSets(exercise)).map((set, setIndex) => setIndex === index ? next : set),
    }
    draftsRef.current = nextDrafts
    setDrafts(nextDrafts)
    setError("")
    queueSave(exercise, index, next)
  }

  function addSet(exercise: WorkoutSessionExercise) {
    const current = drafts[exercise.id] ?? []
    setDrafts((allDrafts) => ({
      ...allDrafts,
      [exercise.id]: [...current, { weight: "", reps: "" }],
    }))
  }

  async function removeSet(exercise: WorkoutSessionExercise, index: number) {
    setBusy(true)
    setError("")
    try {
      const keys = (drafts[exercise.id] ?? []).map((_, setIndex) => `${exercise.id}:${setIndex}`)
      keys.forEach((key) => {
        window.clearTimeout(saveTimers.current[key])
        saveVersions.current[key] = (saveVersions.current[key] ?? 0) + 1
      })
      await saveQueue.current.waitFor(keys)
      const remaining = (drafts[exercise.id] ?? []).filter((_, setIndex) => setIndex !== index)
      await deleteExerciseSetsForSessionExercise(userId, exercise.id)
      const savedByIndex = new Map<number, ExerciseSet>()
      for (const [setIndex, set] of remaining.entries()) {
        const values = getValidSetValues(set, exercise.load_type)
        if (values) savedByIndex.set(setIndex, await saveExerciseSet(userId, session.id, exercise.exercise_name_snapshot, setIndex + 1, values.weightKg, values.reps, exercise.id))
      }
      setDrafts((current) => ({
        ...current,
        [exercise.id]: remaining.map((set, setIndex) => ({ ...set, id: savedByIndex.get(setIndex)?.id })),
      }))
      setSaveState("saved")
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove set.")
    } finally {
      setBusy(false)
    }
  }

  function copyPrevious(exercise: WorkoutSessionExercise) {
    const previous = findPreviousExercisePerformance(data.sessions.filter((item) => item.id !== session.id), exercise.exercise_id, exercise.exercise_name_snapshot)
    const copied = copyLastSets(previous, exercise.target_sets)
    setDrafts((current) => ({ ...current, [exercise.id]: copied }))
    copied.forEach((set, index) => queueSave(exercise, index, set))
  }

  async function addExercise(exercise: ExerciseLibraryItem) {
    setBusy(true)
    setError("")
    try {
      const created = await addWorkoutSessionExercise(userId, session.id, exercise, exercises.length)
      setExercises((current) => [...current, created])
      setDrafts((current) => ({ ...current, [created.id]: startingSets(created) }))
      setHighlightedId(created.id)
      window.setTimeout(() => setHighlightedId(""), 1_500)
      window.setTimeout(() => exerciseRefs.current[created.id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
    } finally {
      setBusy(false)
    }
  }

  async function removeExercise(exercise: WorkoutSessionExercise) {
    if (!window.confirm(`Remove ${exercise.exercise_name_snapshot} from this workout?`)) return
    setBusy(true)
    setError("")
    try {
      const keys = (drafts[exercise.id] ?? []).map((_, setIndex) => `${exercise.id}:${setIndex}`)
      keys.forEach((key) => {
        window.clearTimeout(saveTimers.current[key])
        saveVersions.current[key] = (saveVersions.current[key] ?? 0) + 1
      })
      await saveQueue.current.waitFor(keys)
      await deleteWorkoutSessionExercise(userId, exercise.id)
      setExercises((current) => current.filter((item) => item.id !== exercise.id))
      setDrafts((current) => { const next = { ...current }; delete next[exercise.id]; return next })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove exercise.")
    } finally {
      setBusy(false)
    }
  }

  async function finishWorkout() {
    const latestDrafts = draftsRef.current
    const validationError = getFirstSetError(exercises.map((exercise) => ({
      exerciseName: exercise.exercise_name_snapshot,
      loadType: exercise.load_type,
      sets: latestDrafts[exercise.id] ?? [],
    })))
    if (validationError) return setError(validationError)
    const performed = exercises.filter((exercise) => (latestDrafts[exercise.id] ?? []).some((set) => getSetDraftState(set, exercise.load_type) === "valid"))
    if (!performed.length) return setError("Enter at least one performed set before finishing.")

    setBusy(true)
    setSaveState("saving")
    setError("")
    try {
      Object.entries(saveTimers.current).forEach(([key, timer]) => {
        window.clearTimeout(timer)
        saveVersions.current[key] = (saveVersions.current[key] ?? 0) + 1
      })
      await saveQueue.current.waitFor()
      const normalizedExercises: WorkoutSessionExercise[] = []
      for (const exercise of exercises) {
        await deleteExerciseSetsForSessionExercise(userId, exercise.id)
        const validSets = (latestDrafts[exercise.id] ?? []).map((set) => getValidSetValues(set, exercise.load_type)).filter((values) => values !== null)
        const savedSets: ExerciseSet[] = []
        for (const [savedIndex, values] of validSets.entries()) {
          savedSets.push(await saveExerciseSet(userId, session.id, exercise.exercise_name_snapshot, savedIndex + 1, values.weightKg, values.reps, exercise.id))
        }
        const status = validSets.length ? "completed" : "skipped"
        await setSessionExerciseStatus(userId, exercise.id, status)
        normalizedExercises.push({ ...exercise, status, sets: savedSets })
      }
      setSaveState("saved")
      await onFinish({ ...session, completed_at: new Date().toISOString(), session_exercises: normalizedExercises, sets: normalizedExercises.flatMap((exercise) => exercise.sets) })
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Could not finish workout.")
      setSaveState("idle")
    } finally {
      setBusy(false)
    }
  }

  async function discardWorkout() {
    setBusy(true)
    setError("")
    try {
      Object.entries(saveTimers.current).forEach(([key, timer]) => {
        window.clearTimeout(timer)
        saveVersions.current[key] = (saveVersions.current[key] ?? 0) + 1
      })
      await saveQueue.current.waitFor()
      await onDiscard()
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : "Could not discard the workout.")
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 pb-24 md:pb-8">
      <PageHeader eyebrow={`${session.mode} · live`} title={session.title ?? session.template_name} description="Every exercise is here. Enter what you perform and leave untouched rows blank." action={<div className="flex items-center gap-2 text-sm tabular-nums text-slate-400"><Clock3 className="size-4 text-blue-400" />{formatElapsed(elapsed)}</div>} />

      <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{exercises.length} exercise{exercises.length === 1 ? "" : "s"}</span><span aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Changes save automatically"}</span></div>

      {exercises.map((exercise) => {
        const exerciseDrafts = drafts[exercise.id] ?? startingSets(exercise)
        const previous = findPreviousExercisePerformance(data.sessions.filter((item) => item.id !== session.id), exercise.exercise_id, exercise.exercise_name_snapshot)
        const previousWeight = previous?.sets.find((set) => set.weight_kg !== null)?.weight_kg ?? null
        const progression = evaluateExerciseProgression({ exercise_id: exercise.exercise_id, exercise_name: exercise.exercise_name_snapshot, target_sets: exercise.target_sets, target_rep_min: exercise.target_rep_min, target_rep_max: exercise.target_rep_max, progression_step_kg: exercise.progression_step_kg, load_type: exercise.load_type }, data.sessions.filter((item) => item.id !== session.id), { dumbbellMaxKg })

        return (
          <Surface key={exercise.id} as="article" className={`scroll-mt-6 p-4 transition duration-300 sm:p-5 ${highlightedId === exercise.id ? "border-blue-400/60 ring-2 ring-blue-400/15" : ""}`}>
            <div ref={(node) => { exerciseRefs.current[exercise.id] = node }} className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-blue-400">Exercise</p><h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-50">{exercise.exercise_name_snapshot}</h2></div>
              <details className="relative shrink-0"><summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl text-slate-500 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label={`Actions for ${exercise.exercise_name_snapshot}`}><Ellipsis /></summary><div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl"><button type="button" className="min-h-10 w-full rounded-lg px-3 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={() => removeExercise(exercise)}>Remove from this workout</button></div></details>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-950/55 px-3 py-2.5"><p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-600">Last</p><p className="mt-1 text-sm text-slate-300">{previous ? `${previousWeight !== null ? `${previousWeight} ${loadTypeLabel(exercise.load_type)} · ` : ""}${previous.sets.map((set) => set.reps).join(" / ")}` : "No previous performance"}</p></div>
              <div className="rounded-xl bg-slate-950/55 px-3 py-2.5"><p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-600">Target</p><p className="mt-1 text-sm text-slate-300">{exercise.target_sets} × {exercise.target_rep_min}–{exercise.target_rep_max} reps</p></div>
            </div>
            {progression && <p className="mt-2 text-xs leading-5 text-blue-200/80">{progression.reason}</p>}
            <div className="mt-5 grid gap-2">
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1 text-[0.62rem] font-semibold uppercase tracking-wider text-slate-600"><span>Set</span><span>{exercise.load_type === "per_dumbbell" ? "Kg each" : exercise.load_type === "total" ? "Kg total" : "Load"}</span><span>Reps</span><span /></div>
              {exerciseDrafts.map((set, index) => {
                const state = getSetDraftState(set, exercise.load_type)
                const invalid = state === "partial" || state === "invalid"
                return (
                  <div key={index} className={`grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-xl border px-1.5 py-1.5 ${invalid ? "border-red-400/45 bg-red-500/5" : state === "valid" ? "border-blue-400/20 bg-blue-500/5" : "border-slate-800 bg-slate-950/40"}`}>
                    <span className="text-center text-sm font-semibold tabular-nums text-slate-500">{index + 1}</span>
                    {exercise.load_type === "bodyweight" || exercise.load_type === "none" ? <span className="px-2 text-sm text-slate-500">{exercise.load_type === "bodyweight" ? "Bodyweight" : "No load"}</span> : <Input aria-label={`${exercise.exercise_name_snapshot} set ${index + 1} weight`} className="h-11 min-w-0 text-center text-lg font-semibold tabular-nums" type="number" min="0" step="0.5" inputMode="decimal" value={set.weight} onChange={(event) => updateSet(exercise, index, set, { weight: event.target.value })} />}
                    <Input aria-label={`${exercise.exercise_name_snapshot} set ${index + 1} reps`} className="h-11 min-w-0 text-center text-lg font-semibold tabular-nums" type="number" min="0" inputMode="numeric" value={set.reps} onChange={(event) => updateSet(exercise, index, set, { reps: event.target.value })} />
                    <Button type="button" size="icon-sm" variant="ghost" className="text-slate-600 hover:text-red-300" disabled={busy} onClick={() => removeSet(exercise, index)} aria-label={`Delete set ${index + 1}`}><Trash2 /></Button>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2"><Button type="button" variant="ghost" className="text-blue-300" onClick={() => addSet(exercise)}><Plus /> Add set</Button><Button type="button" variant="ghost" disabled={!previous} onClick={() => copyPrevious(exercise)}><Copy /> Copy last sets</Button></div>
          </Surface>
        )
      })}

      {!exercises.length && <Surface className="border-dashed p-7 text-center"><p className="font-medium text-slate-200">Quick Workout is ready</p><p className="mt-1 text-sm text-slate-500">Search below to add your first exercise.</p></Surface>}
      <section className="grid gap-3" aria-labelledby="add-workout-exercise"><div><h2 id="add-workout-exercise" className="font-medium text-slate-100">Add exercise</h2><p className="mt-1 text-sm text-slate-500">Adds it only to this workout.</p></div><ExerciseSearch library={data.exercises} sessions={data.sessions} excludedIds={exercises.map((exercise) => exercise.exercise_id).filter((id): id is string => Boolean(id))} onAdd={addExercise} onCreateCustom={onCreateCustom} /></section>
      <InlineError message={error} />
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-2 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-2xl shadow-black/35 backdrop-blur md:bottom-4"><Button className="h-12 w-full" disabled={busy} onClick={finishWorkout}>{busy && <LoaderCircle className="animate-spin" />} Finish Workout</Button></div>
      <Button type="button" variant="ghost" className="text-red-300" disabled={busy} onClick={discardWorkout}><Trash2 /> Discard unfinished workout</Button>
    </div>
  )
}
