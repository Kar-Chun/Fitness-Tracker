import { FoodAnalysisError } from "./errors.ts"
import type { EstimateConfidence, ParsedFoodItem, ParsedMeal } from "./types.ts"

export const parsedItemPropertyOrder = ["name", "displayName", "estimatedGrams", "portionDescription", "confidence", "fallbackCalories", "fallbackProteinG", "fallbackCalorieLow", "fallbackCalorieHigh"]
export const parsedItemProperties = {
  name: { type: "string", description: "Normalized generic food name suitable for nutrition lookup." },
  displayName: { type: "string", description: "Short user-facing name for this component." },
  estimatedGrams: { type: "number", minimum: 1, maximum: 3000 },
  portionDescription: { type: "string", description: "Plain-language description of the interpreted portion." },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  fallbackCalories: { type: "number", minimum: 1, maximum: 10000 },
  fallbackProteinG: { type: "number", minimum: 0, maximum: 1000 },
  fallbackCalorieLow: { type: "number", minimum: 1, maximum: 10000 },
  fallbackCalorieHigh: { type: "number", minimum: 1, maximum: 10000 },
} as const

export function isConfidence(value: unknown): value is EstimateConfidence { return value === "high" || value === "medium" || value === "low" }
export function isParsedItem(value: unknown): value is ParsedFoodItem {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<ParsedFoodItem>
  return typeof item.name === "string" && Boolean(item.name.trim()) && item.name.length <= 120
    && typeof item.displayName === "string" && Boolean(item.displayName.trim()) && item.displayName.length <= 120
    && typeof item.estimatedGrams === "number" && Number.isFinite(item.estimatedGrams) && item.estimatedGrams > 0 && item.estimatedGrams <= 3000
    && typeof item.portionDescription === "string" && Boolean(item.portionDescription.trim()) && item.portionDescription.length <= 120
    && isConfidence(item.confidence)
    && typeof item.fallbackCalories === "number" && Number.isFinite(item.fallbackCalories) && item.fallbackCalories > 0 && item.fallbackCalories <= 10000
    && typeof item.fallbackProteinG === "number" && Number.isFinite(item.fallbackProteinG) && item.fallbackProteinG >= 0 && item.fallbackProteinG <= 1000
    && typeof item.fallbackCalorieLow === "number" && Number.isFinite(item.fallbackCalorieLow) && item.fallbackCalorieLow > 0
    && typeof item.fallbackCalorieHigh === "number" && Number.isFinite(item.fallbackCalorieHigh) && item.fallbackCalorieHigh <= 10000
    && item.fallbackCalorieLow <= item.fallbackCalories && item.fallbackCalories <= item.fallbackCalorieHigh
}
export function validateParsedMeal(value: unknown): ParsedMeal {
  if (!value || typeof value !== "object") throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an invalid food interpretation. Please try again.", 502)
  const meal = value as Partial<ParsedMeal>
  if (typeof meal.mealName !== "string" || !meal.mealName.trim() || meal.mealName.length > 120 || !Array.isArray(meal.items) || !meal.items.length || meal.items.length > 12 || !meal.items.every(isParsedItem) || !isConfidence(meal.overallConfidence)) throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an incomplete food interpretation. Please try again.", 502)
  return meal as ParsedMeal
}
