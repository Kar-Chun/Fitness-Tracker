import { FOOD_PARSER_MODEL, GEMINI_REQUEST_TIMEOUT_MS } from "./config.ts"
import { FoodAnalysisError } from "./errors.ts"

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }
interface GeminiGenerateContentResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }

export function extractGeminiStructuredOutput(response: unknown) {
  if (!response || typeof response !== "object") return null
  const candidates = (response as GeminiGenerateContentResponse).candidates
  if (!Array.isArray(candidates)) return null
  for (const candidate of candidates) {
    const parts = candidate.content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (typeof part.text !== "string") continue
      try { return JSON.parse(part.text) as unknown } catch { continue }
    }
  }
  return null
}

export async function generateGeminiStructured(parts: GeminiPart[], instructions: string, responseJsonSchema: object, apiKey: string, request: typeof fetch = fetch, timeoutMs = GEMINI_REQUEST_TIMEOUT_MS) {
  let response: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FOOD_PARSER_MODEL)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema, maxOutputTokens: 2000, temperature: 0.2 },
      }),
    })
  } catch {
    if (controller.signal.aborted) throw new FoodAnalysisError("gemini_timeout", "Gemini took too long to respond. Please try again.", 504)
    throw new FoodAnalysisError("gemini_unavailable", "The meal estimator could not reach Gemini. Please try again.", 503)
  } finally {
    clearTimeout(timeout)
  }
  if (response.status === 429) throw new FoodAnalysisError("gemini_rate_limited", "Gemini is temporarily rate limited. Please try again shortly.", 503)
  if (response.status === 401 || response.status === 403) throw new FoodAnalysisError("gemini_authentication_failed", "The Gemini API key is invalid or is not permitted to use this model.", 500)
  if (!response.ok) throw new FoodAnalysisError("gemini_unavailable", "The Gemini food interpreter is temporarily unavailable. Please try again.", 502)

  let body: unknown
  try { body = await response.json() } catch { throw new FoodAnalysisError("malformed_ai_response", "Gemini returned an unreadable response. Please try again.", 502) }
  const output = extractGeminiStructuredOutput(body)
  if (!output) throw new FoodAnalysisError("malformed_ai_response", "Gemini did not return a usable food interpretation. Please try again.", 502)
  return output
}
