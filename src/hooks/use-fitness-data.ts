import { useCallback, useEffect, useState } from "react"
import { loadCalorieData } from "../services/calories.ts"
import {
  loadDailyFoodLogStatuses,
  loadFavouriteFoods,
  loadFoodDiaryData,
  loadSavedMeals,
} from "../services/food.ts"
import { loadFitnessData } from "../services/fitness.ts"
import { loadWeightData } from "../services/weight.ts"
import { loadExercises, loadWorkoutData } from "../services/workout.ts"
import type { FitnessData } from "../types/fitness.ts"

export function useFitnessData(userId: string) {
  const [data, setData] = useState<FitnessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshError, setRefreshError] = useState("")

  const refresh = useCallback(async () => {
    setError("")
    setRefreshError("")
    try {
      setData(await loadFitnessData(userId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your fitness data.")
    } finally {
      setLoading(false)
    }
  }, [userId])

  const applyScopedRefresh = useCallback(async (
    loader: (id: string) => Promise<Partial<FitnessData>>,
    fallbackMessage: string,
  ) => {
    setRefreshError("")
    try {
      const refreshed = await loader(userId)
      setData((current) => current ? { ...current, ...refreshed } : current)
    } catch (loadError) {
      setRefreshError(loadError instanceof Error ? loadError.message : fallbackMessage)
    }
  }, [userId])

  const refreshFoodDiary = useCallback(
    () => applyScopedRefresh(loadFoodDiaryData, "Could not refresh your food diary."),
    [applyScopedRefresh],
  )
  const refreshFavourites = useCallback(
    () => applyScopedRefresh(async (id) => ({ favouriteFoods: await loadFavouriteFoods(id) }), "Could not refresh favourites."),
    [applyScopedRefresh],
  )
  const refreshSavedMeals = useCallback(
    () => applyScopedRefresh(async (id) => ({ savedMeals: await loadSavedMeals(id) }), "Could not refresh saved meals."),
    [applyScopedRefresh],
  )
  const refreshFoodStatus = useCallback(
    () => applyScopedRefresh(async (id) => ({ dailyFoodLogStatuses: await loadDailyFoodLogStatuses(id) }), "Could not refresh food-log status."),
    [applyScopedRefresh],
  )
  const refreshWeight = useCallback(
    () => applyScopedRefresh(loadWeightData, "Could not refresh weight data."),
    [applyScopedRefresh],
  )
  const refreshWorkout = useCallback(
    () => applyScopedRefresh(loadWorkoutData, "Could not refresh workout data."),
    [applyScopedRefresh],
  )
  const refreshExercises = useCallback(
    () => applyScopedRefresh(async (id) => ({ exercises: await loadExercises(id) }), "Could not refresh exercises."),
    [applyScopedRefresh],
  )
  const refreshCalories = useCallback(
    () => applyScopedRefresh(loadCalorieData, "Could not refresh calorie reviews."),
    [applyScopedRefresh],
  )

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- this starts the external Supabase sync.
    void refresh()
  }, [refresh])

  return {
    data,
    loading,
    error,
    refreshError,
    refresh,
    refreshFoodDiary,
    refreshFavourites,
    refreshSavedMeals,
    refreshFoodStatus,
    refreshWeight,
    refreshWorkout,
    refreshExercises,
    refreshCalories,
  }
}
