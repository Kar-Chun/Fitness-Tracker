import { useState } from "react"
import { BookOpen, ChevronRight, Clock3, Dumbbell, History, LoaderCircle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineError } from "../components/shared/Feedback.tsx"
import { FinishedWorkoutLogger } from "../components/workout/FinishedWorkoutLogger.tsx"
import { LiveWorkoutLogger } from "../components/workout/LiveWorkoutLogger.tsx"
import { RoutineBuilder } from "../components/workout/RoutineBuilder.tsx"
import { WorkoutCompletionSummary } from "../components/workout/WorkoutCompletionSummary.tsx"
import { EmptyState, IconBadge, PageHeader, SectionHeader, Surface } from "../components/shared/Visual.tsx"
import { completeWorkoutSession, deleteRoutine, discardWorkoutSession, saveCustomExercise, saveFinishedWorkout, saveRoutine, startWorkout, startWorkoutFromSession } from "../services/fitness.ts"
import type { CustomExerciseInput, FinishedWorkoutInput, FitnessData, RoutineInput, WorkoutSessionWithDetails, WorkoutTemplate } from "../types/fitness.ts"

type WorkoutView =
  | { type: "overview" }
  | { type: "library" }
  | { type: "routine"; routine: WorkoutTemplate }
  | { type: "builder"; routine: WorkoutTemplate | null }
  | { type: "finished"; routine: WorkoutTemplate | null; recent: WorkoutSessionWithDetails | null }
  | { type: "summary"; session: WorkoutSessionWithDetails; template: WorkoutTemplate | null; previous: WorkoutSessionWithDetails[] }

interface WorkoutPageProps {
  userId: string
  data: FitnessData
  dumbbellMaxKg: number | null
  onRefresh: () => Promise<void>
}

function daysSince(iso: string | null) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function routineDuration(routine: WorkoutTemplate, sessions: WorkoutSessionWithDetails[]) {
  const recent = sessions.filter((session) => session.template_id === routine.id && session.completed_at).slice(0, 3)
  if (!recent.length) return null
  return Math.round(recent.reduce((total, session) => total + Math.max(1, (new Date(session.completed_at ?? session.started_at).getTime() - new Date(session.started_at).getTime()) / 60_000), 0) / recent.length)
}

