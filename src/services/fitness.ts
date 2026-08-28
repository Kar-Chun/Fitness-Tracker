import { supabase } from "../lib/supabase.ts"
import { calculateCalorieTarget } from "../lib/calculations.ts"
import { daysAgo, toLocalDateKey } from "../lib/date.ts"
import { DEFAULT_WORKOUT_TEMPLATES } from "../lib/workout-templates.ts"
import type {
  CalorieTarget,
  ExerciseSet,
  FitnessData,
  FoodEntry,
  FoodEntryInput,
  OnboardingInput,
  Profile,
  WeightEntry,
  WorkoutMode,
  WorkoutSession,
  WorkoutSessionWithDetails,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../types/fitness.ts"

function requireData<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error(fallback)
  return data
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Profile | null
}

async function ensureDefaultWorkoutTemplates(userId: string) {
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
    }))
    const { error: exerciseError } = await supabase
      .from("workout_template_exercises")
      .upsert(exercises, { onConflict: "template_id,position" })
    if (exerciseError) throw new Error(exerciseError.message)
  }
}

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const target = calculateCalorieTarget({
    age: input.age,
    sex: input.sex,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    goal: input.goal,
    activityLevel: input.activityLevel,
  })

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: userId,
    age: input.age,
    sex: input.sex,
    height_cm: input.heightCm,
    goal: input.goal,
    activity_level: input.activityLevel,
    onboarding_completed: false,
  })
  if (profileError) throw new Error(profileError.message)

  const { data: existingTarget, error: targetLookupError } = await supabase
    .from("calorie_targets")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "initial_estimate")
    .maybeSingle()
  if (targetLookupError) throw new Error(targetLookupError.message)

  const targetPayload = {
    user_id: userId,
    calories: target,
    effective_from: toLocalDateKey(),
    reason: "initial_estimate",
  }
  const targetResult = existingTarget
    ? await supabase.from("calorie_targets").update(targetPayload).eq("id", existingTarget.id)
    : await supabase.from("calorie_targets").insert(targetPayload)
  if (targetResult.error) throw new Error(targetResult.error.message)

  await upsertWeight(userId, input.weightKg, toLocalDateKey())
  await ensureDefaultWorkoutTemplates(userId)
  const { error: completionError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", userId)
  if (completionError) throw new Error(completionError.message)
  return target
}

export async function loadFitnessData(userId: string): Promise<FitnessData> {
  const [targetResult, foodResult, weightResult, templateResult, sessionResult] = await Promise.all([
    supabase
      .from("calorie_targets")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", toLocalDateKey())
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("food_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("eaten_at", daysAgo(30).toISOString())
      .order("eaten_at", { ascending: false }),
    supabase
      .from("weight_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("recorded_on", toLocalDateKey(daysAgo(60)))
      .order("recorded_on", { ascending: false }),
    supabase
      .from("workout_templates")
      .select("*, workout_template_exercises(*)")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("workout_sessions")
      .select("*, workout_templates(name), exercise_sets(*)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(30),
  ])

  const firstError = [targetResult, foodResult, weightResult, templateResult, sessionResult].find(
    (result) => result.error,
  )?.error
  if (firstError) throw new Error(firstError.message)

  type TemplateRow = Omit<WorkoutTemplate, "exercises"> & {
    workout_template_exercises: WorkoutTemplateExercise[]
  }
  type SessionRow = WorkoutSession & {
    workout_templates: { name: string } | null
    exercise_sets: ExerciseSet[]
  }

  const templates = (templateResult.data as TemplateRow[]).map((template) => ({
    id: template.id,
    user_id: template.user_id,
    name: template.name,
    created_at: template.created_at,
    exercises: [...template.workout_template_exercises].sort((a, b) => a.position - b.position),
  }))
  const sessions = (sessionResult.data as SessionRow[]).map((session) => ({
    id: session.id,
    user_id: session.user_id,
    template_id: session.template_id,
    mode: session.mode,
    started_at: session.started_at,
    completed_at: session.completed_at,
    template_name: session.workout_templates?.name ?? "Workout",
    sets: [...session.exercise_sets].sort((a, b) => a.set_number - b.set_number),
  }))

  return {
    calorieTarget: targetResult.data as CalorieTarget | null,
    foodEntries: foodResult.data as FoodEntry[],
    weightEntries: weightResult.data as WeightEntry[],
    templates,
    sessions,
  }
}

export async function saveFoodEntry(userId: string, input: FoodEntryInput, id?: string) {
  const payload = {
    user_id: userId,
    name: input.name.trim(),
    calories: input.calories,
    protein_g: input.proteinG,
    meal_type: input.mealType,
    eaten_at: new Date(input.eatenAt).toISOString(),
  }
  const result = id
    ? await supabase.from("food_entries").update(payload).eq("id", id).eq("user_id", userId)
    : await supabase.from("food_entries").insert(payload)
  if (result.error) throw new Error(result.error.message)
}

export async function deleteFoodEntry(userId: string, id: string) {
  const { error } = await supabase.from("food_entries").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function upsertWeight(userId: string, weightKg: number, recordedOn: string) {
  const { error } = await supabase
    .from("weight_entries")
    .upsert(
      { user_id: userId, weight_kg: weightKg, recorded_on: recordedOn },
      { onConflict: "user_id,recorded_on" },
    )
  if (error) throw new Error(error.message)
}

export async function startWorkout(userId: string, templateId: string, mode: WorkoutMode) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: userId, template_id: templateId, mode })
    .select("*")
    .single()
  return requireData(data, error, "Could not start workout.") as WorkoutSession
}

export async function saveExerciseSet(
  userId: string,
  sessionId: string,
  exerciseName: string,
  setNumber: number,
  weightKg: number | null,
  reps: number,
) {
  const { error } = await supabase.from("exercise_sets").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      exercise_name: exerciseName,
      set_number: setNumber,
      weight_kg: weightKg,
      reps,
    },
    { onConflict: "session_id,exercise_name,set_number" },
  )
  if (error) throw new Error(error.message)
}

export async function completeWorkoutSession(userId: string, sessionId: string) {
  const { error } = await supabase
    .from("workout_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function discardWorkoutSession(userId: string, sessionId: string) {
  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export function addSessionDetails(
  session: WorkoutSession,
  templateName: string,
): WorkoutSessionWithDetails {
  return { ...session, template_name: templateName, sets: [] }
}
