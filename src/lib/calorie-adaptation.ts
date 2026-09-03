import type { CalorieReview, CalorieReviewStatus, CalorieTarget, DailyFoodLogStatus, FoodEntry, Goal, WeightEntry } from "../types/fitness.ts"
import { addLocalDateKeyDays, isLocalDateKeyWithin, toLocalDateKey } from "./date.ts"

// Product heuristics for general wellness feedback. These are not medical thresholds.
export const ADAPTIVE_CALORIE_CONFIG = {
  reviewDays: 14,
  windowDays: 7,
  minWeightEntries: 8,
  minWeightEntriesPerWindow: 3,
  minCompleteFoodDays: 10,
  minCompleteFoodDaysPerWindow: 4,
  adjustmentStepKcal: 100,
  maxCumulativeAdjustmentKcal: 200,
  reviewCooldownDays: 7,
  maintenanceTolerancePercent: 0.25,
  lossFlatThresholdPercent: -0.15,
  lossFastThresholdPercent: -1,
  gainFlatThresholdPercent: 0.15,
  gainFastThresholdPercent: 0.75,
} as const

export type CalorieReviewReasonCode =
  | "insufficient_data"
  | "review_cooldown"
  | "loss_on_track"
  | "loss_first_stall"
  | "loss_stalled_two_reviews"
  | "loss_too_fast"
  | "maintain_on_track"
  | "maintain_first_drift_up"
  | "maintain_first_drift_down"
  | "maintain_drift_up_two_reviews"
  | "maintain_drift_down_two_reviews"
  | "gain_on_track"
  | "gain_first_stall"
  | "gain_stalled_two_reviews"
  | "gain_too_fast"
  | "adjustment_cap_reached"

export interface AdaptiveReviewResult {
  status: CalorieReviewStatus | "insufficient_data"
  reasonCode: CalorieReviewReasonCode
  currentTarget: number
  suggestedTarget: number | null
  adjustment: number
  periodStart: string
  periodEnd: string
  previousWeightAverage: number | null
  currentWeightAverage: number | null
  weightTrendKg: number | null
  weightTrendPercent: number | null
  averageCalories: number | null
  dataQuality: {
    label: "Building" | "Enough data" | "Strong data"
    completeFoodDays: number
    previousWindowCompleteFoodDays: number
    currentWindowCompleteFoodDays: number
    weightEntries: number
    previousWindowWeightEntries: number
    currentWindowWeightEntries: number
  }
  cooldownDaysRemaining: number
}

interface ReviewInput {
  goal: Goal
  currentTarget: number
  targetHistory: CalorieTarget[]
  weights: WeightEntry[]
  foodEntries: FoodEntry[]
  foodStatuses: DailyFoodLogStatus[]
  previousReviews: CalorieReview[]
  endDate?: string
  now?: Date
}

export function getSevenDayWeightAverage(entries: WeightEntry[], start: string, end: string) {
  const values = entries.filter((entry) => isLocalDateKeyWithin(entry.recorded_on, start, end) && entry.weight_kg > 0).map((entry) => entry.weight_kg)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function calculateWeightTrend(previousAverage: number, currentAverage: number) {
  const changeKg = currentAverage - previousAverage
  return { changeKg, changePercent: (changeKg / previousAverage) * 100 }
}

export function getAverageCompleteDayCalories(entries: FoodEntry[], statuses: DailyFoodLogStatus[], start: string, end: string) {
  const dates = new Set(statuses.filter((status) => status.is_complete && isLocalDateKeyWithin(status.date, start, end)).map((status) => status.date))
  if (!dates.size) return null
  const total = entries.reduce((sum, entry) => {
    const date = toLocalDateKey(new Date(entry.eaten_at))
    return dates.has(date) ? sum + entry.calories : sum
  }, 0)
  return Math.round(total / dates.size)
}

function baselineTarget(history: CalorieTarget[], currentTarget: number) {
  const baseline = history
    .filter((target) => target.reason === "initial_estimate" || target.reason === "profile_recalculation")
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at))[0]
  return baseline?.calories ?? currentTarget
}

function isMatchingOffTargetReview(review: CalorieReview, goal: Goal, direction: "up" | "down" | "stall") {
  if (review.goal !== goal) return false
  if (goal === "lose") return direction === "stall" && ["loss_first_stall", "loss_stalled_two_reviews"].includes(review.reason_code)
  if (goal === "gain") return direction === "stall" && ["gain_first_stall", "gain_stalled_two_reviews"].includes(review.reason_code)
  if (direction === "up") return ["maintain_first_drift_up", "maintain_drift_up_two_reviews"].includes(review.reason_code)
  if (direction === "down") return ["maintain_first_drift_down", "maintain_drift_down_two_reviews"].includes(review.reason_code)
  return false
}

