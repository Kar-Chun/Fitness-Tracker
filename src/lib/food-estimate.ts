import type { FoodEstimateItem } from "../types/fitness.ts"

function roundProtein(value: number) {
  return Math.round(value * 10) / 10
}

export function nutrientsForEditedGrams(item: FoodEstimateItem, grams: number): FoodEstimateItem {
  const safeGrams = Math.max(0, grams)
  if (item.caloriesPer100g === null || item.proteinPer100g === null) {
    return { ...item, estimatedGrams: safeGrams }
  }

  const calories = Math.round(item.caloriesPer100g * safeGrams / 100)
  const proteinG = roundProtein(item.proteinPer100g * safeGrams / 100)
  const lowRatio = item.calories > 0 ? item.calorieRange.low / item.calories : 0.8
  const highRatio = item.calories > 0 ? item.calorieRange.high / item.calories : 1.2
  return {
    ...item,
    estimatedGrams: safeGrams,
    calories,
    proteinG,
    calorieRange: {
      low: Math.max(0, Math.min(calories, Math.round(calories * lowRatio))),
      high: Math.max(calories, Math.round(calories * highRatio)),
    },
  }
}

export function totalsFromEstimateItems(items: FoodEstimateItem[]) {
  return {
    calories: items.reduce((total, item) => total + item.calories, 0),
    proteinG: roundProtein(items.reduce((total, item) => total + item.proteinG, 0)),
    calorieRange: {
      low: items.reduce((total, item) => total + item.calorieRange.low, 0),
      high: items.reduce((total, item) => total + item.calorieRange.high, 0),
    },
  }
}

export function rangeForEditedTotal(
  previous: { low: number; high: number },
  previousTotal: number,
  nextTotal: number,
) {
  const lowMargin = Math.max(20, previousTotal - previous.low)
  const highMargin = Math.max(20, previous.high - previousTotal)
  return {
    low: Math.max(0, nextTotal - lowMargin),
    high: nextTotal + highMargin,
  }
}
