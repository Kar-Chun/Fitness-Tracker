import { createClient } from "npm:@supabase/supabase-js@2"
import { MAX_IMAGE_BYTES } from "../_shared/food-analysis/config.ts"
import { FoodAnalysisError } from "../_shared/food-analysis/errors.ts"
import { parseMealImage, visionToParsedMeal } from "../_shared/food-analysis/image-parser.ts"
import { validateImageRequest } from "../_shared/food-analysis/image-validation.ts"
import { canUseImageWholeDishMatch, findPersonalMatch } from "../_shared/food-analysis/matching.ts"
import { applyImageUncertainty, buildPersonalEstimate } from "../_shared/food-analysis/nutrition.ts"
import { resolveParsedMeal } from "../_shared/food-analysis/resolver.ts"
import type { FavouriteFood, HistoryFood, SavedMeal } from "../_shared/food-analysis/types.ts"

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }) }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json({ error: { code: "method_not_allowed", message: "Use POST for image analysis." } }, 405)
  try {
    const authorization = request.headers.get("Authorization")
    if (!authorization) throw new FoodAnalysisError("authentication_required", "Sign in before analyzing a meal photo.", 401)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    if (!supabaseUrl || !supabaseAnonKey) throw new FoodAnalysisError("server_not_configured", "The food analysis service is not configured.", 500)
    const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) throw new FoodAnalysisError("authentication_required", "Your session is not valid. Please sign in again.", 401)

    const contentLength = Number(request.headers.get("Content-Length") ?? 0)
    const maximumEncodedRequestBytes = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 16_384
    if (Number.isFinite(contentLength) && contentLength > maximumEncodedRequestBytes) throw new FoodAnalysisError("image_too_large", "This photo is too large. Choose a smaller photo or take another one.", 413)
    let payload: unknown
    try { payload = await request.json() } catch { throw new FoodAnalysisError("invalid_request", "Send a valid meal photo.", 400) }
    const image = validateImageRequest(payload)
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

    const geminiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiKey) throw new FoodAnalysisError("gemini_not_configured", "Photo analysis is not configured. Add the GEMINI_API_KEY Edge Function secret.", 500)
    const vision = await parseMealImage(image.imageBase64, image.mimeType, image.note, geminiKey)
    if (vision.status === "no_food") return json({ status: "no_food", message: "We couldn't identify a meal in this photo.", uncertainties: vision.uncertainties })
    if (vision.status === "too_uncertain") return json({ status: "too_uncertain", message: "We can see food, but there isn't enough information for a useful estimate.", uncertainties: vision.uncertainties })

    if (canUseImageWholeDishMatch(vision)) {
      const personalMatch = findPersonalMatch(vision.mealName, history, favourites, savedMeals)
      if (personalMatch) {
        const estimate = applyImageUncertainty(buildPersonalEstimate(personalMatch), vision.portionConfidence)
        return json({ status: "ok", estimate, uncertainties: vision.uncertainties })
      }
    }
    const estimate = applyImageUncertainty(await resolveParsedMeal(visionToParsedMeal(vision), Deno.env.get("USDA_API_KEY") ?? ""), vision.portionConfidence)
    return json({ status: "ok", estimate, uncertainties: vision.uncertainties })
  } catch (error) {
    if (error instanceof FoodAnalysisError) return json({ error: { code: error.code, message: error.message } }, error.status)
    return json({ error: { code: "analysis_failed", message: "The meal photo could not be estimated. Please try again." } }, 500)
  }
})
