import { USDA_REQUEST_TIMEOUT_MS, USDA_SEARCH_RESULT_LIMIT } from "./config.ts"
import { FoodAnalysisError } from "./errors.ts"
import { rankUSDACandidates, scoreUSDACandidate } from "./matching.ts"
import type { USDANutrient, USDAFoodCandidate } from "./types.ts"

interface USDASearchResponse { foods?: USDAFoodCandidate[] }
interface USDAFoodDetails { fdcId?: number; description?: string; dataType?: string; foodNutrients?: USDANutrient[] }
async function readJSON(response: Response) {
  if (response.status === 429) throw new FoodAnalysisError("usda_rate_limit", "Nutrition lookup is temporarily rate limited.", 503)
  if (!response.ok) throw new FoodAnalysisError("usda_unavailable", "Nutrition lookup is temporarily unavailable.", 503)
  try { return await response.json() as unknown } catch {
    throw new FoodAnalysisError("usda_malformed_response", "Nutrition lookup returned an unreadable response.", 502)
  }
}
async function timedFetch(url: string, init: RequestInit | undefined, request: typeof fetch, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await request(url, { ...init, signal: controller.signal })
  } catch {
    if (controller.signal.aborted) throw new FoodAnalysisError("usda_timeout", "Nutrition lookup took too long to respond.", 504)
    throw new FoodAnalysisError("usda_unavailable", "Nutrition lookup is temporarily unavailable.", 503)
  } finally {
    clearTimeout(timeout)
  }
}
async function getFoodDetails(fdcId: number, apiKey: string, request: typeof fetch, timeoutMs: number): Promise<USDAFoodDetails | null> {
  const response = await timedFetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`, undefined, request, timeoutMs)
  const body = await readJSON(response)
  return body && typeof body === "object" ? body as USDAFoodDetails : null
}
export async function findUSDAFood(query: string, apiKey: string, request: typeof fetch = fetch, timeoutMs = USDA_REQUEST_TIMEOUT_MS) {
  if (!apiKey) throw new FoodAnalysisError("usda_not_configured", "Nutrition lookup is not configured.", 503)
  let response: Response
  try {
    response = await timedFetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, dataType: ["Foundation", "Survey (FNDDS)", "SR Legacy"], pageSize: USDA_SEARCH_RESULT_LIMIT }),
    }, request, timeoutMs)
  } catch (error) {
    if (error instanceof FoodAnalysisError) throw error
    throw new FoodAnalysisError("usda_unavailable", "Nutrition lookup is temporarily unavailable.", 503)
  }
  const body = await readJSON(response) as USDASearchResponse
  const candidates = Array.isArray(body.foods) ? body.foods : []
  const directMatch = rankUSDACandidates(query, candidates)
  if (directMatch) return directMatch
  const textualCandidate = [...candidates].map((candidate) => ({ candidate, score: scoreUSDACandidate(query, candidate) })).sort((a, b) => b.score - a.score)[0]
  if (!textualCandidate || textualCandidate.score < 0.45) return null
  const details = await getFoodDetails(textualCandidate.candidate.fdcId, apiKey, request, timeoutMs)
  if (!details?.foodNutrients) return null
  return rankUSDACandidates(query, [{ ...textualCandidate.candidate, description: details.description ?? textualCandidate.candidate.description, dataType: details.dataType ?? textualCandidate.candidate.dataType, foodNutrients: details.foodNutrients }])
}
