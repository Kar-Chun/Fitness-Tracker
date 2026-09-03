import { loadCalorieData } from "./calories.ts"
import { loadFoodData } from "./food.ts"
import { loadWeightData } from "./weight.ts"
import { loadWorkoutData } from "./workout.ts"
import type { FitnessData } from "../types/fitness.ts"

export async function loadFitnessData(userId: string): Promise<FitnessData> {
  const [calories, food, weight, workout] = await Promise.all([
    loadCalorieData(userId),
    loadFoodData(userId),
    loadWeightData(userId),
    loadWorkoutData(userId),
  ])

  return { ...calories, ...food, ...weight, ...workout }
}