export function clampSuggestedTarget(currentTarget: number, adjustment: number, baseline: number) {
  const minimum = baseline - ADAPTIVE_CALORIE_CONFIG.maxCumulativeAdjustmentKcal
  const maximum = baseline + ADAPTIVE_CALORIE_CONFIG.maxCumulativeAdjustmentKcal
  const requested = currentTarget + adjustment
  return requested < minimum || requested > maximum ? null : requested
}

export function getAdaptiveRecommendation(goal: Goal, trendPercent: number, previousReviews: CalorieReview[]) {
  const previous = [...previousReviews].sort((a, b) => b.period_end.localeCompare(a.period_end))[0]
  if (goal === "lose") {
    if (trendPercent <= ADAPTIVE_CALORIE_CONFIG.lossFastThresholdPercent) return { status: "suggest_increase", adjustment: 100, reasonCode: "loss_too_fast" } as const
    if (trendPercent < ADAPTIVE_CALORIE_CONFIG.lossFlatThresholdPercent) return { status: "on_track", adjustment: 0, reasonCode: "loss_on_track" } as const
    if (previous && isMatchingOffTargetReview(previous, goal, "stall")) return { status: "suggest_decrease", adjustment: -100, reasonCode: "loss_stalled_two_reviews" } as const
    return { status: "watch", adjustment: 0, reasonCode: "loss_first_stall" } as const
  }
  if (goal === "gain") {
    if (trendPercent >= ADAPTIVE_CALORIE_CONFIG.gainFastThresholdPercent) return { status: "suggest_decrease", adjustment: -100, reasonCode: "gain_too_fast" } as const
    if (trendPercent > ADAPTIVE_CALORIE_CONFIG.gainFlatThresholdPercent) return { status: "on_track", adjustment: 0, reasonCode: "gain_on_track" } as const
    if (previous && isMatchingOffTargetReview(previous, goal, "stall")) return { status: "suggest_increase", adjustment: 100, reasonCode: "gain_stalled_two_reviews" } as const
    return { status: "watch", adjustment: 0, reasonCode: "gain_first_stall" } as const
  }
  if (Math.abs(trendPercent) <= ADAPTIVE_CALORIE_CONFIG.maintenanceTolerancePercent) return { status: "on_track", adjustment: 0, reasonCode: "maintain_on_track" } as const
  const direction = trendPercent > 0 ? "up" : "down"
  if (previous && isMatchingOffTargetReview(previous, goal, direction)) {
    return direction === "up"
      ? { status: "suggest_decrease", adjustment: -100, reasonCode: "maintain_drift_up_two_reviews" } as const
      : { status: "suggest_increase", adjustment: 100, reasonCode: "maintain_drift_down_two_reviews" } as const
  }
  return direction === "up"
    ? { status: "watch", adjustment: 0, reasonCode: "maintain_first_drift_up" } as const
    : { status: "watch", adjustment: 0, reasonCode: "maintain_first_drift_down" } as const
}

