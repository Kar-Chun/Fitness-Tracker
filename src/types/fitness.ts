export type Sex = "female" | "male"
export type Goal = "lose" | "maintain" | "gain"
export type ActivityLevel = "sedentary" | "light" | "active"
export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type WorkoutMode = "normal" | "light"
export type WorkoutReadiness = "tired" | "normal" | "good"
export type ExerciseCategory = "chest" | "back" | "shoulders" | "arms" | "legs" | "core" | "other"
export type ExerciseLoadType = "per_dumbbell" | "total" | "bodyweight" | "none"
export type SessionExerciseStatus = "planned" | "completed" | "skipped"
export type EstimateConfidence = "high" | "medium" | "low"
export type EstimateSource = "manual" | "history" | "favourite" | "saved_meal" | "usda" | "ai_estimate" | "mixed"
export type CalorieReviewStatus = "on_track" | "watch" | "suggest_increase" | "suggest_decrease" | "review_goal"

export interface Profile {
  user_id: string
  age: number
  sex: Sex
  height_cm: number
  goal: Goal
  activity_level: ActivityLevel
  onboarding_completed: boolean
  has_adjustable_dumbbells: boolean
  dumbbell_max_kg: number | null
  has_bench: boolean
  has_pull_up_bar: boolean
  adaptive_calorie_enabled: boolean
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

export interface DailyFoodLogStatus {
  id: string
  user_id: string
  date: string
  is_complete: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CalorieReview {
  id: string
  user_id: string
  goal: Goal
  period_start: string
  period_end: string
  previous_weight_avg: number
  current_weight_avg: number
  weight_change_kg: number
  weight_change_percent: number
  complete_food_days: number
  weight_entry_count: number
  average_calories: number
  current_target: number
  suggested_target: number | null
  status: CalorieReviewStatus
  reason_code: string
  created_at: string
  accepted_at: string | null
  dismissed_at: string | null
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

export interface FoodImageAnalysisInput {
  imageBase64: string
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif"
  note: string
}

export type FoodImageAnalysisResult =
  | { status: "ok"; estimate: FoodEstimate; uncertainties: string[] }
  | { status: "no_food" | "too_uncertain"; message: string; uncertainties: string[] }

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
  progression_step_kg: number | null
  exercise_id: string | null
  include_in_light: boolean
  light_target_sets: number | null
  load_type: ExerciseLoadType
}

export interface ExerciseLibraryItem {
  id: string
  user_id: string | null
  name: string
  category: ExerciseCategory
  load_type: ExerciseLoadType
  progression_step_kg: number | null
  requires_dumbbells: boolean
  requires_bench: boolean
  requires_pull_up_bar: boolean
  created_at: string
  updated_at: string
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
  template_id: string | null
  mode: WorkoutMode
  readiness: WorkoutReadiness | null
  title: string | null
  logged_retrospectively: boolean
  started_at: string
  completed_at: string | null
}

export interface ExerciseSet {
  id: string
  user_id: string
  session_id: string
  session_exercise_id: string | null
  exercise_name: string
  set_number: number
  weight_kg: number | null
  reps: number
  created_at: string
}

export interface WorkoutSessionExercise {
  id: string
  user_id: string
  session_id: string
  exercise_id: string | null
  exercise_name_snapshot: string
  position: number
  load_type: ExerciseLoadType
  target_sets: number
  target_rep_min: number
  target_rep_max: number
  progression_step_kg: number | null
  status: SessionExerciseStatus
  created_at: string
  sets: ExerciseSet[]
}

export interface WorkoutSessionWithDetails extends WorkoutSession {
  template_name: string
  sets: ExerciseSet[]
  session_exercises: WorkoutSessionExercise[]
}

export interface FitnessData {
  calorieTarget: CalorieTarget | null
  calorieTargetHistory: CalorieTarget[]
  dailyFoodLogStatuses: DailyFoodLogStatus[]
  calorieReviews: CalorieReview[]
  foodEntries: FoodEntry[]
  favouriteFoods: FavouriteFood[]
  savedMeals: SavedMeal[]
  weightEntries: WeightEntry[]
  templates: WorkoutTemplate[]
  exercises: ExerciseLibraryItem[]
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

export interface RoutineExerciseInput {
  exerciseId: string
  exerciseName: string
  loadType: ExerciseLoadType
  targetSets: number
  targetRepMin: number
  targetRepMax: number
  includeInLight: boolean
  lightTargetSets: number | null
  progressionStepKg: number | null
}

export interface RoutineInput {
  name: string
  exercises: RoutineExerciseInput[]
}

export interface CustomExerciseInput {
  name: string
  category: ExerciseCategory
  loadType: ExerciseLoadType
  progressionStepKg: number | null
}

export interface EquipmentSettingsInput {
  hasAdjustableDumbbells: boolean
  dumbbellMaxKg: number | null
  hasBench: boolean
  hasPullUpBar: boolean
}

export interface WorkoutDraftSetInput {
  weightKg: number | null
  reps: number
}

export interface WorkoutDraftExerciseInput {
  exerciseId: string | null
  exerciseName: string
  loadType: ExerciseLoadType
  targetSets: number
  targetRepMin: number
  targetRepMax: number
  progressionStepKg: number | null
  sets: WorkoutDraftSetInput[]
}

export interface FinishedWorkoutInput {
  title: string
  templateId: string | null
  mode: WorkoutMode
  startedAt?: string
  exercises: WorkoutDraftExerciseInput[]
}
