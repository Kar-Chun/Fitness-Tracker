import type {
  ExerciseLoadType,
  RoutineInput,
  WorkoutDraftExerciseInput,
  WorkoutSessionWithDetails,
  WorkoutTemplate,
} from "../types/fitness.ts"

function sameExercise(
  exerciseId: string | null,
  exerciseName: string,
  candidateId: string | null,
  candidateName: string,
) {
  if (exerciseId && candidateId) return exerciseId === candidateId
  return exerciseName === candidateName
}

export function findPreviousExercisePerformance(
  sessions: WorkoutSessionWithDetails[],
  exerciseId: string | null,
  exerciseName: string,
) {
  return sessions
    .filter((session) => session.completed_at && session.mode === "normal")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .flatMap((session) => session.session_exercises)
    .find((exercise) =>
      exercise.status === "completed"
      && sameExercise(exerciseId, exerciseName, exercise.exercise_id, exercise.exercise_name_snapshot)
      && exercise.sets.length > 0) ?? null
}

export function createRoutineWorkoutDraft(
  routine: WorkoutTemplate,
  sessions: WorkoutSessionWithDetails[],
  mode: "normal" | "light",
): WorkoutDraftExerciseInput[] {
  return routine.exercises
    .filter((exercise) => mode === "normal" || exercise.include_in_light)
    .map((exercise) => {
      const previous = findPreviousExercisePerformance(sessions, exercise.exercise_id, exercise.exercise_name)
      const targetSets = mode === "light"
        ? exercise.light_target_sets ?? Math.min(2, exercise.target_sets)
        : exercise.target_sets
      return {
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        loadType: exercise.load_type,
        targetSets,
        targetRepMin: exercise.target_rep_min,
        targetRepMax: exercise.target_rep_max,
        progressionStepKg: exercise.progression_step_kg,
        skipped: false,
        sets: Array.from({ length: targetSets }, (_, index) => ({
          weightKg: previous?.sets[index]?.weight_kg ?? previous?.sets.at(-1)?.weight_kg ?? null,
          reps: previous?.sets[index]?.reps ?? previous?.sets.at(-1)?.reps ?? exercise.target_rep_min,
          completed: false,
        })),
      }
    })
}

export function copySessionToDraft(session: WorkoutSessionWithDetails): WorkoutDraftExerciseInput[] {
  return session.session_exercises
    .filter((exercise) => exercise.status !== "skipped")
    .sort((a, b) => a.position - b.position)
    .map((exercise) => ({
      exerciseId: exercise.exercise_id,
      exerciseName: exercise.exercise_name_snapshot,
      loadType: exercise.load_type,
      targetSets: exercise.target_sets,
      targetRepMin: exercise.target_rep_min,
      targetRepMax: exercise.target_rep_max,
      progressionStepKg: exercise.progression_step_kg,
      skipped: false,
      sets: exercise.sets.map((set) => ({ weightKg: set.weight_kg, reps: set.reps, completed: true })),
    }))
}

export function routineToInput(routine: WorkoutTemplate): RoutineInput {
  return {
    name: routine.name,
    exercises: [...routine.exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        exerciseId: exercise.exercise_id ?? "",
        exerciseName: exercise.exercise_name,
        loadType: exercise.load_type,
        targetSets: exercise.target_sets,
        targetRepMin: exercise.target_rep_min,
        targetRepMax: exercise.target_rep_max,
        includeInLight: exercise.include_in_light,
        lightTargetSets: exercise.light_target_sets,
        progressionStepKg: exercise.progression_step_kg,
      })),
  }
}

export function replaceDraftExercise(
  draft: WorkoutDraftExerciseInput[],
  index: number,
  replacement: { id: string; name: string; load_type: ExerciseLoadType; progression_step_kg: number | null },
) {
  return draft.map((exercise, exerciseIndex) => exerciseIndex === index ? {
    ...exercise,
    exerciseId: replacement.id,
    exerciseName: replacement.name,
    loadType: replacement.load_type,
    progressionStepKg: replacement.progression_step_kg,
  } : exercise)
}

export function loadTypeLabel(loadType: ExerciseLoadType) {
  if (loadType === "per_dumbbell") return "kg each"
  if (loadType === "total") return "kg total"
  if (loadType === "bodyweight") return "Bodyweight"
  return "No external weight"
}
