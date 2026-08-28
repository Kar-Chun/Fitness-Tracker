import { USDA_SEARCH_RESULT_LIMIT } from "./config.ts"
import { FoodAnalysisError } from "./errors.ts"
import { rankUSDACandidates, scoreUSDACandidate } from "./matching.ts"
import type { USDANutrient, USDAFoodCandidate } from "./types.ts"

interface USDASearchResponse {
  foods?: USDAFoodCandidate[]
}

interface USDAFoodDetails {
  fdcId?: number
  description?: string
  dataType?: string
  foodNutrients?: USDANutrient[]
}

async function readJSON(response: Response) {
  if (response.status === 429) throw new FoodAnalysisError("usda_rate_limit", "Nutrition lookup is temporarily rate limited.", 503)
  if (!response.ok) throw new FoodAnalysisError("usda_unavailable", "Nutrition lookup is temporarily unavailable.", 503)
  return response.json() as Promise<unknown>
}

async function getFoodDetails(fdcId: number, apiKey: string): Promise<USDAFoodDetails | null> {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`)
  const body = await readJSON(response)
  return body && typeof body === "object" ? body as USDAFoodDetails : null
}

export async function findUSDAFood(query: string, apiKey: string) {
  if (!apiKey) throw new FoodAnalysisError("usda_not_configured", "Nutrition lookup is not configured.", 503)
  let response: Response
  try {
    response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        dataType: ["Foundation", "Survey (FNDDS)", "SR Legacy"],
        pageSize: USDA_SEARCH_RESULT_LIMIT,
      }),
    })
  } catch {
    throw new FoodAnalysisError("usda_unavailable", "Nutrition lookup is temporarily unavailable.", 503)
  }
  const body = await readJSON(response) as USDASearchResponse
  const candidates = Array.isArray(body.foods) ? body.foods : []
  const directMatch = rankUSDACandidates(query, candidates)
  if (directMatch) return directMatch

  const textualCandidate = [...candidates]
    .map((candidate) => ({ candidate, score: scoreUSDACandidate(query, candidate) }))
    .sort((a, b) => b.score - a.score)[0]
  if (!textualCandidate || textualCandidate.score < 0.45) return null
  const details = await getFoodDetails(textualCandidate.candidate.fdcId, apiKey)
  if (!details?.foodNutrients) return null
  return rankUSDACandidates(query, [{
    ...textualCandidate.candidate,
    description: details.description ?? textualCandidate.candidate.description,
    dataType: details.dataType ?? textualCandidate.candidate.dataType,
    foodNutrients: details.foodNutrients,
  }])
}
