export type Sex = "female" | "male"
export type Goal = "lose" | "maintain" | "gain"
export type ActivityLevel = "sedentary" | "light" | "active"
export type MealType = "breakfast" | "lunch" | "dinner" | "snack"
export type WorkoutMode = "normal" | "light"

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
}