export function evaluateCalorieReview(input: ReviewInput): AdaptiveReviewResult {
  const now = input.now ?? new Date()
  const periodEnd = input.endDate ?? toLocalDateKey(now)
  const periodStart = addLocalDateKeyDays(periodEnd, -(ADAPTIVE_CALORIE_CONFIG.reviewDays - 1))
  const previousEnd = addLocalDateKeyDays(periodStart, ADAPTIVE_CALORIE_CONFIG.windowDays - 1)
  const currentStart = addLocalDateKeyDays(previousEnd, 1)
  const relevantWeights = input.weights.filter((entry) => isLocalDateKeyWithin(entry.recorded_on, periodStart, periodEnd) && entry.weight_kg > 0)
  const previousWeights = relevantWeights.filter((entry) => entry.recorded_on <= previousEnd)
  const currentWeights = relevantWeights.filter((entry) => entry.recorded_on >= currentStart)
  const completeStatuses = input.foodStatuses.filter((status) => status.is_complete && isLocalDateKeyWithin(status.date, periodStart, periodEnd))
  const previousComplete = completeStatuses.filter((status) => status.date <= previousEnd)
  const currentComplete = completeStatuses.filter((status) => status.date >= currentStart)
  const quality: AdaptiveReviewResult["dataQuality"]["label"] = relevantWeights.length >= 12 && completeStatuses.length >= 12 ? "Strong data" : relevantWeights.length >= ADAPTIVE_CALORIE_CONFIG.minWeightEntries && completeStatuses.length >= ADAPTIVE_CALORIE_CONFIG.minCompleteFoodDays ? "Enough data" : "Building"
  const latestReview = [...input.previousReviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const cooldownMs = ADAPTIVE_CALORIE_CONFIG.reviewCooldownDays * 86_400_000
  const elapsed = latestReview ? now.getTime() - new Date(latestReview.created_at).getTime() : cooldownMs
  const cooldownDaysRemaining = Math.max(0, Math.ceil((cooldownMs - elapsed) / 86_400_000))
  const previousAverage = getSevenDayWeightAverage(previousWeights, periodStart, previousEnd)
  const currentAverage = getSevenDayWeightAverage(currentWeights, currentStart, periodEnd)
  const weightTrend = previousAverage !== null && currentAverage !== null
    ? calculateWeightTrend(previousAverage, currentAverage)
    : null
  const averageCalories = getAverageCompleteDayCalories(input.foodEntries, completeStatuses, periodStart, periodEnd)
  const base = {
    currentTarget: input.currentTarget,
    suggestedTarget: null,
    adjustment: 0,
    periodStart,
    periodEnd,
    previousWeightAverage: previousAverage,
    currentWeightAverage: currentAverage,
    weightTrendKg: weightTrend?.changeKg ?? null,
    weightTrendPercent: weightTrend?.changePercent ?? null,
    averageCalories,
    dataQuality: {
      label: quality,
      completeFoodDays: completeStatuses.length,
      previousWindowCompleteFoodDays: previousComplete.length,
      currentWindowCompleteFoodDays: currentComplete.length,
      weightEntries: relevantWeights.length,
      previousWindowWeightEntries: previousWeights.length,
      currentWindowWeightEntries: currentWeights.length,
    },
    cooldownDaysRemaining,
  }
  const enough = relevantWeights.length >= ADAPTIVE_CALORIE_CONFIG.minWeightEntries
    && previousWeights.length >= ADAPTIVE_CALORIE_CONFIG.minWeightEntriesPerWindow
    && currentWeights.length >= ADAPTIVE_CALORIE_CONFIG.minWeightEntriesPerWindow
    && completeStatuses.length >= ADAPTIVE_CALORIE_CONFIG.minCompleteFoodDays
    && previousComplete.length >= ADAPTIVE_CALORIE_CONFIG.minCompleteFoodDaysPerWindow
    && currentComplete.length >= ADAPTIVE_CALORIE_CONFIG.minCompleteFoodDaysPerWindow
    && previousAverage !== null && currentAverage !== null && averageCalories !== null
  if (!enough) return { ...base, status: "insufficient_data", reasonCode: "insufficient_data" }
  if (cooldownDaysRemaining > 0) return { ...base, status: "insufficient_data", reasonCode: "review_cooldown" }

  const recommendation = getAdaptiveRecommendation(input.goal, base.weightTrendPercent!, input.previousReviews)
  if (!recommendation.adjustment) return { ...base, ...recommendation, suggestedTarget: null }
  const suggestedTarget = clampSuggestedTarget(input.currentTarget, recommendation.adjustment, baselineTarget(input.targetHistory, input.currentTarget))
  if (suggestedTarget === null) return { ...base, status: "review_goal", reasonCode: "adjustment_cap_reached" }
  return { ...base, ...recommendation, suggestedTarget }
}

export const CALORIE_REVIEW_MESSAGES: Record<CalorieReviewReasonCode, string> = {
  insufficient_data: "Keep logging complete food days and weight to build a reliable trend.",
  review_cooldown: "Your latest review is still current. Another review will be available soon.",
  loss_on_track: "Your recent weight trend is moving in the intended direction. Keep your current calorie target.",
  loss_first_stall: "Your recent trend has been fairly flat. Keep the target for another review before changing it.",
  loss_stalled_two_reviews: "Your trend has stayed flat across two reviews. A small calorie reduction may help.",
  loss_too_fast: "Your recent weight trend is moving down quickly. Consider a slightly higher target.",
  maintain_on_track: "Your recent weight trend is within the maintenance range. Keep your current target.",
  maintain_first_drift_up: "Your trend has moved up. Keep the current target for another review before changing it.",
  maintain_first_drift_down: "Your trend has moved down. Keep the current target for another review before changing it.",
  maintain_drift_up_two_reviews: "Your trend has continued upward across two reviews. A small calorie reduction may help.",
  maintain_drift_down_two_reviews: "Your trend has continued downward across two reviews. A small calorie increase may help.",
  gain_on_track: "Your recent weight trend is moving in the intended direction. Keep your current calorie target.",
  gain_first_stall: "Your recent trend has been fairly flat. Keep the target for another review before changing it.",
  gain_stalled_two_reviews: "Your trend has stayed flat across two reviews. A small calorie increase may help.",
  gain_too_fast: "Your recent weight trend is moving up quickly. Consider a slightly lower target.",
  adjustment_cap_reached: "Your trend still differs from your goal. Review your profile, activity level, or goal instead of making another adaptive adjustment.",
}
