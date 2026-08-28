import assert from "node:assert/strict"
import test from "node:test"
import { nutrientsForEditedGrams, totalsFromEstimateItems } from "../src/lib/food-estimate.ts"
import { extractGeminiStructuredOutput, parseMealDescription, validateParsedMeal } from "../supabase/functions/analyze-food-text/gemini-parser.ts"
import { FOOD_PARSER_MODEL } from "../supabase/functions/analyze-food-text/config.ts"
import { findPersonalMatch, rankUSDACandidates } from "../supabase/functions/analyze-food-text/matching.ts"
import { buildEstimate, buildPersonalEstimate, nutrientsForGrams, resolveAIItem, resolveUSDAItem } from "../supabase/functions/analyze-food-text/nutrition.ts"
import { resolveParsedMeal } from "../supabase/functions/analyze-food-text/resolver.ts"
import type { ParsedFoodItem, ParsedMeal, ResolvedFoodItem, USDAFoodCandidate, USDAFoodMatch } from "../supabase/functions/analyze-food-text/types.ts"

function parsedItem(overrides: Partial<ParsedFoodItem> = {}): ParsedFoodItem {
  return {
    name: "white rice, cooked",
    displayName: "White rice",
    estimatedGrams: 100,
    portionDescription: "about half a bowl",
    confidence: "high",
    fallbackCalories: 140,
    fallbackProteinG: 3,
    fallbackCalorieLow: 110,
    fallbackCalorieHigh: 180,
    ...overrides,
  }
}

function candidate(overrides: Partial<USDAFoodCandidate>): USDAFoodCandidate {
  return {
    fdcId: 1,
    description: "Rice, white, cooked",
    dataType: "Foundation",
    foodNutrients: [
      { nutrientNumber: "1008", unitName: "KCAL", value: 130 },
      { nutrientNumber: "1003", unitName: "G", value: 2.7 },
    ],
    ...overrides,
  }
}

function usdaMatch(overrides: Partial<USDAFoodMatch> = {}): USDAFoodMatch {
  return {
    fdcId: 1,
    description: "Rice, white, cooked",
    dataType: "Foundation",
    score: 0.9,
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    ...overrides,
  }
}

test("personal history matching is normalized, exact, and uses the latest value", () => {
  const match = findPersonalMatch(" CHICKEN   RICE no skin ", [
    { name: "Chicken Rice", calories: 630, protein_g: 28, eaten_at: "2026-08-20T04:00:00Z" },
    { name: "chicken rice", calories: 650, protein_g: 30, eaten_at: "2026-08-28T04:00:00Z" },
  ], [], [])
  assert.equal(match?.source, "history")
  assert.equal(match?.calories, 650)
  assert.equal(findPersonalMatch("chicken wrap", [{ name: "Chicken Rice", calories: 650, protein_g: 30, eaten_at: "2026-08-28T04:00:00Z" }], [], []), null)
})

test("schema-shaped Gemini data is accepted and malformed ranges are rejected", () => {
  const meal = { mealName: "Rice", items: [parsedItem()], overallConfidence: "medium" as const }
  assert.deepEqual(validateParsedMeal(meal), meal)
  assert.throws(() => validateParsedMeal({ ...meal, items: [parsedItem({ fallbackCalorieLow: 200, fallbackCalories: 100 })] }))
})

test("Gemini structured output is decoded from a generateContent response", () => {
  const meal = { mealName: "Cai Fan", items: [parsedItem()], overallConfidence: "medium" as const }
  assert.deepEqual(extractGeminiStructuredOutput({
    candidates: [{ content: { parts: [{ text: JSON.stringify(meal) }] } }],
  }), meal)
  assert.equal(extractGeminiStructuredOutput({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }), null)
})

test("Gemini parser requests schema-constrained JSON without making a live API call", async () => {
  const meal = { mealName: "Kopi C Kosong", items: [parsedItem({ name: "coffee with evaporated milk", displayName: "Kopi C Kosong" })], overallConfidence: "medium" as const }
  let requestedUrl = ""
  let requestedInit: RequestInit | undefined
  const mockFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input)
    requestedInit = init
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(meal) }] } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  assert.deepEqual(await parseMealDescription("kopi c kosong", "test-key", mockFetch), meal)
  assert.ok(requestedUrl.includes(`/models/${FOOD_PARSER_MODEL}:generateContent`))
  const headers = new Headers(requestedInit?.headers)
  assert.equal(headers.get("x-goog-api-key"), "test-key")
  const body = JSON.parse(String(requestedInit?.body)) as {
    generationConfig?: { responseMimeType?: string; responseJsonSchema?: unknown }
  }
  assert.equal(body.generationConfig?.responseMimeType, "application/json")
  assert.ok(body.generationConfig?.responseJsonSchema)
})