export function WorkoutPage({ userId, data, dumbbellMaxKg, onRefresh }: WorkoutPageProps) {
  const [view, setView] = useState<WorkoutView>({ type: "overview" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const activeSession = data.sessions.find((session) => !session.completed_at)
  const recent = data.sessions.find((session) => session.completed_at) ?? null

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not complete that workout action.")
      throw actionError
    } finally {
      setBusy(false)
    }
  }

  async function startRoutine(routine: WorkoutTemplate, mode: "normal" | "light") {
    await run(async () => {
      await startWorkout(userId, routine, mode)
      await onRefresh()
      setView({ type: "overview" })
    })
  }

  async function startQuickWorkout() {
    await run(async () => {
      await startWorkout(userId, null, "normal", "Quick Workout")
      await onRefresh()
    })
  }

  async function startAgain(session: WorkoutSessionWithDetails) {
    await run(async () => {
      await startWorkoutFromSession(userId, session)
      await onRefresh()
    })
  }

  async function finishActive(completedDraft?: WorkoutSessionWithDetails) {
    if (!activeSession) return
    const template = activeSession.template_id ? data.templates.find((item) => item.id === activeSession.template_id) ?? null : null
    const completed = completedDraft ?? { ...activeSession, completed_at: new Date().toISOString() }
    await run(async () => {
      await completeWorkoutSession(userId, activeSession.id)
      await onRefresh()
      setView({ type: "summary", session: completed, template, previous: data.sessions.filter((session) => session.id !== activeSession.id && Boolean(session.completed_at)) })
    })
  }

  async function discardActive() {
    if (!activeSession || !window.confirm("Discard this unfinished workout and its saved sets?")) return
    await run(async () => {
      await discardWorkoutSession(userId, activeSession.id)
      await onRefresh()
    })
  }

  async function handleSaveRoutine(input: RoutineInput, id?: string) {
    await run(async () => {
      await saveRoutine(userId, input, id)
      await onRefresh()
      setView({ type: "overview" })
    })
  }

  async function handleCreateCustom(input: CustomExerciseInput) {
    const created = await saveCustomExercise(userId, input)
    await onRefresh()
    return created
  }

  async function handleDeleteRoutine(routine: WorkoutTemplate) {
    if (!window.confirm(`Delete “${routine.name}”? Historical workouts will remain unchanged.`)) return
    await run(async () => {
      await deleteRoutine(userId, routine.id)
      await onRefresh()
      setView({ type: "overview" })
    })
  }

  async function handleSaveFinished(input: FinishedWorkoutInput) {
    await run(async () => {
      await saveFinishedWorkout(userId, input)
      await onRefresh()
      setView({ type: "overview" })
    })
  }

  if (view.type === "summary") {
    return <WorkoutCompletionSummary session={view.session} previousSessions={view.previous} template={view.template} onDone={() => setView({ type: "overview" })} />
  }

  if (activeSession) {
    return <LiveWorkoutLogger userId={userId} session={activeSession} data={data} dumbbellMaxKg={dumbbellMaxKg} onCreateCustom={handleCreateCustom} onFinish={finishActive} onDiscard={discardActive} />
  }

  if (view.type === "builder") {
    return (
      <div className="grid gap-5">
        <PageHeader eyebrow={view.routine ? "Edit your plan" : "Build around how you train"} title={view.routine ? "Edit routine" : "Create routine"} />
        <RoutineBuilder routine={view.routine} library={data.exercises} sessions={data.sessions} onSave={handleSaveRoutine} onCreateCustom={handleCreateCustom} onCancel={() => setView({ type: "overview" })} />
      </div>
    )
  }

  if (view.type === "finished") {
    if (!view.routine && !view.recent) {
      return (
        <div className="grid gap-5">
          <PageHeader eyebrow="Choose what you finished" title="Log finished workout" />
          <div className="grid gap-2">
            {data.templates.map((routine) => <Button key={routine.id} variant="outline" className="h-12 justify-between px-4" onClick={() => setView({ type: "finished", routine, recent: null })}>{routine.name}<ChevronRight /></Button>)}
          </div>
          {data.sessions.some((session) => session.completed_at) && <><p className="text-sm font-medium text-slate-400">Or copy a recent workout</p><div className="grid gap-2">{data.sessions.filter((session) => session.completed_at).slice(0, 5).map((session) => <Button key={session.id} variant="ghost" className="h-12 justify-between px-4" onClick={() => setView({ type: "finished", routine: session.template_id ? data.templates.find((routine) => routine.id === session.template_id) ?? null : null, recent: session })}>{session.title ?? session.template_name}<History /></Button>)}</div></>}
          <Button variant="ghost" onClick={() => setView({ type: "overview" })}>Cancel</Button>
        </div>
      )
    }
    return (
      <div className="grid gap-5">
        <PageHeader eyebrow="Quick retrospective entry" title="Log finished workout" />
        <FinishedWorkoutLogger data={data} routine={view.routine} recentSession={view.recent} onCreateCustom={handleCreateCustom} onSave={handleSaveFinished} onCancel={() => setView({ type: "overview" })} />
      </div>
    )
  }

  if (view.type === "library") {
    const categories = ["chest", "back", "shoulders", "arms", "legs", "core", "other"] as const
    return (
      <div className="grid gap-5">
        <Button variant="ghost" className="w-fit px-0 text-slate-400" onClick={() => setView({ type: "overview" })}>← Workout</Button>
        <PageHeader eyebrow="Built-in and personal movements" title="Exercise library" />
        {categories.map((category) => {
          const items = data.exercises.filter((exercise) => exercise.category === category)
          if (!items.length) return null
          return <section key={category}><h2 className="mb-2 text-sm font-medium capitalize text-slate-400">{category}</h2><div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">{items.map((exercise, index) => <div key={exercise.id} className={`flex items-center justify-between gap-4 p-3 ${index ? "border-t border-slate-800" : ""}`}><div><p className="text-sm text-slate-200">{exercise.name}</p><p className="mt-1 text-xs text-slate-500">{exercise.load_type === "per_dumbbell" ? "kg each" : exercise.load_type === "total" ? "total load" : exercise.load_type === "bodyweight" ? "bodyweight" : "no external load"}</p></div>{exercise.user_id && <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-300">Custom</span>}</div>)}</div></section>
        })}
        <p className="text-sm leading-6 text-slate-500">Create custom exercises from the routine builder, then reuse them in any routine or Quick Workout.</p>
        <Button onClick={() => setView({ type: "builder", routine: null })}><Plus /> Create routine or custom exercise</Button>
      </div>
    )
  }

  if (view.type === "routine") {
    const duration = routineDuration(view.routine, data.sessions)
    const lightCount = view.routine.exercises.filter((exercise) => exercise.include_in_light).length
    return (
      <div className="grid gap-5">
        <Button variant="ghost" className="w-fit px-0 text-slate-400" onClick={() => setView({ type: "overview" })}>← My routines</Button>
        <PageHeader eyebrow={`${view.routine.exercises.length} exercises${duration ? ` · about ${duration} min` : ""}`} title={view.routine.name} />
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          {view.routine.exercises.map((exercise, index) => <div key={exercise.id} className={`flex items-center justify-between gap-4 p-4 ${index ? "border-t border-slate-800" : ""}`}><div><p className="font-medium">{exercise.exercise_name}</p><p className="mt-1 text-xs text-slate-500">{exercise.target_sets} × {exercise.target_rep_min}–{exercise.target_rep_max}{exercise.load_type === "per_dumbbell" ? " · kg each" : exercise.load_type === "total" ? " · total load" : ""}</p></div>{exercise.include_in_light && <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-300">Light</span>}</div>)}
          {!view.routine.exercises.length && <p className="p-6 text-center text-sm text-slate-500">This routine is empty. Edit it to add exercises.</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2"><Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" disabled={busy} onClick={() => startRoutine(view.routine, "normal")}>{busy && <LoaderCircle className="animate-spin" />} Start workout</Button><Button size="lg" variant="outline" className="h-11" disabled={busy || lightCount === 0} onClick={() => startRoutine(view.routine, "light")}>Use Light version{lightCount ? ` · ${lightCount}` : ""}</Button></div>
        <div className="grid grid-cols-2 gap-2"><Button variant="ghost" onClick={() => setView({ type: "builder", routine: view.routine })}><Pencil /> Edit routine</Button><Button variant="ghost" className="text-red-300" onClick={() => handleDeleteRoutine(view.routine)}><Trash2 /> Delete</Button></div>
        <InlineError message={error} />
      </div>
    )
  }

  return (
    <div className="grid gap-7">
      <PageHeader eyebrow="Train your way" title="Workout" description="Choose a routine, start quickly, or record what you already did." />
      <InlineError message={error} />
      <section>
        <SectionHeader eyebrow="Continue where you left off" title="Recent" />
        {recent ? (
          <Surface className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-400/70" />
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-semibold tracking-tight">{recent.title ?? recent.template_name}</h3><p className="mt-2 text-sm text-slate-500">{daysSince(recent.completed_at) === 0 ? "Today" : `${daysSince(recent.completed_at)} days ago`} · {recent.session_exercises.filter((exercise) => exercise.status === "completed").length} exercises</p></div><IconBadge icon={History} /></div>
            <div className="mt-6 flex flex-wrap gap-2"><Button className="h-11 px-5" disabled={busy} onClick={() => startAgain(recent)}>Start again <ChevronRight /></Button><Button variant="outline" className="h-11" onClick={() => setView({ type: "finished", routine: recent.template_id ? data.templates.find((routine) => routine.id === recent.template_id) ?? null : null, recent })}>Log finished / Copy last</Button></div>
          </Surface>
        ) : <EmptyState compact icon={Dumbbell} title="No workouts yet" description="Create a routine or start a Quick Workout when you are ready." action={<Button onClick={startQuickWorkout}>Start workout</Button>} />}
      </section>
      <section>
        <SectionHeader eyebrow="Your training plans" title="My routines" action={<Button size="sm" variant="ghost" className="text-blue-300" onClick={() => setView({ type: "builder", routine: null })}><Plus /> Create</Button>} />
        <div className="grid gap-3 sm:grid-cols-2">
          {data.templates.map((routine) => {
            const last = data.sessions.find((session) => session.template_id === routine.id && session.completed_at)
            const preview = routine.exercises.slice(0, 3).map((exercise) => exercise.exercise_name).join(" · ")
            return <button key={routine.id} type="button" className="steady-interactive flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 text-left" onClick={() => setView({ type: "routine", routine })}><div className="min-w-0"><p className="font-medium text-slate-100">{routine.name}</p><p className="mt-1 text-xs text-slate-500">{routine.exercises.length} exercises{last ? ` · last ${daysSince(last.completed_at)}d ago` : ""}</p>{preview && <p className="mt-3 truncate text-xs text-slate-600">{preview}{routine.exercises.length > 3 ? ` +${routine.exercises.length - 3}` : ""}</p>}</div><ChevronRight className="shrink-0 text-slate-600" /></button>
          })}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" variant="outline" className="h-16 justify-start px-4" disabled={busy} onClick={startQuickWorkout}><Sparkles className="text-blue-400" /><span className="text-left"><span className="block">Quick Workout</span><span className="block text-xs font-normal text-slate-500">Start empty and add exercises</span></span></Button>
        <Button size="lg" variant="outline" className="h-16 justify-start px-4" onClick={() => setView({ type: "finished", routine: null, recent: null })}><Clock3 className="text-blue-400" /><span className="text-left"><span className="block">Log Finished Workout</span><span className="block text-xs font-normal text-slate-500">Compact entry after training</span></span></Button>
      </section>
      <Button variant="ghost" className="h-12 justify-start text-slate-300" onClick={() => setView({ type: "library" })}><BookOpen className="text-blue-400" /> Browse exercise library <ChevronRight className="ml-auto" /></Button>
      {!data.templates.length && <Button size="lg" className="h-12" onClick={() => setView({ type: "builder", routine: null })}><Dumbbell /> Create your first routine</Button>}
    </div>
  )
}
