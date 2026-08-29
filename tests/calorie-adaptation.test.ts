import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateWeightTrend,
  evaluateCalorieReview,
  getAdaptiveRecommendation,
  getAverageCompleteDayCalories,
  getSevenDayWeightAverage,
} from "../src/lib/calorie-adaptation.ts"
import type { CalorieReview, CalorieTarget, DailyFoodLogStatus, FoodEntry, Goal, WeightEntry } from "../src/types/fitness.ts"

const dates = ["2026-08-16", "2026-08-17", "2026-08-19", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-25", "2026-08-27", "2026-08-28", "2026-08-29"]

function weight(date: string, value: number): WeightEntry {
  return { id: date, user_id: "user", weight_kg: value, recorded_on: date, created_at: `${date}T08:00:00Z` }
}

function status(date: string, complete = true): DailyFoodLogStatus {
  return { id: date, user_id: "user", date, is_complete: complete, completed_at: complete ? `${date}T22:00:00Z` : null, created_at: `${date}T22:00:00Z`, updated_at: `${date}T22:00:00Z` }
}

function food(date: string, calories: number): FoodEntry {
  return { id: date, user_id: "user", name: "Food", calories, protein_g: null, meal_type: "dinner", eaten_at: `${date}T12:00:00Z`, created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`, source: "manual", confidence: null, estimate_low_calories: null, estimate_high_calories: null }
}

function target(calories = 2100, reason = "initial_estimate"): CalorieTarget {
  return { id: `${calories}-${reason}`, user_id: "user", calories, effective_from: "2026-08-01", reason, created_at: "2026-08-01T00:00:00Z" }
}

function review(goal: Goal, reasonCode: string, createdAt = "2026-08-15T00:00:00Z"): CalorieReview {
  return { id: reasonCode, user_id: "user", goal, period_start: "2026-08-01", period_end: "2026-08-14", previous_weight_avg: 72, current_weight_avg: 72, weight_change_kg: 0, weight_change_percent: 0, complete_food_days: 10, weight_entry_count: 8, average_calories: 2100, current_target: 2100, suggested_target: null, status: "watch", reason_code: reasonCode, created_at: createdAt, accepted_at: null, dismissed_at: createdAt }
}

function input(goal: Goal, secondWeekDeltaKg: number, previousReviews: CalorieReview[] = [], currentTarget = 2100, targetHistory = [target()]) {
  const weights = dates.slice(0, 5).map((date) => weight(date, 72)).concat(dates.slice(5).map((date) => weight(date, 72 + secondWeekDeltaKg)))
  return { goal, currentTarget, targetHistory, weights, foodEntries: dates.map((date) => food(date, 2050)), foodStatuses: dates.map((date) => status(date)), previousReviews, endDate: "2026-08-29", now: new Date("2026-08-29T12:00:00Z") }
}

test("sparse valid weigh-ins produce the correct seven-day mean and trend", () => {
  const average = getSevenDayWeightAverage([weight("2026-08-16", 72), weight("2026-08-18", 71), weight("2026-08-22", 73)], "2026-08-16", "2026-08-22")
  assert.equal(average, 72)
  assert.deepEqual(calculateWeightTrend(72, 71.64), { changeKg: -0.35999999999999943, changePercent: -0.4999999999999992 })
})

test("only complete food days contribute to average calories", () => {
  const entries = [food("2026-08-16", 2000), food("2026-08-17", 1000)]
  assert.equal(getAverageCompleteDayCalories(entries, [status("2026-08-16"), status("2026-08-17", false)], "2026-08-16", "2026-08-22"), 2000)
  assert.equal(getAverageCompleteDayCalories(entries, [status("2026-08-16"), status("2026-08-17")], "2026-08-16", "2026-08-22"), 1500)
})

test("too few weights or complete days produces insufficient data", () => {
  const fewWeights = input("lose", -0.3)
  fewWeights.weights = fewWeights.weights.slice(0, 7)
  assert.equal(evaluateCalorieReview(fewWeights).status, "insufficient_data")
  const fewFoodDays = input("lose", -0.3)
  fewFoodDays.foodStatuses = fewFoodDays.foodStatuses.slice(0, 9)
  assert.equal(evaluateCalorieReview(fewFoodDays).status, "insufficient_data")
})

test("loss goal keeps an appropriate downward trend", () => {
  assert.equal(evaluateCalorieReview(input("lose", -0.3)).reasonCode, "loss_on_track")
})

test("loss goal watches the first flat review and reduces only after a second", () => {
  assert.equal(evaluateCalorieReview(input("lose", 0)).status, "watch")
  const result = evaluateCalorieReview(input("lose", 0, [review("lose", "loss_first_stall")]))
  assert.equal(result.status, "suggest_decrease")
  assert.equal(result.adjustment, -100)
  assert.equal(result.suggestedTarget, 2000)
})

test("rapid loss suggests a small increase", () => {
  const result = evaluateCalorieReview(input("lose", -0.9))
  assert.equal(result.status, "suggest_increase")
  assert.equal(result.suggestedTarget, 2200)
})

test("maintenance ignores small movement and reacts only to repeated directional drift", () => {
  assert.equal(evaluateCalorieReview(input("maintain", 0.1)).status, "on_track")
  assert.equal(evaluateCalorieReview(input("maintain", 0.4)).status, "watch")
  assert.equal(evaluateCalorieReview(input("maintain", 0.4, [review("maintain", "maintain_first_drift_up")])).status, "suggest_decrease")
  assert.equal(evaluateCalorieReview(input("maintain", -0.4, [review("maintain", "maintain_first_drift_down")])).status, "suggest_increase")
})

test("gain goal keeps a useful rise and increases only after two flat reviews", () => {
  assert.equal(evaluateCalorieReview(input("gain", 0.3)).status, "on_track")
  assert.equal(evaluateCalorieReview(input("gain", 0)).status, "watch")
  assert.equal(evaluateCalorieReview(input("gain", 0, [review("gain", "gain_first_stall")])).status, "suggest_increase")
})

test("rapid gain suggests a small decrease", () => {
  assert.equal(evaluateCalorieReview(input("gain", 0.7)).status, "suggest_decrease")
})

test("the formula baseline caps cumulative adaptation without mutating target history", () => {
  const history = [target(2100), target(2000, "adaptive_review"), target(1900, "adaptive_review")]
  const snapshot = structuredClone(history)
  const result = evaluateCalorieReview(input("lose", 0, [review("lose", "loss_first_stall")], 1900, history))
  assert.equal(result.status, "review_goal")
  assert.deepEqual(history, snapshot)
})

test("a recent review enforces the seven-day cooldown", () => {
  const result = evaluateCalorieReview(input("lose", 0, [review("lose", "loss_first_stall", "2026-08-26T00:00:00Z")]))
  assert.equal(result.reasonCode, "review_cooldown")
  assert.ok(result.cooldownDaysRemaining > 0)
})

test("a goal change does not carry the old goal's review streak", () => {
  const recommendation = getAdaptiveRecommendation("maintain", 0.5, [review("lose", "loss_first_stall")])
  assert.equal(recommendation.reasonCode, "maintain_first_drift_up")
})
