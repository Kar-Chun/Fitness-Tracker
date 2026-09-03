import { supabase } from "../lib/supabase.ts"
import { daysAgo, toLocalDateKey } from "../lib/date.ts"
import {
  copyMealToNow,
  normalizeFoodName,
  savedMealToFoodInputs,
} from "../lib/food-history.ts"
import { requireData } from "./shared.ts"
import type {
  DailyFoodLogStatus,
  FavouriteFood,
  FavouriteFoodInput,
  FitnessData,
  FoodEntry,
  FoodEntryInput,
  FoodEstimate,
  FoodEstimateLogInput,
  FoodImageAnalysisInput,
  FoodImageAnalysisResult,
  SavedMeal,
  SavedMealInput,
  SavedMealItem,
} from "../types/fitness.ts"

export type FoodData = Pick<FitnessData, "foodEntries" | "favouriteFoods" | "savedMeals" | "dailyFoodLogStatuses">
export type FoodDiaryData = Pick<FitnessData, "foodEntries" | "dailyFoodLogStatuses">

export async function loadFoodEntries(userId: string) {
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .eq("user_id", userId)
    .order("eaten_at", { ascending: false })
    .limit(1000)
  if (error) throw new Error(error.message)
  return data as FoodEntry[]
}

export async function loadFavouriteFoods(userId: string) {
  const { data, error } = await supabase
    .from("favourite_foods")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data as FavouriteFood[]
}

export async function loadSavedMeals(userId: string) {
  const { data, error } = await supabase
    .from("saved_meals")
    .select("*, saved_meal_items(*)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)

  type SavedMealRow = Omit<SavedMeal, "items"> & { saved_meal_items: SavedMealItem[] }
  return (data as SavedMealRow[]).map((meal) => ({
    id: meal.id,
    user_id: meal.user_id,
    name: meal.name,
    default_meal_type: meal.default_meal_type,
    created_at: meal.created_at,
    updated_at: meal.updated_at,
    items: [...meal.saved_meal_items].sort((a, b) => a.position - b.position),
  }))
}

export async function loadDailyFoodLogStatuses(userId: string) {
  const { data, error } = await supabase
    .from("daily_food_log_status")
    .select("*")
    .eq("user_id", userId)
    .gte("date", toLocalDateKey(daysAgo(60)))
    .order("date", { ascending: false })
  if (error) throw new Error(error.message)
  return data as DailyFoodLogStatus[]
}

export async function loadFoodDiaryData(userId: string): Promise<FoodDiaryData> {
  const [foodEntries, dailyFoodLogStatuses] = await Promise.all([
    loadFoodEntries(userId),
    loadDailyFoodLogStatuses(userId),
  ])
  return { foodEntries, dailyFoodLogStatuses }
}

export async function loadFoodData(userId: string): Promise<FoodData> {
  const [foodEntries, favouriteFoods, savedMeals, dailyFoodLogStatuses] = await Promise.all([
    loadFoodEntries(userId),
    loadFavouriteFoods(userId),
    loadSavedMeals(userId),
    loadDailyFoodLogStatuses(userId),
  ])
  return { foodEntries, favouriteFoods, savedMeals, dailyFoodLogStatuses }
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
  const { data, error } = await supabase.functions.invoke("analyze-food-text", { body: { description } })
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
    && Array.isArray(estimate.items) && estimate.items.length > 0
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
