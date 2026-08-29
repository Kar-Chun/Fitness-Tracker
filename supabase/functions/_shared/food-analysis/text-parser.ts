import { parsedItemProperties, parsedItemPropertyOrder, validateParsedMeal } from "./food-schema.ts"
import { generateGeminiStructured } from "./gemini-client.ts"

const mealSchema = {
  type: "object", additionalProperties: false, propertyOrdering: ["mealName", "items", "overallConfidence"],
  properties: {
    mealName: { type: "string", description: "A short display name for the complete meal." },
    items: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, propertyOrdering: parsedItemPropertyOrder, properties: parsedItemProperties, required: parsedItemPropertyOrder } },
    overallConfidence: { type: "string", enum: ["high", "medium", "low"] },
  }, required: ["mealName", "items", "overallConfidence"],
} as const
const instructions = `You interpret short natural-language meal descriptions for a personal calorie diary.
Identify what was probably eaten, including Singapore and hawker foods such as cai fan, kopi, prata, nasi lemak, bak chor mee, and chicken rice.
Return ingredient or dish components with practical estimated gram weights and short portion descriptions.
For every component also provide a conservative fallback calorie estimate, protein estimate, and plausible calorie range. These fallbacks are used only if a nutrition database cannot match the food.
Do not calculate a meal total. Do not add foods that the user did not imply. Be conservative about uncertainty.`

export async function parseMealDescription(description: string, apiKey: string, request: typeof fetch = fetch) {
  return validateParsedMeal(await generateGeminiStructured([{ text: description }], instructions, mealSchema, apiKey, request))
}
export { extractGeminiStructuredOutput } from "./gemini-client.ts"
export { validateParsedMeal } from "./food-schema.ts"
