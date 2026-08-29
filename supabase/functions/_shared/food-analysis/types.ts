export type EstimateConfidence = "high" | "medium" | "low"
export type PersonalSource = "history" | "favourite" | "saved_meal"
export type ItemSource = PersonalSource | "usda" | "ai_estimate"
export type EstimateSource = PersonalSource | "usda" | "ai_estimate" | "mixed"
export type ImageAnalysisStatus = "ok" | "no_food" | "too_uncertain"

export interface ParsedFoodItem {
  name: string
  displayName: string
  estimatedGrams: number
  portionDescription: string
  preparation?: string
  confidence: EstimateConfidence
  fallbackCalories: number
  fallbackProteinG: number
  fallbackCalorieLow: number
  fallbackCalorieHigh: number
}

export interface ParsedMeal { mealName: string; items: ParsedFoodItem[]; overallConfidence: EstimateConfidence }
export interface VisionMealResult extends ParsedMeal {
  status: ImageAnalysisStatus
  uncertainties: string[]
  wholeDishConfidence: EstimateConfidence
  portionConfidence: EstimateConfidence
}

export interface USDAFoodCandidate { fdcId: number; description: string; dataType: string; brandOwner?: string; ingredients?: string; foodNutrients?: USDANutrient[] }
export interface USDANutrient { nutrientName?: string; nutrientNumber?: string; unitName?: string; value?: number; amount?: number; nutrient?: { name?: string; number?: string; unitName?: string } }
export interface USDAFoodMatch { fdcId: number; description: string; dataType: string; score: number; caloriesPer100g: number; proteinPer100g: number }

export interface ResolvedFoodItem {
  name: string
  portionDescription: string
  estimatedGrams: number
  calories: number
  proteinG: number
  calorieRange: { low: number; high: number }
  source: ItemSource
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
  source: EstimateSource
  sourceSummary: string
  items: ResolvedFoodItem[]
}

export interface HistoryFood { name: string; calories: number; protein_g: number | null; eaten_at: string }
export interface FavouriteFood { name: string; normalized_name: string; calories: number; protein_g: number | null }
export interface SavedMealItem { name: string; calories: number; protein_g: number | null }
export interface SavedMeal { name: string; saved_meal_items: SavedMealItem[] }
export interface PersonalFoodData { history: HistoryFood[]; favourites: FavouriteFood[]; savedMeals: SavedMeal[] }
export interface PersonalMatch { name: string; calories: number; proteinG: number; source: PersonalSource; note: string }
