import type { ActivityLevel, FoodEntry, Goal, Sex, WeightEntry } from "../types/fitness.ts"
import { daysAgo, startOfLocalDay, toLocalDateKey } from "./date.ts"

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
}

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -300,
  maintain: 0,
  gain: 250,
}

export function calculateCalorieTarget(input: {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  goal: Goal
  activityLevel: ActivityLevel
}) {
  const sexAdjustment = input.sex === "male" ? 5 : -161
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + sexAdjustment
  const maintenance = bmr * ACTIVITY_MULTIPLIERS[input.activityLevel]
  return Math.round((maintenance + GOAL_ADJUSTMENTS[input.goal]) / 10) * 10
}

export function caloriesConsumed(entries: Pick<FoodEntry, "calories">[]) {
  return entries.reduce((total, entry) => total + entry.calories, 0)
}

export function caloriesRemaining(target: number, consumed: number) {
  return target - consumed
}

export function entriesForToday<T extends { eaten_at: string }>(entries: T[], now = new Date()) {
  const today = toLocalDateKey(now)
  return entries.filter((entry) => toLocalDateKey(entry.eaten_at) === today)
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

export function getWeightTrend(entries: Pick<WeightEntry, "weight_kg" | "recorded_on">[], now = new Date()) {
  const sorted = [...entries].sort((a, b) => b.recorded_on.localeCompare(a.recorded_on))
  const currentStart = toLocalDateKey(daysAgo(6, now))
  const currentEnd = toLocalDateKey(now)
  const previousStart = toLocalDateKey(daysAgo(13, now))
  const previousEnd = toLocalDateKey(daysAgo(7, now))
  const current = sorted.filter(
    (entry) => entry.recorded_on >= currentStart && entry.recorded_on <= currentEnd,
  )
  const previous = sorted.filter(
    (entry) => entry.recorded_on >= previousStart && entry.recorded_on <= previousEnd,
  )

  const currentAverage = current.length >= 3 ? average(current.map((entry) => entry.weight_kg)) : null
  const previousAverage = previous.length >= 3 ? average(previous.map((entry) => entry.weight_kg)) : null

  return {
    latest: sorted[0]?.weight_kg ?? null,
    currentAverage,
    previousAverage,
    change: currentAverage !== null && previousAverage !== null ? currentAverage - previousAverage : null,
    measurementCount: current.length,
  }
}

export function weeklyCalorieAverage(entries: Pick<FoodEntry, "calories" | "eaten_at">[], now = new Date()) {
  const start = daysAgo(6, now)
  const end = new Date(startOfLocalDay(now))
  end.setDate(end.getDate() + 1)
  const totals = new Map<string, number>()

  entries.forEach((entry) => {
    const eatenAt = new Date(entry.eaten_at)
    if (eatenAt >= start && eatenAt < end) {
      const key = toLocalDateKey(eatenAt)
      totals.set(key, (totals.get(key) ?? 0) + entry.calories)
    }
  })

  return totals.size ? Math.round(average([...totals.values()])) : null
}

export function selectNextWorkoutName(completedTemplateNames: string[]) {
  const last = completedTemplateNames.at(0)
  return last === "Workout A" ? "Workout B" : "Workout A"
}
