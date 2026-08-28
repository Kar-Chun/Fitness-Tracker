import { FOOD_PARSER_MODEL } from "./config.ts"
import { FoodAnalysisError } from "./errors.ts"
import type { EstimateConfidence, ParsedFoodItem, ParsedMeal } from "./types.ts"

const itemPropertyOrder = [
  "name",
  "displayName",
  "estimatedGrams",
  "portionDescription",
  "confidence",
  "fallbackCalories",
  "fallbackProteinG",
  "fallbackCalorieLow",
  "fallbackCalorieHigh",
]

const mealSchema = {
  type: "object",
  additionalProperties: false,
  propertyOrdering: ["mealName", "items", "overallConfidence"],
  properties: {
    mealName: { type: "string", description: "A short display name for the complete meal." },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        propertyOrdering: itemPropertyOrder,
        properties: {
          name: { type: "string", description: "Normalized generic food name suitable for nutrition lookup." },
          displayName: { type: "string", description: "Short user-facing name for this component." },
          estimatedGrams: { type: "number", minimum: 1, maximum: 3000 },
          portionDescription: { type: "string", description: "Plain-language description of the interpreted portion." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          fallbackCalories: { type: "number", minimum: 1, maximum: 10000 },
          fallbackProteinG: { type: "number", minimum: 0, maximum: 1000 },
          fallbackCalorieLow: { type: "number", minimum: 1, maximum: 10000 },
          fallbackCalorieHigh: { type: "number", minimum: 1, maximum: 10000 },
        },
        required: itemPropertyOrder,
      },
    },
    overallConfidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["mealName", "items", "overallConfidence"],
} as const

const instructions = `You interpret short natural-language meal descriptions for a personal calorie diary.
Identify what was probably eaten, including Singapore and hawker foods such as cai fan, kopi, prata, nasi lemak, bak chor mee, and chicken rice.
Return ingredient or dish components with practical estimated gram weights and short portion descriptions.
For every component also provide a conservative fallback calorie estimate, protein estimate, and plausible calorie range. These fallbacks are used only if a nutrition database cannot match the food.
Do not calculate a meal total. Do not add foods that the user did not imply. Be conservative about uncertainty.`

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>
    }
  }>
}

export function extractGeminiStructuredOutput(response: unknown) {
  if (!response || typeof response !== "object") return null
  const candidates = (response as GeminiGenerateContentResponse).candidates
  if (!Array.isArray(candidates)) return null
  for (const candidate of candidates) {
    const parts = candidate.content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (typeof part.text !== "string") continue
      try {
        return JSON.parse(part.text) as unknown
      } catch {
        continue
      }
    }
  }
  return null
}

function isConfidence(value: unknown): value is EstimateConfidence {
  return value === "high" || value === "medium" || value === "low"
}

function isParsedItem(value: unknown): value is ParsedFoodItem {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<ParsedFoodItem>
  return typeof item.name === "string" && Boolean(item.name.trim()) && item.name.length <= 120
    && typeof item.displayName === "string" && Boolean(item.displayName.trim()) && item.displayName.length <= 120
    && typeof item.estimatedGrams === "number"
    && Number.isFinite(item.estimatedGrams) && item.estimatedGrams > 0 && item.estimatedGrams <= 3000
    && typeof item.portionDescription === "string" && Boolean(item.portionDescription.trim()) && item.portionDescription.length <= 120
    && isConfidence(item.confidence)
    && typeof item.fallbackCalories === "number"
    && Number.isFinite(item.fallbackCalories) && item.fallbackCalories > 0 && item.fallbackCalories <= 10000
    && typeof item.fallbackProteinG === "number" && Number.isFinite(item.fallbackProteinG) && item.fallbackProteinG >= 0 && item.fallbackProteinG <= 1000
    && typeof item.fallbackCalorieLow === "number" && Number.isFinite(item.fallbackCalorieLow) && item.fallbackCalorieLow > 0
    && typeof item.fallbackCalorieHigh === "number" && Number.isFinite(item.fallbackCalorieHigh) && item.fallbackCalorieHigh <= 10000
    && item.fallbackCalorieLow <= item.fallbackCalories
    && item.fallbackCalories <= item.fallbackCalorieHigh
}

export function validateParsedMeal(value: unknown): ParsedMeal {
  if (!value || typeof value !== "object") throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an invalid food interpretation. Please try again.", 502)
  const meal = value as Partial<ParsedMeal>
  if (typeof meal.mealName !== "string" || !meal.mealName.trim() || meal.mealName.length > 120 || !Array.isArray(meal.items) || !meal.items.length || meal.items.length > 12 || !meal.items.every(isParsedItem) || !isConfidence(meal.overallConfidence)) {
    throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an incomplete food interpretation. Please try again.", 502)
  }
  return meal as ParsedMeal
}

export async function parseMealDescription(
  description: string,
  apiKey: string,
  request: typeof fetch = fetch,
) {
  let response: Response
  try {
    response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FOOD_PARSER_MODEL)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: description }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: mealSchema,
          maxOutputTokens: 1600,
          temperature: 0.2,
        },
      }),
    })
  } catch {
    throw new FoodAnalysisError("gemini_unavailable", "The meal estimator could not reach Gemini. Please try again.", 503)
  }

  if (response.status === 429) {
    throw new FoodAnalysisError("gemini_rate_limited", "Gemini is temporarily rate limited. Please try again shortly.", 503)
  }
  if (response.status === 401 || response.status === 403) {
    throw new FoodAnalysisError("gemini_authentication_failed", "The Gemini API key is invalid or is not permitted to use this model.", 500)
  }
  if (!response.ok) {
    throw new FoodAnalysisError("gemini_unavailable", "The Gemini food interpreter is temporarily unavailable. Please try again.", 502)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an unreadable response. Please try again.", 502)
  }
  const structuredOutput = extractGeminiStructuredOutput(body)
  if (!structuredOutput) throw new FoodAnalysisError("malformed_ai_response", "Gemini did not return a usable food interpretation. Please try again.", 502)
  return validateParsedMeal(structuredOutput)
}