test("personal matching falls through to favourites and saved meals conservatively", () => {
  assert.equal(findPersonalMatch("protein shake", [], [{ name: "Protein Shake", normalized_name: "protein shake", calories: 180, protein_g: 25 }], [])?.source, "favourite")
  assert.equal(findPersonalMatch("usual breakfast", [], [], [{ name: "Usual Breakfast", saved_meal_items: [{ name: "Eggs", calories: 140, protein_g: 12 }, { name: "Toast", calories: 180, protein_g: 5 }] }])?.calories, 320)
})

test("USDA ranking prefers generic cooked rice over crackers and branded products", () => {
  const match = rankUSDACandidates("white rice cooked", [
    candidate({ fdcId: 2, description: "White rice crackers, snack", dataType: "Branded", brandOwner: "Snack Co" }),
    candidate({ fdcId: 3, description: "Rice, white, cooked", dataType: "Foundation" }),
  ])
  assert.equal(match?.fdcId, 3)
  assert.equal(rankUSDACandidates("curry chicken", [candidate({ description: "Frozen egg breakfast sandwich", dataType: "Branded", brandOwner: "Brand" })]), null)
})

test("nutrition math uses per-100g values and totals items", () => {
  assert.deepEqual(nutrientsForGrams(130, 2.7, 150), { calories: 195, proteinG: 4.1 })
  const rice = resolveUSDAItem(parsedItem({ estimatedGrams: 150 }), usdaMatch())
  const egg = resolveUSDAItem(parsedItem({ displayName: "Egg", estimatedGrams: 50 }), usdaMatch({ caloriesPer100g: 155, proteinPer100g: 13 }))
  const estimate = buildEstimate({ mealName: "Rice and egg", items: [], overallConfidence: "high" }, [rice, egg])
  assert.equal(estimate.totalCalories, 273)
  assert.equal(estimate.totalProteinG, 10.6)
})

test("editing grams recalculates USDA-backed nutrients and aggregate totals", () => {
  const rice = resolveUSDAItem(parsedItem(), usdaMatch())
  const edited = nutrientsForEditedGrams(rice, 150)
  assert.equal(edited.calories, 195)
  assert.equal(edited.proteinG, 4.1)
  assert.deepEqual(totalsFromEstimateItems([edited]), { calories: 195, proteinG: 4.1, calorieRange: edited.calorieRange })
})

test("confidence, range, and provenance stay conservative", () => {
  const history = buildPersonalEstimate({ name: "Chicken Rice", calories: 650, proteinG: 30, source: "history", note: "Previous entry" })
  assert.equal(history.confidence, "high")
  assert.equal(history.source, "history")

  const usda = resolveUSDAItem(parsedItem(), usdaMatch())
  const ai = resolveAIItem(parsedItem({ displayName: "Curry gravy", confidence: "medium" }))
  const allUSDA = buildEstimate({ mealName: "Rice", items: [], overallConfidence: "high" }, [usda])
  const allAI = buildEstimate({ mealName: "Gravy", items: [], overallConfidence: "low" }, [ai])
  const mixed = buildEstimate({ mealName: "Cai Fan", items: [], overallConfidence: "medium" }, [usda, usda, ai])

  assert.equal(allUSDA.source, "usda")
  assert.equal(allUSDA.confidence, "medium")
  assert.equal(allAI.source, "ai_estimate")
  assert.equal(allAI.confidence, "low")
  assert.equal(mixed.source, "mixed")
  assert.equal(mixed.confidence, "medium")
  for (const estimate of [history, allUSDA, allAI, mixed]) {
    assert.ok(estimate.calorieRange.low <= estimate.totalCalories)
    assert.ok(estimate.totalCalories <= estimate.calorieRange.high)
  }
  assert.ok((allAI.calorieRange.high - allAI.calorieRange.low) / allAI.totalCalories > (history.calorieRange.high - history.calorieRange.low) / history.totalCalories)
})

test("resolver accepts a mocked USDA lookup and falls back without network calls", async () => {
  const meal: ParsedMeal = { mealName: "Rice and gravy", overallConfidence: "medium", items: [parsedItem(), parsedItem({ name: "curry gravy", displayName: "Curry gravy" })] }
  const estimate = await resolveParsedMeal(meal, "mock-key", async (query) => query.includes("rice") ? usdaMatch() : null)
  assert.equal(estimate.source, "mixed")
  assert.deepEqual(estimate.items.map((item: ResolvedFoodItem) => item.source), ["usda", "ai_estimate"])
})
