import assert from "node:assert/strict"
import test from "node:test"
import {
  copyMealToNow,
  getFrequentFoods,
  groupFoodHistory,
  normalizeFoodName,
  repeatFoodInput,
  savedMealTotal,
  searchFoodHistory,
} from "../src/lib/food-history.ts"
import type { FoodEntry } from "../src/types/fitness.ts"

function food(overrides: Partial<FoodEntry> & Pick<FoodEntry, "name" | "eaten_at">): FoodEntry {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    calories: 500,
    protein_g: 20,
    meal_type: "lunch",
    created_at: overrides.eaten_at,
    updated_at: overrides.eaten_at,
    source: "manual",
    confidence: null,
    estimate_low_calories: null,
    estimate_high_calories: null,
    ...overrides,
  }
}

test("food names are trimmed, lowercased, and repeated spaces collapse", () => {
  assert.equal(normalizeFoodName(" Chicken   Rice "), "chicken rice")
  assert.equal(normalizeFoodName("PROTEIN\t Shake"), "protein shake")
})

test("equivalent foods group together and retain the most recent values and display name", () => {
  const grouped = groupFoodHistory([
    food({ name: " Chicken  Rice ", calories: 620, protein_g: 25, eaten_at: "2026-08-20T04:00:00.000Z" }),
    food({ name: "Chicken Rice", calories: 650, protein_g: 30, eaten_at: "2026-08-28T04:00:00.000Z" }),
  ])
  assert.equal(grouped.length, 1)
  assert.equal(grouped[0].count, 2)
  assert.equal(grouped[0].name, "Chicken Rice")
  assert.equal(grouped[0].calories, 650)
  assert.equal(grouped[0].proteinG, 30)
})

test("frequent foods order by count, then most recent use", () => {
  const entries = [
    food({ name: "Toast", eaten_at: "2026-08-28T01:00:00.000Z" }),
    food({ name: "Toast", eaten_at: "2026-08-27T01:00:00.000Z" }),
    food({ name: "Eggs", eaten_at: "2026-08-26T01:00:00.000Z" }),
    food({ name: "Eggs", eaten_at: "2026-08-25T01:00:00.000Z" }),
    food({ name: "Eggs", eaten_at: "2026-08-24T01:00:00.000Z" }),
    food({ name: "Coffee", eaten_at: "2026-08-28T02:00:00.000Z" }),
    food({ name: "Coffee", eaten_at: "2026-08-20T02:00:00.000Z" }),
  ]
  assert.deepEqual(getFrequentFoods(entries).map((item) => item.name), ["Eggs", "Coffee", "Toast"])
})

test("history search returns useful unique options", () => {
  const entries = [
    food({ name: "Chicken Rice", eaten_at: "2026-08-28T01:00:00.000Z" }),
    food({ name: "chicken rice", eaten_at: "2026-08-27T01:00:00.000Z" }),
    food({ name: "Chicken Wrap", eaten_at: "2026-08-26T01:00:00.000Z" }),
  ]
  const results = searchFoodHistory(entries, " chicken ")
  assert.equal(results.length, 2)
  assert.equal(results[0].count, 2)
})

test("saved meal calorie totals add item calories", () => {
  assert.equal(savedMealTotal([{ calories: 140 }, { calories: 180 }, { calories: 50 }]), 370)
})

test("repeat and copy transformations create current-time inputs without historical ids", () => {
  const now = new Date(2026, 7, 28, 12, 30)
  const entry = food({ id: "old-id", name: "Protein Shake", calories: 180, protein_g: 25, meal_type: "snack", eaten_at: "2026-08-20T04:00:00.000Z" })
  const repeated = repeatFoodInput(entry, now)
  assert.deepEqual(repeated, {
    name: "Protein Shake",
    calories: 180,
    proteinG: 25,
    mealType: "snack",
    eatenAt: "2026-08-28T12:30",
    source: "history",
  })
  assert.deepEqual(copyMealToNow([entry], now), [repeated])
  assert.equal("id" in repeated, false)
})
