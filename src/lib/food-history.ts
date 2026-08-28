import { toLocalDateTimeInput } from "./date.ts"
import { normalizeFoodName } from "../../supabase/functions/_shared/food-normalization.ts"
import type {
  FoodEntry,
  FoodEntryInput,
  FoodHistoryOption,
  MealType,
  SavedMeal,
  SavedMealItemInput,
} from "../types/fitness.ts"

export { normalizeFoodName }

export function groupFoodHistory(entries: Pick<FoodEntry, "name" | "calories" | "protein_g" | "meal_type" | "eaten_at">[]) {
  const groups = new Map<string, FoodHistoryOption>()
  const sorted = [...entries].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))

  sorted.forEach((entry) => {
    const key = normalizeFoodName(entry.name)
    if (!key) return
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      return
    }
    groups.set(key, {
      key,
      name: entry.name.trim(),
      calories: entry.calories,
      proteinG: entry.protein_g,
      mealType: entry.meal_type,
      lastUsedAt: entry.eaten_at,
      count: 1,
    })
  })

  return [...groups.values()]
}

export function getRecentFoods(entries: FoodEntry[], limit = 8) {
  return groupFoodHistory(entries)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit)
}

export function getFrequentFoods(entries: FoodEntry[], limit = 8) {
  return groupFoodHistory(entries)
    .sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit)
}

export function searchFoodHistory(entries: FoodEntry[], query: string, limit = 20) {
  const normalizedQuery = normalizeFoodName(query)
  if (!normalizedQuery) return []
  return groupFoodHistory(entries)
    .filter((option) => option.key.includes(normalizedQuery))
    .sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit)
}

export function historyOptionToFoodInput(
  option: Pick<FoodHistoryOption, "name" | "calories" | "proteinG" | "mealType">,
  now = new Date(),
): FoodEntryInput {
  return {
    name: option.name,
    calories: option.calories,
    proteinG: option.proteinG,
    mealType: option.mealType,
    eatenAt: toLocalDateTimeInput(now),
    source: "history",
  }
}

export function repeatFoodInput(
  entry: Pick<FoodEntry, "name" | "calories" | "protein_g" | "meal_type">,
  now = new Date(),
): FoodEntryInput {
  return historyOptionToFoodInput({
    name: entry.name,
    calories: entry.calories,
    proteinG: entry.protein_g,
    mealType: entry.meal_type,
  }, now)
}

export function savedMealTotal(items: Pick<SavedMealItemInput, "calories">[]) {
  return items.reduce((total, item) => total + item.calories, 0)
}

export function savedMealToFoodInputs(
  meal: Pick<SavedMeal, "default_meal_type" | "items">,
  mealType?: MealType,
  now = new Date(),
) {
  const eatenAt = toLocalDateTimeInput(now)
  return meal.items.map((item) => ({
    name: item.name,
    calories: item.calories,
    proteinG: item.protein_g,
    mealType: mealType ?? meal.default_meal_type ?? "snack",
    eatenAt,
    source: "saved_meal",
  })) satisfies FoodEntryInput[]
}

export function copyMealToNow(
  entries: Pick<FoodEntry, "name" | "calories" | "protein_g" | "meal_type">[],
  now = new Date(),
) {
  return entries.map((entry) => repeatFoodInput(entry, now))
}
