import { useMemo, useState } from "react"
import { Check, ChevronRight, Dumbbell, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input } from "../components/shared/FormField.tsx"
import { InlineError } from "../components/shared/Feedback.tsx"
import { discardWorkoutSession, saveExerciseSet } from "../services/fitness.ts"
import type { ExerciseSet, FitnessData, WorkoutMode, WorkoutSessionWithDetails, WorkoutTemplate, WorkoutTemplateExercise } from "../types/fitness.ts"

interface WorkoutPageProps {
  userId: string
  data: FitnessData
  onStart: (template: WorkoutTemplate, mode: WorkoutMode) => Promise<void>
  onComplete: (sessionId: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function WorkoutPage({ userId, data, onStart, onComplete, onRefresh }: WorkoutPageProps) {
  const activeSession = data.sessions.find((session) => !session.completed_at)
  const [starting, setStarting] = useState("")
  const [error, setError] = useState("")

  async function handleStart(template: WorkoutTemplate, mode: WorkoutMode) {
    setStarting(`${template.id}-${mode}`)
    setError("")
    try {
      await onStart(template, mode)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start this workout.")
    } finally {
      setStarting("")
    }
  }

  async function handleDiscard(session: WorkoutSessionWithDetails) {
    if (!window.confirm("Discard this unfinished workout? Saved sets from this session will also be removed.")) return
    setError("")
    try {
      await discardWorkoutSession(userId, session.id)
      await onRefresh()
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : "Could not discard this workout.")
    }
  }

  if (activeSession) {
    const template = data.templates.find((item) => item.id === activeSession.template_id)
    if (template) {
      return <ActiveWorkout userId={userId} session={activeSession} template={template} completedSessions={data.sessions.filter((session) => Boolean(session.completed_at))} onComplete={onComplete} onRefresh={onRefresh} onDiscard={() => handleDiscard(activeSession)} />
    }
  }

  return (
    <div className="grid gap-6">
      <header><p className="text-sm text-slate-500">Alternating full body plan</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Workout</h1></header>
      <InlineError message={error} />
      <div className="grid gap-5 lg:grid-cols-2">
        {data.templates.map((template) => (
          <section key={template.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-medium text-blue-400">FULL BODY</p><h2 className="mt-1 text-2xl font-semibold">{template.name}</h2></div>
              <span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Dumbbell className="size-5" /></span>
            </div>
            <ul className="mt-5 grid gap-3">
              {template.exercises.map((exercise) => (
                <li key={exercise.id} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-300">{exercise.exercise_name}</span><span className="shrink-0 text-slate-600">{exercise.target_sets} × {exercise.target_rep_min}–{exercise.target_rep_max}</span></li>
              ))}
            </ul>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" disabled={Boolean(starting)} onClick={() => handleStart(template, "normal")}>{starting === `${template.id}-normal` ? <LoaderCircle className="animate-spin" /> : <ChevronRight />} Normal</Button>
              <Button size="lg" variant="outline" className="h-11" disabled={Boolean(starting)} onClick={() => handleStart(template, "light")}>{starting === `${template.id}-light` && <LoaderCircle className="animate-spin" />} Light · 3 exercises</Button>
            </div>
          </section>
        ))}
      </div>
      <p className="text-center text-sm text-slate-600">Normal and light workouts both count as completed sessions.</p>
    </div>
  )
}

interface ActiveWorkoutProps {
  userId: string
  session: WorkoutSessionWithDetails
  template: WorkoutTemplate
  completedSessions: WorkoutSessionWithDetails[]
  onComplete: (sessionId: string) => Promise<void>
  onRefresh: () => Promise<void>
  onDiscard: () => void
}

function ActiveWorkout({ userId, session, template, completedSessions, onComplete, onRefresh, onDiscard }: ActiveWorkoutProps) {
  const exercises = session.mode === "light" ? template.exercises.slice(0, 3) : template.exercises
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState("")
  const requiredSetCount = exercises.reduce((total, exercise) => total + (session.mode === "light" ? Math.min(2, exercise.target_sets) : exercise.target_sets), 0)
  const savedRequiredSets = exercises.reduce((total, exercise) => {
    const required = session.mode === "light" ? Math.min(2, exercise.target_sets) : exercise.target_sets
    return total + session.sets.filter((set) => set.exercise_name === exercise.exercise_name && set.set_number <= required && set.reps > 0).length
  }, 0)

  async function finishWorkout() {
    if (savedRequiredSets < requiredSetCount) {
      setError(`Complete the required sets first (${savedRequiredSets} of ${requiredSetCount} saved).`)
      return
    }
    setFinishing(true)
    setError("")
    try {
      await onComplete(session.id)
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Could not complete this workout.")
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium uppercase tracking-wide text-blue-400">{session.mode} session</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{template.name}</h1><p className="mt-2 text-sm text-slate-500">{savedRequiredSets} of {requiredSetCount} required sets saved</p></div>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-300" onClick={onDiscard} aria-label="Discard workout"><Trash2 /></Button>
      </header>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${requiredSetCount ? (savedRequiredSets / requiredSetCount) * 100 : 0}%` }} /></div>
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} userId={userId} session={session} exercise={exercise} light={session.mode === "light"} completedSessions={completedSessions} onSaved={onRefresh} />
      ))}
      <InlineError message={error} />
      <Button size="lg" className="h-12 bg-emerald-500 text-base text-emerald-950 hover:bg-emerald-400" disabled={finishing || savedRequiredSets < requiredSetCount} onClick={finishWorkout}>{finishing ? <LoaderCircle className="animate-spin" /> : <Check />} Finish workout</Button>
      <p className="text-center text-xs text-slate-600">Saved sets remain here if you leave and return later.</p>
    </div>
  )
}

interface ExerciseCardProps {
  userId: string
  session: WorkoutSessionWithDetails
  exercise: WorkoutTemplateExercise
  light: boolean
  completedSessions: WorkoutSessionWithDetails[]
  onSaved: () => Promise<void>
}

function ExerciseCard({ userId, session, exercise, light, completedSessions, onSaved }: ExerciseCardProps) {
  const requiredSets = light ? Math.min(2, exercise.target_sets) : exercise.target_sets
  const savedSets = session.sets.filter((set) => set.exercise_name === exercise.exercise_name)
  const [setCount, setSetCount] = useState(Math.max(requiredSets, savedSets.length))
  const previous = useMemo(() => {
    const previousSession = completedSessions.find((item) => item.sets.some((set) => set.exercise_name === exercise.exercise_name))
    return previousSession?.sets.filter((set) => set.exercise_name === exercise.exercise_name) ?? []
  }, [completedSessions, exercise.exercise_name])

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">{exercise.exercise_name}</h2>
        <p className="mt-1 text-sm text-slate-500">Target {exercise.target_rep_min}–{exercise.target_rep_max} reps{previous.length ? ` · Previous: ${formatPrevious(previous)}` : " · No previous performance"}</p>
      </div>
      <div className="grid gap-3">
        {Array.from({ length: setCount }, (_, index) => (
          <SetRow key={index + 1} userId={userId} sessionId={session.id} exerciseName={exercise.exercise_name} setNumber={index + 1} saved={savedSets.find((set) => set.set_number === index + 1)} required={index < requiredSets} onSaved={onSaved} />
        ))}
      </div>
      <Button variant="ghost" className="mt-3 text-slate-400" onClick={() => setSetCount((count) => Math.min(10, count + 1))} disabled={setCount >= 10}><Plus /> Add set</Button>
    </section>
  )
}

function formatPrevious(sets: ExerciseSet[]) {
  return sets.map((set) => `${set.weight_kg ?? "—"}kg × ${set.reps}`).join(", ")
}

interface SetRowProps {
  userId: string
  sessionId: string
  exerciseName: string
  setNumber: number
  saved?: ExerciseSet
  required: boolean
  onSaved: () => Promise<void>
}

function SetRow({ userId, sessionId, exerciseName, setNumber, saved, required, onSaved }: SetRowProps) {
  const [weight, setWeight] = useState(saved?.weight_kg === null || !saved ? "" : String(saved.weight_kg))
  const [reps, setReps] = useState(saved ? String(saved.reps) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    const weightValue = weight === "" ? null : Number(weight)
    const repsValue = Number(reps)
    if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue < 0 || weightValue > 2000)) return setError("Check weight")
    if (!Number.isInteger(repsValue) || repsValue <= 0 || repsValue > 1000) return setError("Check reps")
    setSaving(true)
    setError("")
    try {
      await saveExerciseSet(userId, sessionId, exerciseName, setNumber, weightValue, repsValue)
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`rounded-2xl border p-3 ${saved ? "border-emerald-400/20 bg-emerald-400/5" : "border-slate-800 bg-slate-950/60"}`}>
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Set {setNumber} {!required && <span className="font-normal text-slate-600">optional</span>}</p>{saved && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3.5" /> Saved</span>}</div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <FieldShell label="Weight kg" htmlFor={`${exerciseName}-${setNumber}-weight`}><Input id={`${exerciseName}-${setNumber}-weight`} type="number" min="0" max="2000" step="0.5" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} /></FieldShell>
        <FieldShell label="Reps" htmlFor={`${exerciseName}-${setNumber}-reps`}><Input id={`${exerciseName}-${setNumber}-reps`} type="number" min="1" max="1000" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} /></FieldShell>
        <Button size="icon-lg" className="size-11 bg-blue-500 hover:bg-blue-400" disabled={saving} onClick={handleSave} aria-label={`Save set ${setNumber}`}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />}</Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}
