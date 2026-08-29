import assert from "node:assert/strict"
import test from "node:test"
import { nutrientsForEditedGrams, rangeForEditedTotal } from "../src/lib/food-estimate.ts"
import { MAX_FOOD_IMAGE_BYTES, validateFoodImage } from "../src/lib/food-image.ts"
import { MAX_IMAGE_BYTES } from "../supabase/functions/_shared/food-analysis/config.ts"
import { parseMealImage, validateVisionMeal, visionToParsedMeal } from "../supabase/functions/_shared/food-analysis/image-parser.ts"
import { validateImageMetadata, validateImageRequest } from "../supabase/functions/_shared/food-analysis/image-validation.ts"
import { canUseImageWholeDishMatch } from "../supabase/functions/_shared/food-analysis/matching.ts"
import { applyImageUncertainty, resolveUSDAItem } from "../supabase/functions/_shared/food-analysis/nutrition.ts"
import { resolveParsedMeal } from "../supabase/functions/_shared/food-analysis/resolver.ts"
import type { FoodEstimate, VisionMealResult } from "../supabase/functions/_shared/food-analysis/types.ts"

const item = {
  name: "white rice, cooked", displayName: "White rice", estimatedGrams: 120,
  portionDescription: "about half a bowl", preparation: "cooked", confidence: "medium" as const,
  fallbackCalories: 156, fallbackProteinG: 3.2, fallbackCalorieLow: 130, fallbackCalorieHigh: 190,
}

function vision(overrides: Partial<VisionMealResult> = {}): VisionMealResult {
  return {
    status: "ok", mealName: "Cai Fan", items: [item], overallConfidence: "medium",
    wholeDishConfidence: "medium", portionConfidence: "medium", uncertainties: ["Sauce amount is difficult to see."],
    ...overrides,
  }
}

test("client accepts supported food image formats including HEIC and HEIF", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
    assert.equal(validateFoodImage({ name: `meal.${type.split("/")[1]}`, type, size: 1000 }).mimeType, type)
  }
  assert.equal(validateFoodImage({ name: "iphone.HEIC", type: "", size: 1000 }).mimeType, "image/heic")
})

test("client and server reject unsupported or oversized images", () => {
  assert.match(validateFoodImage({ name: "meal.gif", type: "image/gif", size: 1000 }).error, /JPEG/)
  assert.match(validateFoodImage({ name: "meal.jpg", type: "image/jpeg", size: MAX_FOOD_IMAGE_BYTES + 1 }).error, /too large/)
  assert.throws(() => validateImageMetadata("image/gif", 1000), /JPEG/)
  assert.throws(() => validateImageMetadata("image/jpeg", MAX_IMAGE_BYTES + 1), /too large/)
  assert.equal(validateImageRequest({ imageBase64: "YWJj", mimeType: "image/png", note: "half portion" }).note, "half portion")
})

test("vision results validate ok, no-food, and too-uncertain states", () => {
  assert.equal(validateVisionMeal(vision()).status, "ok")
  assert.equal(validateVisionMeal(vision({ status: "no_food", mealName: "", items: [], overallConfidence: "low", uncertainties: ["No food is visible."] })).status, "no_food")
  assert.equal(validateVisionMeal(vision({ status: "too_uncertain", mealName: "", items: [], overallConfidence: "low" })).status, "too_uncertain")
  assert.throws(() => validateVisionMeal({ ...vision(), items: [{ name: "rice" }] }))
  assert.throws(() => validateVisionMeal(vision({ status: "no_food" })))
})

test("visual items transform into the shared resolver input", () => {
  const parsed = visionToParsedMeal(vision())
  assert.equal(parsed.mealName, "Cai Fan")
  assert.equal(parsed.items[0].name, "white rice, cooked")
  assert.equal(parsed.items[0].estimatedGrams, 120)
})

test("photo whole-dish personal matching requires strong dish and portion confidence", () => {
  assert.equal(canUseImageWholeDishMatch(vision({ overallConfidence: "high", wholeDishConfidence: "high", portionConfidence: "high", uncertainties: [] })), true)
  assert.equal(canUseImageWholeDishMatch(vision({ overallConfidence: "high", wholeDishConfidence: "high", portionConfidence: "medium", uncertainties: [] })), false)
  assert.equal(canUseImageWholeDishMatch(vision({ overallConfidence: "high", wholeDishConfidence: "high", portionConfidence: "high", uncertainties: ["Portion size is unclear."] })), false)
})

test("optional note and inline image are included in the mocked Gemini request", async () => {
  let requestBody: { contents?: Array<{ parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> }> } = {}
  const mockFetch: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(vision()) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } })
  }
  await parseMealImage("YWJj", "image/jpeg", "half rice, no skin", "test-key", mockFetch)
  const parts = requestBody.contents?.[0]?.parts ?? []
  assert.equal(parts[0].inlineData?.mimeType, "image/jpeg")
  assert.equal(parts[0].inlineData?.data, "YWJj")
  assert.match(parts[1].text ?? "", /half rice, no skin/)
})

test("visual items use USDA, AI fallback, and mixed provenance through the shared resolver", async () => {
  const parsed = visionToParsedMeal(vision({ items: [item, { ...item, name: "curry gravy", displayName: "Curry gravy" }] }))
  const estimate = await resolveParsedMeal(parsed, "mock", async (query) => query.includes("rice") ? { fdcId: 1, description: "Rice, cooked", dataType: "Foundation", score: 0.9, caloriesPer100g: 130, proteinPer100g: 2.7 } : null)
  assert.deepEqual(estimate.items.map((entry) => entry.source), ["usda", "ai_estimate"])
  assert.equal(estimate.source, "mixed")
})

test("image uncertainty widens ranges and keeps the estimate central", () => {
  const usdaItem = resolveUSDAItem(item, { fdcId: 1, description: "Rice", dataType: "Foundation", score: 1, caloriesPer100g: 130, proteinPer100g: 2.7 })
  const base: FoodEstimate = { mealName: "Rice", totalCalories: usdaItem.calories, totalProteinG: usdaItem.proteinG, calorieRange: usdaItem.calorieRange, confidence: "medium", source: "usda", sourceSummary: "USDA", items: [usdaItem] }
  const imageEstimate = applyImageUncertainty(base, "low")
  assert.ok(imageEstimate.calorieRange.low < base.calorieRange.low)
  assert.ok(imageEstimate.calorieRange.high > base.calorieRange.high)
  assert.ok(imageEstimate.calorieRange.low <= imageEstimate.totalCalories && imageEstimate.totalCalories <= imageEstimate.calorieRange.high)
  assert.equal(imageEstimate.confidence, "low")
})

test("editing USDA grams recalculates while a manual calorie override remains central", () => {
  const usdaItem = resolveUSDAItem(item, { fdcId: 1, description: "Rice", dataType: "Foundation", score: 1, caloriesPer100g: 130, proteinPer100g: 2.7 })
  assert.equal(nutrientsForEditedGrams(usdaItem, 150).calories, 195)
  const manualRange = rangeForEditedTotal(usdaItem.calorieRange, usdaItem.calories, 220)
  assert.ok(manualRange.low <= 220 && 220 <= manualRange.high)
})
