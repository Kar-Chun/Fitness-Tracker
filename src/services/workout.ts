import { supabase } from "../lib/supabase.ts"
import { DEFAULT_WORKOUT_TEMPLATES } from "../lib/workout-templates.ts"
import { requireData } from "./shared.ts"
import type {
  CustomExerciseInput,
  ExerciseLibraryItem,
  ExerciseSet,
  FinishedWorkoutInput,
  FitnessData,
  RoutineInput,
  WorkoutMode,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionWithDetails,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../types/fitness.ts"

export type WorkoutData = Pick<FitnessData, "templates" | "exercises" | "sessions">

export async function ensureDefaultWorkoutTemplates(userId: string) {
  const { data: library, error: libraryError } = await supabase.from("exercises").select("id,name").is("user_id", null)
  if (libraryError) throw new Error(libraryError.message)
  const exerciseIds = new Map((library as Array<{ id: string; name: string }>).map((exercise) => [exercise.name.toLowerCase(), exercise.id]))
  for (const template of DEFAULT_WORKOUT_TEMPLATES) {
    const { data, error } = await supabase
      .from("workout_templates")
      .upsert({ user_id: userId, name: template.name }, { onConflict: "user_id,name" })
      .select("id")
      .single()
    const savedTemplate = requireData(data, error, `Could not create ${template.name}.`) as { id: string }
    const exercises = template.exercises.map((exercise, position) => ({
      user_id: userId,
      template_id: savedTemplate.id,
      exercise_name: exercise.name,
      position,
      target_sets: exercise.targetSets,
      target_rep_min: exercise.repMin,
      target_rep_max: exercise.repMax,
      progression_step_kg: exercise.progressionStepKg,
      exercise_id: exerciseIds.get(exercise.name.toLowerCase()) ?? null,
      include_in_light: position < 3,
      light_target_sets: position < 3 ? Math.min(2, exercise.targetSets) : null,
    }))
    const { error: exerciseError } = await supabase
      .from("workout_template_exercises")
      .upsert(exercises, { onConflict: "template_id,position" })
    if (exerciseError) throw new Error(exerciseError.message)
  }
}

export async function loadExercises(userId: string) {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("category")
    .order("name")
  if (error) throw new Error(error.message)
  return data as ExerciseLibraryItem[]
}

export async function loadWorkoutData(userId: string): Promise<WorkoutData> {
  const [templateResult, sessionResult, exercises, sessionExerciseResult] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("*, workout_template_exercises(*, exercises(load_type))")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("workout_sessions")
      .select("*, workout_templates(name), exercise_sets(*)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(30),
    loadExercises(userId),
    supabase
      .from("workout_session_exercises")
      .select("*, exercise_sets(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  const firstError = [templateResult, sessionResult, sessionExerciseResult].find((result) => result.error)?.error
  if (firstError) throw new Error(firstError.message)

  type TemplateRow = Omit<WorkoutTemplate, "exercises"> & {
    workout_template_exercises: Array<Omit<WorkoutTemplateExercise, "load_type"> & { exercises: { load_type: WorkoutTemplateExercise["load_type"] } | null }>
  }
  type SessionRow = WorkoutSession & { workout_templates: { name: string } | null; exercise_sets: ExerciseSet[] }
  type SessionExerciseRow = Omit<WorkoutSessionExercise, "sets"> & { exercise_sets: ExerciseSet[] }

  const sessionExercises = (sessionExerciseResult.data as SessionExerciseRow[]).map((exercise) => ({
    id: exercise.id,
    user_id: exercise.user_id,
    session_id: exercise.session_id,
    exercise_id: exercise.exercise_id,
    exercise_name_snapshot: exercise.exercise_name_snapshot,
    position: exercise.position,
    load_type: exercise.load_type,
    target_sets: exercise.target_sets,
    target_rep_min: exercise.target_rep_min,
    target_rep_max: exercise.target_rep_max,
    progression_step_kg: exercise.progression_step_kg,
    status: exercise.status,
    created_at: exercise.created_at,
    sets: [...exercise.exercise_sets].sort((a, b) => a.set_number - b.set_number),
  }))

  const templates = (templateResult.data as TemplateRow[]).map((template) => ({
    id: template.id,
    user_id: template.user_id,
    name: template.name,
    created_at: template.created_at,
    exercises: [...template.workout_template_exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({ ...exercise, load_type: exercise.exercises?.load_type ?? (exercise.progression_step_kg === null ? "bodyweight" : "total") })),
  }))
  const sessions = (sessionResult.data as SessionRow[]).map((session) => ({
    id: session.id,
    user_id: session.user_id,
    template_id: session.template_id,
    mode: session.mode,
    readiness: session.readiness,
    title: session.title,
    logged_retrospectively: session.logged_retrospectively,
    started_at: session.started_at,
    completed_at: session.completed_at,
    template_name: session.workout_templates?.name ?? session.title ?? "Quick Workout",
    sets: [...session.exercise_sets].sort((a, b) => a.set_number - b.set_number),
    session_exercises: sessionExercises.filter((exercise) => exercise.session_id === session.id).sort((a, b) => a.position - b.position),
  }))

  return { templates, exercises, sessions }
}

export async function saveCustomExercise(userId: string, input: CustomExerciseInput, id?: string) {
  const name = input.name.trim()
  if (!name) throw new Error("Exercise name is required.")
  if (input.progressionStepKg !== null && input.progressionStepKg < 0) throw new Error("Progression step cannot be negative.")
  const payload = {
    user_id: userId,
    name,
    category: input.category,
    load_type: input.loadType,
    progression_step_kg: input.progressionStepKg,
  }
  const result = id
    ? await supabase.from("exercises").update(payload).eq("id", id).eq("user_id", userId).select("*").single()
    : await supabase.from("exercises").insert(payload).select("*").single()
  return requireData(result.data, result.error, "Could not save exercise.") as ExerciseLibraryItem
}

function validateRoutine(input: RoutineInput) {
  if (!input.name.trim()) throw new Error("Routine name is required.")
  input.exercises.forEach((exercise) => {
    if (exercise.targetSets <= 0) throw new Error("Target sets must be positive.")
    if (exercise.targetRepMin < 0 || exercise.targetRepMax < exercise.targetRepMin) throw new Error("Check the target rep range.")
    if (exercise.lightTargetSets !== null && exercise.lightTargetSets <= 0) throw new Error("Light sets must be positive.")
    if (exercise.progressionStepKg !== null && exercise.progressionStepKg < 0) throw new Error("Progression step cannot be negative.")
  })
}

export async function saveRoutine(input: RoutineInput, id?: string) {
  validateRoutine(input)
  const { data, error } = await supabase.rpc("save_workout_routine", {
    p_routine_id: id ?? null,
    p_name: input.name.trim(),
    p_exercises: input.exercises,
  })
  return requireData(data, error, "Could not save routine.") as string
}

export async function deleteRoutine(userId: string, id: string) {
  const { error } = await supabase.from("workout_templates").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

async function insertSessionExercises(userId: string, sessionId: string, exercises: Array<{
  exerciseId: string | null
  exerciseName: string
  loadType: WorkoutTemplateExercise["load_type"]
  targetSets: number
  targetRepMin: number
  targetRepMax: number
  progressionStepKg: number | null
  skipped?: boolean
}>) {
  if (!exercises.length) return [] as WorkoutSessionExercise[]
  const rows = exercises.map((exercise, position) => ({
    user_id: userId,
    session_id: sessionId,
    exercise_id: exercise.exerciseId,
    exercise_name_snapshot: exercise.exerciseName,
    position,
    load_type: exercise.loadType,
    target_sets: exercise.targetSets,
    target_rep_min: exercise.targetRepMin,
    target_rep_max: exercise.targetRepMax,
    progression_step_kg: exercise.progressionStepKg,
    status: exercise.skipped ? "skipped" : "planned",
  }))
  const { data, error } = await supabase.from("workout_session_exercises").insert(rows).select("*")
  if (error) throw new Error(error.message)
  return (data as Array<Omit<WorkoutSessionExercise, "sets">>).map((exercise) => ({ ...exercise, sets: [] }))
}

export async function startWorkout(userId: string, template: WorkoutTemplate | null, mode: WorkoutMode, title?: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, template_id: template?.id ?? null, mode, title: title?.trim() || template?.name || "Quick Workout", readiness: null })
    .select("*")
    .single()
  const session = requireData(data, error, "Could not start workout.") as WorkoutSession
  const planned = template
    ? template.exercises
      .filter((exercise) => mode === "normal" || exercise.include_in_light)
      .map((exercise) => ({
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        loadType: exercise.load_type,
        targetSets: mode === "light" ? exercise.light_target_sets ?? Math.min(2, exercise.target_sets) : exercise.target_sets,
        targetRepMin: exercise.target_rep_min,
        targetRepMax: exercise.target_rep_max,
        progressionStepKg: exercise.progression_step_kg,
      }))
    : []
  try {
    await insertSessionExercises(userId, session.id, planned)
  } catch (sessionExerciseError) {
    await supabase.from("workout_sessions").delete().eq("id", session.id).eq("user_id", userId)
    throw sessionExerciseError
  }
  return session
}

export async function startWorkoutFromSession(userId: string, previous: WorkoutSessionWithDetails) {
  const { data, error } = await supabase.from("workout_sessions").insert({
    user_id: userId,
    template_id: previous.template_id,
    mode: previous.mode,
    title: previous.title ?? previous.template_name,
    readiness: null,
  }).select("*").single()
  const session = requireData(data, error, "Could not start workout.") as WorkoutSession
  try {
    await insertSessionExercises(userId, session.id, previous.session_exercises
      .filter((exercise) => exercise.status !== "skipped")
      .map((exercise) => ({
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name_snapshot,
        loadType: exercise.load_type,
        targetSets: exercise.target_sets,
        targetRepMin: exercise.target_rep_min,
        targetRepMax: exercise.target_rep_max,
        progressionStepKg: exercise.progression_step_kg,
      })))
  } catch (copyError) {
    await supabase.from("workout_sessions").delete().eq("id", session.id).eq("user_id", userId)
    throw copyError
  }
}

export async function addWorkoutSessionExercise(userId: string, sessionId: string, exercise: ExerciseLibraryItem, position: number) {
  const [created] = await insertSessionExercises(userId, sessionId, [{
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    loadType: exercise.load_type,
    targetSets: 3,
    targetRepMin: 8,
    targetRepMax: 12,
    progressionStepKg: exercise.progression_step_kg,
  }])
  if (!created) throw new Error("Could not add exercise.")
  if (position !== 0) {
    const { error } = await supabase.from("workout_session_exercises").update({ position }).eq("id", created.id).eq("user_id", userId)
    if (error) throw new Error(error.message)
  }
  return created
}

export async function setSessionExerciseStatus(userId: string, id: string, status: WorkoutSessionExercise["status"]) {
  const { error } = await supabase.from("workout_session_exercises").update({ status }).eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function deleteWorkoutSessionExercise(userId: string, id: string) {
  const { error } = await supabase.from("workout_session_exercises").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function saveExerciseSet(userId: string, sessionId: string, exerciseName: string, setNumber: number, weightKg: number | null, reps: number, sessionExerciseId?: string | null) {
  const { data, error } = await supabase.from("exercise_sets").upsert({
    user_id: userId,
    session_id: sessionId,
    session_exercise_id: sessionExerciseId ?? null,
    exercise_name: exerciseName,
    set_number: setNumber,
    weight_kg: weightKg,
    reps,
  }, { onConflict: "session_id,exercise_name,set_number" }).select("*").single()
  if (error) throw new Error(error.message)
  if (sessionExerciseId) await setSessionExerciseStatus(userId, sessionExerciseId, "completed")
  return data as ExerciseSet
}

export async function deleteExerciseSet(userId: string, id: string) {
  const { error } = await supabase.from("exercise_sets").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function deleteExerciseSetsForSessionExercise(userId: string, sessionExerciseId: string) {
  const { error } = await supabase.from("exercise_sets").delete().eq("session_exercise_id", sessionExerciseId).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function saveFinishedWorkout(userId: string, input: FinishedWorkoutInput) {
  if (!input.title.trim()) throw new Error("Workout name is required.")
  const { data, error } = await supabase.from("workout_sessions").insert({
    user_id: userId,
    template_id: input.templateId,
    mode: input.mode,
    title: input.title.trim(),
    readiness: null,
    logged_retrospectively: true,
    started_at: input.startedAt ?? new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }).select("*").single()
  const session = requireData(data, error, "Could not create workout.") as WorkoutSession
  try {
    const sessionExercises = await insertSessionExercises(userId, session.id, input.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      loadType: exercise.loadType,
      targetSets: Math.max(1, exercise.targetSets),
      targetRepMin: exercise.targetRepMin,
      targetRepMax: exercise.targetRepMax,
      progressionStepKg: exercise.progressionStepKg,
      skipped: exercise.skipped,
    })))
    const sets = input.exercises.flatMap((exercise, exerciseIndex) => exercise.sets
      .filter((set) => set.completed && !exercise.skipped)
      .map((set, setIndex) => ({
        user_id: userId,
        session_id: session.id,
        session_exercise_id: sessionExercises[exerciseIndex]?.id,
        exercise_name: exercise.exerciseName,
        set_number: setIndex + 1,
        weight_kg: set.weightKg,
        reps: set.reps,
      })))
    if (sets.length) {
      const { error: setError } = await supabase.from("exercise_sets").insert(sets)
      if (setError) throw new Error(setError.message)
    }
    const completedIds = sessionExercises.filter((_, index) => !input.exercises[index]?.skipped).map((exercise) => exercise.id)
    if (completedIds.length) {
      const { error: statusError } = await supabase.from("workout_session_exercises").update({ status: "completed" }).in("id", completedIds).eq("user_id", userId)
      if (statusError) throw new Error(statusError.message)
    }
  } catch (saveError) {
    await supabase.from("workout_sessions").delete().eq("id", session.id).eq("user_id", userId)
    throw saveError
  }
}

export async function completeWorkoutSession(userId: string, sessionId: string) {
  const { error } = await supabase.from("workout_sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function discardWorkoutSession(userId: string, sessionId: string) {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId).eq("user_id", userId)
  if (error) throw new Error(error.message)
}
