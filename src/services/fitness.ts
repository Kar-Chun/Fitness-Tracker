import { supabase } from "../lib/supabase.ts"
import { calculateCalorieTarget } from "../lib/calculations.ts"
import { daysAgo, toLocalDateKey } from "../lib/date.ts"
import { DEFAULT_WORKOUT_TEMPLATES } from "../lib/workout-templates.ts"
import {
  copyMealToNow,
  normalizeFoodName,
  savedMealToFoodInputs,
} from "../lib/food-history.ts"
import type {
  CalorieReview,
  CalorieTarget,
  CustomExerciseInput,
  DailyFoodLogStatus,
  EquipmentSettingsInput,
  ExerciseLibraryItem,
  ExerciseSet,
  FavouriteFood,
  FavouriteFoodInput,
  FitnessData,
  FoodEntry,
  FoodEntryInput,
  FoodEstimate,
  FoodEstimateLogInput,
  FoodImageAnalysisInput,
  FoodImageAnalysisResult,
  FinishedWorkoutInput,
  OnboardingInput,
  Profile,
  SavedMeal,
  SavedMealInput,
  SavedMealItem,
  RoutineInput,
  WeightEntry,
  WorkoutMode,
  WorkoutSession,
  WorkoutSessionWithDetails,
  WorkoutSessionExercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../types/fitness.ts"
import type { AdaptiveReviewResult } from "../lib/calorie-adaptation.ts"

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
  const [targetResult, targetHistoryResult, foodStatusResult, reviewResult, foodResult, favouriteResult, savedMealResult, weightResult, templateResult, sessionResult, exerciseResult, sessionExerciseResult] = await Promise.all([
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
      .from("calorie_targets")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("daily_food_log_status")
      .select("*")
      .eq("user_id", userId)
      .gte("date", toLocalDateKey(daysAgo(60)))
      .order("date", { ascending: false }),
    supabase
      .from("calorie_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("food_entries")
      .select("*")
      .eq("user_id", userId)
      .order("eaten_at", { ascending: false })
      .limit(1000),
    supabase
      .from("favourite_foods")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("saved_meals")
      .select("*, saved_meal_items(*)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("weight_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("recorded_on", toLocalDateKey(daysAgo(60)))
      .order("recorded_on", { ascending: false }),
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
    supabase
      .from("exercises")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("category")
      .order("name"),
    supabase
      .from("workout_session_exercises")
      .select("*, exercise_sets(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  const firstError = [targetResult, targetHistoryResult, foodStatusResult, reviewResult, foodResult, favouriteResult, savedMealResult, weightResult, templateResult, sessionResult, exerciseResult, sessionExerciseResult].find(
    (result) => result.error,
  )?.error
  if (firstError) throw new Error(firstError.message)

  type TemplateRow = Omit<WorkoutTemplate, "exercises"> & {
    workout_template_exercises: Array<Omit<WorkoutTemplateExercise, "load_type"> & { exercises: { load_type: WorkoutTemplateExercise["load_type"] } | null }>
  }
  type SessionRow = WorkoutSession & {
    workout_templates: { name: string } | null
    exercise_sets: ExerciseSet[]
  }
  type SavedMealRow = Omit<SavedMeal, "items"> & {
    saved_meal_items: SavedMealItem[]
  }
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
  const savedMeals = (savedMealResult.data as SavedMealRow[]).map((meal) => ({
    id: meal.id,
    user_id: meal.user_id,
    name: meal.name,
    default_meal_type: meal.default_meal_type,
    created_at: meal.created_at,
    updated_at: meal.updated_at,
    items: [...meal.saved_meal_items].sort((a, b) => a.position - b.position),
  }))

  return {
    calorieTarget: targetResult.data as CalorieTarget | null,
    calorieTargetHistory: targetHistoryResult.data as CalorieTarget[],
    dailyFoodLogStatuses: foodStatusResult.data as DailyFoodLogStatus[],
    calorieReviews: reviewResult.data as CalorieReview[],
    foodEntries: foodResult.data as FoodEntry[],
    favouriteFoods: favouriteResult.data as FavouriteFood[],
    savedMeals,
    weightEntries: weightResult.data as WeightEntry[],
    templates,
    exercises: exerciseResult.data as ExerciseLibraryItem[],
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
    source: input.source ?? "manual",
    confidence: input.confidence ?? null,
    estimate_low_calories: input.estimateLowCalories ?? null,
    estimate_high_calories: input.estimateHighCalories ?? null,
  }
  const result = id
    ? await supabase.from("food_entries").update(payload).eq("id", id).eq("user_id", userId)
    : await supabase.from("food_entries").insert(payload)
  if (result.error) throw new Error(result.error.message)
}

export async function analyzeFoodText(description: string) {
  const { data, error } = await supabase.functions.invoke("analyze-food-text", {
    body: { description },
  })
  if (error) throw new Error(await functionErrorMessage(error, "Could not analyze this meal."))
  if (!isFoodEstimate(data)) throw new Error("The meal estimate response was incomplete. Please try again.")
  return data
}

export async function analyzeFoodImage(input: FoodImageAnalysisInput) {
  const { data, error } = await supabase.functions.invoke("analyze-food-image", { body: input })
  if (error) throw new Error(await functionErrorMessage(error, "Could not analyze this meal photo."))
  if (!isFoodImageAnalysisResult(data)) throw new Error("The photo analysis response was incomplete. Please try again.")
  return data
}

async function functionErrorMessage(error: { message?: string; context?: unknown }, fallback: string) {
  let message = error.message || fallback
  if (error.context instanceof Response) {
    try {
      const body = await error.context.clone().json() as { error?: { message?: string } }
      message = body.error?.message ?? message
    } catch {
      // Keep the standard function error when the response is not JSON.
    }
  }
  return message
}

export async function saveFoodEstimate(userId: string, input: FoodEstimateLogInput) {
  await saveFoodEntry(userId, {
    name: input.name,
    calories: input.calories,
    proteinG: input.proteinG,
    mealType: input.mealType,
    eatenAt: input.eatenAt,
    source: input.source,
    confidence: input.confidence,
    estimateLowCalories: input.estimateLowCalories,
    estimateHighCalories: input.estimateHighCalories,
  })
}

function isFoodEstimate(value: unknown): value is FoodEstimate {
  if (!value || typeof value !== "object") return false
  const estimate = value as Partial<FoodEstimate>
  const range = estimate.calorieRange
  const sources = new Set(["history", "favourite", "saved_meal", "usda", "ai_estimate", "mixed"])
  const itemSources = new Set(["history", "favourite", "saved_meal", "usda", "ai_estimate"])
  const confidences = new Set(["high", "medium", "low"])
  return typeof estimate.mealName === "string" && Boolean(estimate.mealName.trim())
    && typeof estimate.totalCalories === "number" && Number.isFinite(estimate.totalCalories) && estimate.totalCalories > 0
    && typeof estimate.totalProteinG === "number" && Number.isFinite(estimate.totalProteinG) && estimate.totalProteinG >= 0
    && Boolean(range) && typeof range?.low === "number" && typeof range.high === "number"
    && range.low <= estimate.totalCalories && estimate.totalCalories <= range.high
    && typeof estimate.source === "string" && sources.has(estimate.source)
    && typeof estimate.confidence === "string" && confidences.has(estimate.confidence)
    && typeof estimate.sourceSummary === "string"
    && Array.isArray(estimate.items)
    && estimate.items.length > 0
    && estimate.items.every((item) => Boolean(item)
      && typeof item.name === "string" && Boolean(item.name.trim())
      && typeof item.portionDescription === "string"
      && typeof item.estimatedGrams === "number" && Number.isFinite(item.estimatedGrams) && item.estimatedGrams >= 0
      && typeof item.calories === "number" && Number.isFinite(item.calories) && item.calories > 0
      && typeof item.proteinG === "number" && Number.isFinite(item.proteinG) && item.proteinG >= 0
      && typeof item.source === "string" && itemSources.has(item.source)
      && typeof item.confidence === "string" && confidences.has(item.confidence)
      && typeof item.calorieRange?.low === "number" && typeof item.calorieRange.high === "number"
      && item.calorieRange.low <= item.calories && item.calories <= item.calorieRange.high
      && (item.caloriesPer100g === null || typeof item.caloriesPer100g === "number")
      && (item.proteinPer100g === null || typeof item.proteinPer100g === "number"))
}

function isFoodImageAnalysisResult(value: unknown): value is FoodImageAnalysisResult {
  if (!value || typeof value !== "object") return false
  const result = value as Partial<FoodImageAnalysisResult>
  if (!Array.isArray(result.uncertainties) || !result.uncertainties.every((note) => typeof note === "string")) return false
  if (result.status === "ok") return "estimate" in result && isFoodEstimate(result.estimate)
  return (result.status === "no_food" || result.status === "too_uncertain") && "message" in result && typeof result.message === "string"
}

async function insertFoodEntries(userId: string, inputs: FoodEntryInput[]) {
  if (!inputs.length) throw new Error("There are no food items to log.")
  const payload = inputs.map((input) => ({
    user_id: userId,
    name: input.name.trim(),
    calories: input.calories,
    protein_g: input.proteinG,
    meal_type: input.mealType,
    eaten_at: new Date(input.eatenAt).toISOString(),
    source: input.source ?? "manual",
    confidence: input.confidence ?? null,
    estimate_low_calories: input.estimateLowCalories ?? null,
    estimate_high_calories: input.estimateHighCalories ?? null,
  }))
  const { error } = await supabase.from("food_entries").insert(payload)
  if (error) throw new Error(error.message)
}

export async function copyMealFromDate(userId: string, entries: FoodEntry[], now = new Date()) {
  await insertFoodEntries(userId, copyMealToNow(entries, now))
}

export async function saveFavouriteFood(userId: string, input: FavouriteFoodInput, id?: string) {
  const payload = {
    user_id: userId,
    name: input.name.trim(),
    normalized_name: normalizeFoodName(input.name),
    calories: input.calories,
    protein_g: input.proteinG,
    default_meal_type: input.defaultMealType,
  }
  const result = id
    ? await supabase.from("favourite_foods").update(payload).eq("id", id).eq("user_id", userId)
    : await supabase.from("favourite_foods").upsert(payload, { onConflict: "user_id,normalized_name" })
  if (result.error) throw new Error(result.error.message)
}

export async function deleteFavouriteFood(userId: string, id: string) {
  const { error } = await supabase.from("favourite_foods").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function saveSavedMeal(input: SavedMealInput, id?: string) {
  if (!input.items.length) throw new Error("Add at least one item to the saved meal.")
  if (!input.name.trim()) throw new Error("Saved meal name is required.")
  const { data, error } = await supabase.rpc("save_saved_meal", {
    p_meal_id: id ?? null,
    p_name: input.name.trim(),
    p_default_meal_type: input.defaultMealType,
    p_items: input.items.map((item) => ({
      name: item.name.trim(),
      calories: item.calories,
      proteinG: item.proteinG,
    })),
  })
  return requireData(data, error, "Could not save the meal.") as string
}

export async function deleteSavedMeal(userId: string, id: string) {
  const { error } = await supabase.from("saved_meals").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function logSavedMeal(userId: string, meal: SavedMeal, mealType?: FoodEntryInput["mealType"]) {
  await insertFoodEntries(userId, savedMealToFoodInputs(meal, mealType))
}

export async function deleteFoodEntry(userId: string, id: string) {
  const { error } = await supabase.from("food_entries").delete().eq("id", id).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function setDailyFoodLogComplete(userId: string, date: string, isComplete: boolean) {
  if (date > toLocalDateKey()) throw new Error("Future food logs cannot be marked complete.")
  const { error } = await supabase.from("daily_food_log_status").upsert({
    user_id: userId,
    date,
    is_complete: isComplete,
    completed_at: isComplete ? new Date().toISOString() : null,
  }, { onConflict: "user_id,date" })
  if (error) throw new Error(error.message)
}

export async function setAdaptiveCalorieEnabled(userId: string, enabled: boolean) {
  const { error } = await supabase.from("profiles").update({ adaptive_calorie_enabled: enabled }).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function createCalorieReview(userId: string, goal: Profile["goal"], result: AdaptiveReviewResult) {
  if (result.status === "insufficient_data") throw new Error("There is not enough data for a calorie review yet.")
  const { data, error } = await supabase.from("calorie_reviews").insert({
    user_id: userId,
    goal,
    period_start: result.periodStart,
    period_end: result.periodEnd,
    previous_weight_avg: result.previousWeightAverage,
    current_weight_avg: result.currentWeightAverage,
    weight_change_kg: result.weightTrendKg,
    weight_change_percent: result.weightTrendPercent,
    complete_food_days: result.dataQuality.completeFoodDays,
    weight_entry_count: result.dataQuality.weightEntries,
    average_calories: result.averageCalories,
    current_target: result.currentTarget,
    suggested_target: result.suggestedTarget,
    status: result.status,
    reason_code: result.reasonCode,
  }).select("*").single()
  if (error) throw new Error(error.message)
  return data as CalorieReview
}

export async function dismissCalorieReview(userId: string, reviewId: string) {
  const { error } = await supabase.from("calorie_reviews").update({ dismissed_at: new Date().toISOString() }).eq("id", reviewId).eq("user_id", userId).is("accepted_at", null).is("dismissed_at", null)
  if (error) throw new Error(error.message)
}

export async function acceptCalorieReview(reviewId: string) {
  const { error } = await supabase.rpc("accept_calorie_review", { p_review_id: reviewId })
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

export async function saveEquipmentSettings(userId: string, input: EquipmentSettingsInput) {
  if (input.hasAdjustableDumbbells && (input.dumbbellMaxKg === null || input.dumbbellMaxKg <= 0)) {
    throw new Error("Enter a valid maximum dumbbell weight.")
  }
  const { error } = await supabase.from("profiles").update({
    has_adjustable_dumbbells: input.hasAdjustableDumbbells,
    dumbbell_max_kg: input.hasAdjustableDumbbells ? input.dumbbellMaxKg : null,
    has_bench: input.hasBench,
    has_pull_up_bar: input.hasPullUpBar,
  }).eq("user_id", userId)
  if (error) throw new Error(error.message)
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

export async function saveExerciseSet(
  userId: string,
  sessionId: string,
  exerciseName: string,
  setNumber: number,
  weightKg: number | null,
  reps: number,
  sessionExerciseId?: string | null,
) {
  const { data, error } = await supabase.from("exercise_sets").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      session_exercise_id: sessionExerciseId ?? null,
      exercise_name: exerciseName,
      set_number: setNumber,
      weight_kg: weightKg,
      reps,
    },
    { onConflict: "session_id,exercise_name,set_number" },
  ).select("*").single()
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
