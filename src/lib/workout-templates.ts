export interface DefaultExercise {
  name: string
  targetSets: number
  repMin: number
  repMax: number
  progressionStepKg: number | null
}

export interface DefaultWorkoutTemplate {
  name: "Workout A" | "Workout B"
  exercises: DefaultExercise[]
}

export const DEFAULT_WORKOUT_TEMPLATES: DefaultWorkoutTemplate[] = [
  {
    name: "Workout A",
    exercises: [
      { name: "Goblet Squat", targetSets: 3, repMin: 8, repMax: 12, progressionStepKg: 2.5 },
      { name: "Push-up", targetSets: 3, repMin: 8, repMax: 12, progressionStepKg: null },
      { name: "One-arm Dumbbell Row", targetSets: 3, repMin: 8, repMax: 12, progressionStepKg: 2.5 },
      { name: "Dumbbell Romanian Deadlift", targetSets: 2, repMin: 8, repMax: 12, progressionStepKg: 2.5 },
      { name: "Dead Bug", targetSets: 2, repMin: 8, repMax: 12, progressionStepKg: null },
    ],
  },
  {
    name: "Workout B",
    exercises: [
      { name: "Reverse Lunge", targetSets: 3, repMin: 8, repMax: 12, progressionStepKg: 2.5 },
      { name: "Dumbbell Shoulder Press", targetSets: 3, repMin: 8, repMax: 12, progressionStepKg: 2.5 },
      { name: "Band Lat Pulldown", targetSets: 3, repMin: 8, repMax: 12, progressionStepKg: null },
      { name: "Glute Bridge", targetSets: 2, repMin: 10, repMax: 15, progressionStepKg: null },
      { name: "Plank", targetSets: 2, repMin: 20, repMax: 40, progressionStepKg: null },
    ],
  },
]
