import { supabase } from "../lib/supabase.ts"
import { calculateCalorieTarget } from "../lib/calculations.ts"
import { daysAgo, toLocalDateKey } from "../lib/date.ts"
import { DEFAULT_WORKOUT_TEMPLATES } from "../lib/workout-templates.ts"
import {
  copyMealToNow,
  normalizeFoodName,
  repeatFoodInput,
  savedMealToFoodInputs,
} from "../lib/food-history.ts"
import type {
  CalorieTarget,
  ExerciseSet,
  FavouriteFood,
  FavouriteFoodInput,
  FitnessData,
  FoodEntry,
  FoodEntryInput,
  FoodEstimate,
  FoodEstimateLogInput,
  OnboardingInput,
  Profile,
  SavedMeal,
  SavedMealInput,
  SavedMealItem,
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
  const [targetResult, foodResult, favouriteResult, savedMealResult, weightResult, templateResult, sessionResult] = await Promise.all([
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

  const firstError = [targetResult, foodResult, favouriteResult, savedMealResult, weightResult, templateResult, sessionResult].find(
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
  type SavedMealRow = Omit<SavedMeal, "items"> & {
    saved_meal_items: SavedMealItem[]
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
    foodEntries: foodResult.data as FoodEntry[],
    favouriteFoods: favouriteResult.data as FavouriteFood[],
    savedMeals,
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
  if (error) {
    let message = error.message || "Could not analyze this meal."
    const context = "context" in error ? error.context : null
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: { message?: string } }
        message = body.error?.message ?? message
      } catch {
        // The standard function error message is still useful when the response is not JSON.
      }
    }
    throw new Error(message)
  }
  if (!isFoodEstimate(data)) throw new Error("The meal estimate response was incomplete. Please try again.")
  return data
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

export async function repeatFoodEntry(userId: string, entry: FoodEntry, now = new Date()) {
  await insertFoodEntries(userId, [repeatFoodInput(entry, now)])
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

export async function saveSavedMeal(userId: string, input: SavedMealInput, id?: string) {
  if (!input.items.length) throw new Error("Add at least one item to the saved meal.")
  const mealPayload = {
    user_id: userId,
    name: input.name.trim(),
    default_meal_type: input.defaultMealType,
  }
  let mealId = id
  if (mealId) {
    const { error } = await supabase.from("saved_meals").update(mealPayload).eq("id", mealId).eq("user_id", userId)
    if (error) throw new Error(error.message)
    const { error: deleteError } = await supabase.from("saved_meal_items").delete().eq("saved_meal_id", mealId).eq("user_id", userId)
    if (deleteError) throw new Error(deleteError.message)
  } else {
    const { data, error } = await supabase.from("saved_meals").insert(mealPayload).select("id").single()
    mealId = (requireData(data, error, "Could not create the saved meal.") as { id: string }).id
  }

  const items = input.items.map((item, position) => ({
    user_id: userId,
    saved_meal_id: mealId,
    name: item.name.trim(),
    calories: item.calories,
    protein_g: item.proteinG,
    position,
  }))
  const { error: itemError } = await supabase.from("saved_meal_items").insert(items)
  if (itemError) {
    if (!id) await supabase.from("saved_meals").delete().eq("id", mealId).eq("user_id", userId)
    throw new Error(itemError.message)
  }
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
