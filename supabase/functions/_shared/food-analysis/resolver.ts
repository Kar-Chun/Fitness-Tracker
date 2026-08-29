import { buildEstimate, resolveAIItem, resolveUSDAItem } from "./nutrition.ts"
import { findUSDAFood } from "./usda-client.ts"
import type { ParsedMeal, ResolvedFoodItem, USDAFoodMatch } from "./types.ts"

export type USDALookup = (query: string, apiKey: string) => Promise<USDAFoodMatch | null>
export async function resolveParsedMeal(meal: ParsedMeal, usdaApiKey: string, lookup: USDALookup = findUSDAFood) {
  const resolved: ResolvedFoodItem[] = []
  for (const item of meal.items) {
    try {
      const match = await lookup(item.name, usdaApiKey)
      resolved.push(match ? resolveUSDAItem(item, match) : resolveAIItem(item))
    } catch {
      resolved.push(resolveAIItem(item))
    }
  }
  return buildEstimate(meal, resolved)
}
