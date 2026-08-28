import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateCalorieTarget,
  caloriesRemaining,
  getWeightTrend,
  selectNextWorkoutName,
  weeklyCalorieAverage,
} from "../src/lib/calculations.ts"

test("calorie target uses Mifflin-St Jeor, activity, goal adjustment, and rounds to 10", () => {
  assert.equal(calculateCalorieTarget({ age: 30, sex: "male", heightCm: 180, weightKg: 80, goal: "maintain", activityLevel: "sedentary" }), 2140)
  assert.equal(calculateCalorieTarget({ age: 30, sex: "female", heightCm: 165, weightKg: 60, goal: "lose", activityLevel: "active" }), 1750)
})

test("remaining calories preserves over-target information", () => {
  assert.equal(caloriesRemaining(2100, 1420), 680)
  assert.equal(caloriesRemaining(2100, 2250), -150)
})

test("7-day weight trend requires three measurements and compares weekly averages", () => {
  const now = new Date(2026, 7, 28, 12)
  const entries = [
    { recorded_on: "2026-08-28", weight_kg: 79.6 },
    { recorded_on: "2026-08-25", weight_kg: 79.8 },
    { recorded_on: "2026-08-22", weight_kg: 80.0 },
    { recorded_on: "2026-08-21", weight_kg: 80.1 },
    { recorded_on: "2026-08-18", weight_kg: 80.2 },
    { recorded_on: "2026-08-15", weight_kg: 80.3 },
  ]
  const trend = getWeightTrend(entries, now)
  assert.equal(trend.latest, 79.6)
  assert.equal(trend.currentAverage, 79.8)
  assert.equal(trend.previousAverage, 80.2)
  assert.ok(Math.abs((trend.change ?? 0) + 0.4) < 0.0001)
  assert.equal(getWeightTrend(entries.slice(0, 2), now).currentAverage, null)
})

test("weekly calorie average counts logged days rather than unlogged days", () => {
  const now = new Date(2026, 7, 28, 12)
  const entries = [
    { calories: 500, eaten_at: "2026-08-28T02:00:00.000Z" },
    { calories: 700, eaten_at: "2026-08-28T06:00:00.000Z" },
    { calories: 1800, eaten_at: "2026-08-27T06:00:00.000Z" },
  ]
  assert.equal(weeklyCalorieAverage(entries, now), 1500)
})

test("workouts alternate A and B based on the latest completed session", () => {
  assert.equal(selectNextWorkoutName([]), "Workout A")
  assert.equal(selectNextWorkoutName(["Workout A", "Workout B"]), "Workout B")
  assert.equal(selectNextWorkoutName(["Workout B", "Workout A"]), "Workout A")
})
