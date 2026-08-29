import { FoodAnalysisError } from "./errors.ts"
import { isConfidence, isParsedItem, parsedItemProperties, parsedItemPropertyOrder } from "./food-schema.ts"
import { generateGeminiStructured } from "./gemini-client.ts"
import type { ParsedMeal, VisionMealResult } from "./types.ts"

const visionItemOrder = [...parsedItemPropertyOrder.slice(0, 4), "preparation", ...parsedItemPropertyOrder.slice(4)]
const visionSchema = {
  type: "object", additionalProperties: false,
  propertyOrdering: ["status", "mealName", "items", "overallConfidence", "wholeDishConfidence", "portionConfidence", "uncertainties"],
  properties: {
    status: { type: "string", enum: ["ok", "no_food", "too_uncertain"] },
    mealName: { type: "string", description: "Short meal name, or an empty string when status is not ok." },
    items: {
      type: "array", minItems: 0, maxItems: 12,
      items: {
        type: "object", additionalProperties: false, propertyOrdering: visionItemOrder,
        properties: { ...parsedItemProperties, preparation: { type: "string", description: "Likely visible cooking method, or unknown." } },
        required: visionItemOrder,
      },
    },
    overallConfidence: { type: "string", enum: ["high", "medium", "low"] },
    wholeDishConfidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence that the complete named dish is correctly recognized." },
    portionConfidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence in the visible portion estimates." },
    uncertainties: { type: "array", minItems: 0, maxItems: 6, items: { type: "string" } },
  },
  required: ["status", "mealName", "items", "overallConfidence", "wholeDishConfidence", "portionConfidence", "uncertainties"],
} as const

const instructions = `Analyze one meal photo for a personal calorie diary.
Identify only foods visibly present, likely cooking methods, approximate edible portions in grams, and visually reasonable major sauces or oils. Recognize common Singapore dishes when justified.
Use status no_food for unrelated images. Use too_uncertain when food is visible but darkness, blur, coverage, overlapping dishes, buffet context, or unknown user portion prevents a useful estimate.
For status ok, return components with approximate grams and conservative confidence. Image portions are never measured values.
For every component provide fallback calories, protein, and a plausible calorie range. These are used only if a nutrition database cannot resolve that component. Do not calculate meal totals.
Do not give health advice, nutrition scores, or moral judgments. Do not invent hidden ingredients. Describe material uncertainty briefly.`

export function validateVisionMeal(value: unknown): VisionMealResult {
  if (!value || typeof value !== "object") throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an invalid image interpretation. Please try again.", 502)
  const result = value as Partial<VisionMealResult>
  const mealNameValid = typeof result.mealName === "string" && result.mealName.length <= 120
  const statusValid = result.status === "ok" || result.status === "no_food" || result.status === "too_uncertain"
  const uncertaintiesValid = Array.isArray(result.uncertainties) && result.uncertainties.length <= 6 && result.uncertainties.every((note) => typeof note === "string" && note.length <= 240)
  const confidenceValid = isConfidence(result.overallConfidence) && isConfidence(result.wholeDishConfidence) && isConfidence(result.portionConfidence)
  if (!statusValid || !mealNameValid || !uncertaintiesValid || !confidenceValid || !Array.isArray(result.items) || result.items.length > 12) {
    throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an incomplete image interpretation. Please try again.", 502)
  }
  if (result.status === "ok") {
    const itemsValid = result.items.length > 0 && result.items.every((item) => isParsedItem(item) && typeof item.preparation === "string" && item.preparation.length <= 80)
    if (typeof result.mealName !== "string" || !result.mealName.trim() || result.mealName.length > 120 || !itemsValid) {
      throw new FoodAnalysisError("malformed_ai_response", "Gemini returned incomplete food items for this photo. Please try again.", 502)
    }
  } else if (result.items.length > 0) {
    throw new FoodAnalysisError("malformed_ai_response", "Gemini returned conflicting image results. Please try again.", 502)
  }
  return result as VisionMealResult
}

export function visionToParsedMeal(result: VisionMealResult): ParsedMeal {
  if (result.status !== "ok") throw new FoodAnalysisError("image_not_resolvable", "This photo does not contain a resolvable meal.", 422)
  return { mealName: result.mealName, items: result.items, overallConfidence: result.overallConfidence }
}

export async function parseMealImage(imageBase64: string, mimeType: string, note: string, apiKey: string, request: typeof fetch = fetch) {
  const context = note ? `User context about their portion: ${note}` : "No additional user note was provided."
  const output = await generateGeminiStructured(
    [{ inlineData: { mimeType, data: imageBase64 } }, { text: context }],
    instructions,
    visionSchema,
    apiKey,
    request,
  )
  return validateVisionMeal(output)
}
