import { normalizeFoodName } from "../food-normalization.ts"
import { extractNutrientsPer100g } from "./nutrition.ts"
import type { FavouriteFood, HistoryFood, PersonalMatch, SavedMeal, USDAFoodCandidate, USDAFoodMatch, VisionMealResult } from "./types.ts"

const GENERIC_DATA_TYPES = new Set(["Foundation", "Survey (FNDDS)", "SR Legacy"])
const IMPORTANT_TERMS = ["cooked", "fried", "raw", "boiled", "grilled", "roasted"]
const UNRELATED_PRODUCT_TERMS = ["cracker", "sandwich", "cereal", "snack", "cookie", "bar", "chips", "frozen"]
const MEAL_MODIFIERS = ["no skin", "without skin", "less rice", "half rice", "extra rice", "less sauce"]

function normalizeMealLookup(value: string) {
  let normalized = normalizeFoodName(value)
  MEAL_MODIFIERS.forEach((modifier) => { normalized = normalized.replace(new RegExp(`\\b${modifier}\\b`, "g"), " ") })
  return normalized.replace(/\s+/g, " ").trim()
}

export function findPersonalMatch(query: string, history: HistoryFood[], favourites: FavouriteFood[], savedMeals: SavedMeal[]): PersonalMatch | null {
  const normalizedQuery = normalizeMealLookup(query)
  if (!normalizedQuery) return null
  const historyMatch = [...history].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at)).find((entry) => normalizeMealLookup(entry.name) === normalizedQuery)
  if (historyMatch) return { name: historyMatch.name, calories: historyMatch.calories, proteinG: historyMatch.protein_g ?? 0, source: "history", note: `Based on your previous ${historyMatch.name} entry.` }
  const favourite = favourites.find((entry) => normalizeMealLookup(entry.name) === normalizedQuery)
  if (favourite) return { name: favourite.name, calories: favourite.calories, proteinG: favourite.protein_g ?? 0, source: "favourite", note: `Based on your ${favourite.name} favourite.` }
  const savedMeal = savedMeals.find((meal) => normalizeMealLookup(meal.name) === normalizedQuery)
  if (savedMeal?.saved_meal_items.length) return {
    name: savedMeal.name,
    calories: savedMeal.saved_meal_items.reduce((total, item) => total + item.calories, 0),
    proteinG: savedMeal.saved_meal_items.reduce((total, item) => total + (item.protein_g ?? 0), 0),
    source: "saved_meal", note: `Based on your saved meal ${savedMeal.name}.`,
  }
  return null
}

export function canUseImageWholeDishMatch(result: VisionMealResult) {
  return result.status === "ok"
    && result.overallConfidence === "high"
    && result.wholeDishConfidence === "high"
    && result.portionConfidence === "high"
    && !result.uncertainties.some((note) => /portion|amount|shared|covered|size/i.test(note))
}

function tokens(value: string) { return new Set(normalizeFoodName(value).split(/[^a-z0-9]+/).filter((token) => token.length > 1)) }
export function scoreUSDACandidate(query: string, candidate: USDAFoodCandidate) {
  const normalizedQuery = normalizeFoodName(query)
  const normalizedDescription = normalizeFoodName(candidate.description)
  const queryTokens = tokens(query)
  const candidateTokens = tokens(candidate.description)
  const intersection = [...queryTokens].filter((token) => candidateTokens.has(token)).length
  const union = new Set([...queryTokens, ...candidateTokens]).size
  const recall = queryTokens.size ? intersection / queryTokens.size : 0
  const jaccard = union ? intersection / union : 0
  let score = recall * 0.55 + jaccard * 0.25
  if (normalizedDescription === normalizedQuery) score += 0.35
  else if (normalizedDescription.includes(normalizedQuery)) score += 0.15
  if (GENERIC_DATA_TYPES.has(candidate.dataType)) score += 0.15
  if (candidate.brandOwner || candidate.dataType.toLowerCase().includes("branded")) score -= 0.3
  IMPORTANT_TERMS.forEach((term) => { if (normalizedQuery.includes(term) && !normalizedDescription.includes(term)) score -= 0.22 })
  UNRELATED_PRODUCT_TERMS.forEach((term) => { if (!normalizedQuery.includes(term) && normalizedDescription.includes(term)) score -= 0.16 })
  return score
}

export function rankUSDACandidates(query: string, candidates: USDAFoodCandidate[]): USDAFoodMatch | null {
  const ranked = candidates.map((candidate) => ({ candidate, score: scoreUSDACandidate(query, candidate), nutrients: extractNutrientsPer100g(candidate.foodNutrients ?? []) }))
    .filter((result) => result.nutrients.caloriesPer100g > 0).sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best || best.score < 0.45) return null
  return { fdcId: best.candidate.fdcId, description: best.candidate.description, dataType: best.candidate.dataType, score: best.score, caloriesPer100g: best.nutrients.caloriesPer100g, proteinPer100g: best.nutrients.proteinPer100g }
}
