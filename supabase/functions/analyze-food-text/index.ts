import { createClient } from "npm:@supabase/supabase-js@2"
import { MAX_DESCRIPTION_LENGTH } from "../_shared/food-analysis/config.ts"
import { FoodAnalysisError } from "../_shared/food-analysis/errors.ts"
import { findPersonalMatch } from "../_shared/food-analysis/matching.ts"
import { buildPersonalEstimate } from "../_shared/food-analysis/nutrition.ts"
import { resolveParsedMeal } from "../_shared/food-analysis/resolver.ts"
import { parseMealDescription } from "../_shared/food-analysis/text-parser.ts"
import type { FavouriteFood, HistoryFood, SavedMeal } from "../_shared/food-analysis/types.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed", message: "Use POST for food analysis." } }, 405)

  try {
    const authorization = request.headers.get("Authorization")
    if (!authorization) throw new FoodAnalysisError("authentication_required", "Sign in before analyzing food.", 401)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    if (!supabaseUrl || !supabaseAnonKey) throw new FoodAnalysisError("server_not_configured", "The food analysis service is not configured.", 500)

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) throw new FoodAnalysisError("authentication_required", "Your session is not valid. Please sign in again.", 401)

    let payload: unknown
    try { payload = await request.json() } catch { throw new FoodAnalysisError("invalid_request", "Send a valid meal description.", 400) }
    const description = payload && typeof payload === "object" ? (payload as { description?: unknown }).description : null
    if (typeof description !== "string" || !description.trim()) throw new FoodAnalysisError("invalid_request", "Describe what you ate before analyzing.", 400)
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) throw new FoodAnalysisError("input_too_long", `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`, 400)

    const [historyResult, favouriteResult, savedMealResult] = await Promise.all([
      client.from("food_entries").select("name, calories, protein_g, eaten_at").order("eaten_at", { ascending: false }).limit(200),
      client.from("favourite_foods").select("name, normalized_name, calories, protein_g"),
      client.from("saved_meals").select("name, saved_meal_items(name, calories, protein_g)"),
    ])
    const personalError = historyResult.error ?? favouriteResult.error ?? savedMealResult.error
    if (personalError) throw new FoodAnalysisError("personal_data_unavailable", "Your saved food data could not be checked. Please try again.", 503)
    const history = historyResult.data as HistoryFood[]
    const favourites = favouriteResult.data as FavouriteFood[]
    const savedMeals = savedMealResult.data as SavedMeal[]

    const directMatch = findPersonalMatch(description, history, favourites, savedMeals)
    if (directMatch) return json(buildPersonalEstimate(directMatch))

    const geminiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiKey) throw new FoodAnalysisError("gemini_not_configured", "AI meal analysis is not configured. Add the GEMINI_API_KEY Edge Function secret.", 500)
    const parsed = await parseMealDescription(description.trim(), geminiKey)
    const parsedMatch = findPersonalMatch(parsed.mealName, history, favourites, savedMeals)
    if (parsedMatch) return json(buildPersonalEstimate(parsedMatch))

    const estimate = await resolveParsedMeal(parsed, Deno.env.get("USDA_API_KEY") ?? "")
    return json(estimate)
  } catch (error) {
    if (error instanceof FoodAnalysisError) return json({ error: { code: error.code, message: error.message } }, error.status)
    return json({ error: { code: "analysis_failed", message: "The meal could not be estimated. Please try again." } }, 500)
  }
})
