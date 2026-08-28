export type Sex = "female" | "male"
export type Goal = "lose" | "maintain" | "gain"
export type ActivityLevel = "sedentary" | "light" | "active"
export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type WorkoutMode = "normal" | "light"
export type EstimateConfidence = "high" | "medium" | "low"
export type EstimateSource = "manual" | "history" | "favourite" | "saved_meal" | "usda" | "ai_estimate" | "mixed"

export interface Profile {
  user_id: string
  age: number
  sex: Sex
  height_cm: number
  goal: Goal
  activity_level: ActivityLevel
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface CalorieTarget {
  id: string
  user_id: string
  calories: number
  effective_from: string
  reason: string
  created_at: string
}

export interface WeightEntry {
  id: string
  user_id: string
  weight_kg: number
  recorded_on: string
  created_at: string
}

export interface FoodEntry {
  id: string
  user_id: string
  name: string
  calories: number
  protein_g: number | null
  meal_type: MealType
  eaten_at: string
  created_at: string
  updated_at: string
  source: EstimateSource
  confidence: EstimateConfidence | null
  estimate_low_calories: number | null
  estimate_high_calories: number | null
}

export interface FoodEstimateItem {
  name: string
  portionDescription: string
  estimatedGrams: number
  calories: number
  proteinG: number
  calorieRange: { low: number; high: number }
  source: Exclude<EstimateSource, "manual" | "mixed">
  confidence: EstimateConfidence
  caloriesPer100g: number | null
  proteinPer100g: number | null
}

export interface FoodEstimate {
  mealName: string
  totalCalories: number
  totalProteinG: number
  calorieRange: { low: number; high: number }
  confidence: EstimateConfidence
  source: Exclude<EstimateSource, "manual">
  sourceSummary: string
  items: FoodEstimateItem[]
}

export interface FoodEstimateLogInput {
  name: string
  calories: number
  proteinG: number
  mealType: MealType
  eatenAt: string
  source: Exclude<EstimateSource, "manual">
  confidence: EstimateConfidence
  estimateLowCalories: number
  estimateHighCalories: number
}

export interface FavouriteFood {
  id: string
  user_id: string
  name: string
  normalized_name: string
  calories: number
  protein_g: number | null
  default_meal_type: MealType | null
  created_at: string
  updated_at: string
}

export interface SavedMealItem {
  id: string
  user_id: string
  saved_meal_id: string
  name: string
  calories: number
  protein_g: number | null
  position: number
  created_at: string
}

export interface SavedMeal {
  id: string
  user_id: string
  name: string
  default_meal_type: MealType | null
  created_at: string
  updated_at: string
  items: SavedMealItem[]
}

export interface FoodHistoryOption {
  key: string
  name: string
  calories: number
  proteinG: number | null
  mealType: MealType
  lastUsedAt: string
  count: number
}

export interface WorkoutTemplateExercise {
  id: string
  user_id: string
  template_id: string
  exercise_name: string
  position: number
  target_sets: number
  target_rep_min: number
  target_rep_max: number
}

export interface WorkoutTemplate {
  id: string
  user_id: string
  name: string
  created_at: string
  exercises: WorkoutTemplateExercise[]
}

export interface WorkoutSession {
  id: string
  user_id: string
  template_id: string
  mode: WorkoutMode
  started_at: string
  completed_at: string | null
}

export interface ExerciseSet {
  id: string
  user_id: string
  session_id: string
  exercise_name: string
  set_number: number
  weight_kg: number | null
  reps: number
  created_at: string
}

export interface WorkoutSessionWithDetails extends WorkoutSession {
  template_name: string
  sets: ExerciseSet[]
}

export interface FitnessData {
  calorieTarget: CalorieTarget | null
  foodEntries: FoodEntry[]
  favouriteFoods: FavouriteFood[]
  savedMeals: SavedMeal[]
  weightEntries: WeightEntry[]
  templates: WorkoutTemplate[]
  sessions: WorkoutSessionWithDetails[]
}

export interface OnboardingInput {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  goal: Goal
  activityLevel: ActivityLevel
}

export interface FoodEntryInput {
  name: string
  calories: number
  proteinG: number | null
  mealType: MealType
  eatenAt: string
  source?: EstimateSource
  confidence?: EstimateConfidence | null
  estimateLowCalories?: number | null
  estimateHighCalories?: number | null
}

export interface FavouriteFoodInput {
  name: string
  calories: number
  proteinG: number | null
  defaultMealType: MealType | null
}

export interface SavedMealItemInput {
  name: string
  calories: number
  proteinG: number | null
}

export interface SavedMealInput {
  name: string
  defaultMealType: MealType | null
  items: SavedMealItemInput[]
}
