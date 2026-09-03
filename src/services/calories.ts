import { supabase } from "../lib/supabase.ts"
import { toLocalDateKey } from "../lib/date.ts"
import type { AdaptiveReviewResult } from "../lib/calorie-adaptation.ts"
import type { CalorieReview, CalorieTarget, FitnessData, Profile } from "../types/fitness.ts"

export type CalorieData = Pick<FitnessData, "calorieTarget" | "calorieTargetHistory" | "calorieReviews">

export async function loadCalorieData(userId: string): Promise<CalorieData> {
  const [targetResult, targetHistoryResult, reviewResult] = await Promise.all([
    supabase
      .from("calorie_targets")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", toLocalDateKey())
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("calorie_targets")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("calorie_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])
  const firstError = [targetResult, targetHistoryResult, reviewResult].find((result) => result.error)?.error
  if (firstError) throw new Error(firstError.message)
  return {
    calorieTarget: targetResult.data as CalorieTarget | null,
    calorieTargetHistory: targetHistoryResult.data as CalorieTarget[],
    calorieReviews: reviewResult.data as CalorieReview[],
  }
}

export async function setAdaptiveCalorieEnabled(userId: string, enabled: boolean) {
  const { error } = await supabase.from("profiles").update({ adaptive_calorie_enabled: enabled }).eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function createCalorieReview(userId: string, goal: Profile["goal"], result: AdaptiveReviewResult) {
  if (result.status === "insufficient_data") throw new Error("There is not enough data for a calorie review yet.")
  const { data, error } = await supabase.from("calorie_reviews").insert({
    user_id: userId,
    goal,
    period_start: result.periodStart,
    period_end: result.periodEnd,
    previous_weight_avg: result.previousWeightAverage,
    current_weight_avg: result.currentWeightAverage,
    weight_change_kg: result.weightTrendKg,
    weight_change_percent: result.weightTrendPercent,
    complete_food_days: result.dataQuality.completeFoodDays,
    weight_entry_count: result.dataQuality.weightEntries,
    average_calories: result.averageCalories,
    current_target: result.currentTarget,
    suggested_target: result.suggestedTarget,
    status: result.status,
    reason_code: result.reasonCode,
  }).select("*").single()
  if (error) throw new Error(error.message)
  return data as CalorieReview
}

export async function dismissCalorieReview(userId: string, reviewId: string) {
  const { error } = await supabase.from("calorie_reviews").update({ dismissed_at: new Date().toISOString() }).eq("id", reviewId).eq("user_id", userId).is("accepted_at", null).is("dismissed_at", null)
  if (error) throw new Error(error.message)
}

export async function acceptCalorieReview(reviewId: string) {
  const { error } = await supabase.rpc("accept_calorie_review", { p_review_id: reviewId })
  if (error) throw new Error(error.message)
}
