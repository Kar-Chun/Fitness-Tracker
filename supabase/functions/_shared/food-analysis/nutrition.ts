import type { EstimateConfidence, EstimateSource, FoodEstimate, ItemSource, ParsedFoodItem, ParsedMeal, PersonalMatch, ResolvedFoodItem, USDANutrient, USDAFoodMatch } from "./types.ts"

export function extractNutrientsPer100g(nutrients: USDANutrient[]) {
  let caloriesPer100g = 0
  let proteinPer100g = 0
  nutrients.forEach((entry) => {
    const name = (entry.nutrientName ?? entry.nutrient?.name ?? "").toLowerCase()
    const number = entry.nutrientNumber ?? entry.nutrient?.number ?? ""
    const value = entry.value ?? entry.amount ?? 0
    const unit = (entry.unitName ?? entry.nutrient?.unitName ?? "").toLowerCase()
    if ((["1008", "2047", "2048"].includes(number) || name.startsWith("energy")) && (unit.includes("kcal") || !unit)) caloriesPer100g = value
    if (number === "1003" || name === "protein") proteinPer100g = value
  })
  return { caloriesPer100g, proteinPer100g }
}

export function nutrientsForGrams(caloriesPer100g: number, proteinPer100g: number, grams: number) {
  const factor = Math.max(0, grams) / 100
  return { calories: Math.round(caloriesPer100g * factor), proteinG: Math.round(proteinPer100g * factor * 10) / 10 }
}

function uncertaintyFactor(source: ItemSource, confidence: EstimateConfidence) {
  if (source === "history" || source === "favourite" || source === "saved_meal") return 0.08
  if (source === "ai_estimate") return confidence === "low" ? 0.4 : 0.3
  return confidence === "high" ? 0.12 : confidence === "medium" ? 0.2 : 0.3
}

export function resolveUSDAItem(item: ParsedFoodItem, match: USDAFoodMatch): ResolvedFoodItem {
  const nutrients = nutrientsForGrams(match.caloriesPer100g, match.proteinPer100g, item.estimatedGrams)
  const factor = uncertaintyFactor("usda", item.confidence)
  return {
    name: item.displayName, portionDescription: item.portionDescription, estimatedGrams: item.estimatedGrams,
    calories: nutrients.calories, proteinG: nutrients.proteinG,
    calorieRange: { low: Math.max(1, Math.round(nutrients.calories * (1 - factor))), high: Math.max(nutrients.calories, Math.round(nutrients.calories * (1 + factor))) },
    source: "usda", confidence: item.confidence, caloriesPer100g: match.caloriesPer100g, proteinPer100g: match.proteinPer100g,
  }
}

export function resolveAIItem(item: ParsedFoodItem): ResolvedFoodItem {
  const calories = Math.max(1, Math.round(item.fallbackCalories))
  return {
    name: item.displayName, portionDescription: item.portionDescription, estimatedGrams: item.estimatedGrams,
    calories, proteinG: Math.max(0, Math.round(item.fallbackProteinG * 10) / 10),
    calorieRange: { low: Math.max(1, Math.min(calories, Math.round(item.fallbackCalorieLow))), high: Math.max(calories, Math.round(item.fallbackCalorieHigh)) },
    source: "ai_estimate", confidence: item.confidence === "high" ? "medium" : item.confidence, caloriesPer100g: null, proteinPer100g: null,
  }
}

export function determineEstimateSource(items: Pick<ResolvedFoodItem, "source">[]): EstimateSource {
  const sources = new Set(items.map((item) => item.source))
  if (sources.size === 1) return items[0]?.source ?? "ai_estimate"
  return "mixed"
}

export function determineConfidence(items: Pick<ResolvedFoodItem, "source" | "confidence">[]): EstimateConfidence {
  if (items.length === 1 && ["history", "favourite", "saved_meal"].includes(items[0].source)) return "high"
  const aiCount = items.filter((item) => item.source === "ai_estimate").length
  if (aiCount === 0) return "medium"
  if (aiCount >= Math.ceil(items.length / 2) || items.some((item) => item.confidence === "low")) return "low"
  return "medium"
}

function sourceSummary(items: ResolvedFoodItem[], source: EstimateSource) {
  if (source === "history") return "Based on a strong match in your food history."
  if (source === "favourite") return "Based on one of your favourite foods."
  if (source === "saved_meal") return "Based on one of your saved meals."
  if (source === "usda") return "Nutrition values matched generic USDA foods; portions are estimated."
  if (source === "ai_estimate") return "Nutrition could not be matched reliably, so this is an AI estimate."
  const estimated = items.filter((item) => item.source === "ai_estimate").map((item) => item.name)
  const matchedText = estimated.length < items.length / 2 ? "Most items matched nutrition data." : "Some items matched nutrition data; the rest needed an AI estimate."
  return `${matchedText} ${estimated.join(", ")} ${estimated.length === 1 ? "was" : "were"} estimated.`
}

export function buildEstimate(meal: ParsedMeal, items: ResolvedFoodItem[]): FoodEstimate {
  if (!items.length) throw new Error("No food items could be resolved.")
  const totalCalories = items.reduce((total, item) => total + item.calories, 0)
  const totalProteinG = Math.round(items.reduce((total, item) => total + item.proteinG, 0) * 10) / 10
  const source = determineEstimateSource(items)
  return {
    mealName: meal.mealName, totalCalories, totalProteinG,
    calorieRange: { low: items.reduce((total, item) => total + item.calorieRange.low, 0), high: items.reduce((total, item) => total + item.calorieRange.high, 0) },
    confidence: determineConfidence(items), source, sourceSummary: sourceSummary(items, source), items,
  }
}

export function buildPersonalEstimate(match: PersonalMatch): FoodEstimate {
  const calories = Math.max(1, Math.round(match.calories))
  const margin = Math.max(20, Math.round(calories * 0.08))
  const item: ResolvedFoodItem = {
    name: match.name, portionDescription: "Based on your previous value", estimatedGrams: 0, calories,
    proteinG: Math.round(match.proteinG * 10) / 10, calorieRange: { low: Math.max(1, calories - margin), high: calories + margin },
    source: match.source, confidence: "high", caloriesPer100g: null, proteinPer100g: null,
  }
  return { mealName: match.name, totalCalories: calories, totalProteinG: item.proteinG, calorieRange: item.calorieRange, confidence: "high", source: match.source, sourceSummary: match.note, items: [item] }
}

export function applyImageUncertainty(estimate: FoodEstimate, portionConfidence: EstimateConfidence): FoodEstimate {
  const factor = portionConfidence === "high" ? 0.18 : portionConfidence === "medium" ? 0.25 : 0.35
  const items = estimate.items.map((item) => ({
    ...item,
    calorieRange: {
      low: Math.max(1, Math.min(item.calorieRange.low, Math.round(item.calories * (1 - factor)))),
      high: Math.max(item.calorieRange.high, Math.round(item.calories * (1 + factor))),
    },
  }))
  const confidence: EstimateConfidence = portionConfidence === "low" || estimate.confidence === "low"
    ? "low"
    : estimate.confidence === "high" ? "medium" : estimate.confidence
  return {
    ...estimate,
    items,
    confidence,
    calorieRange: { low: items.reduce((total, item) => total + item.calorieRange.low, 0), high: items.reduce((total, item) => total + item.calorieRange.high, 0) },
    sourceSummary: `${estimate.sourceSummary} Photo-based portions have extra uncertainty.`,
  }
}
