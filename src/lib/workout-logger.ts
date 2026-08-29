import type { ExerciseLoadType, ExerciseSet, WorkoutSessionExercise } from "../types/fitness.ts"

export interface EditableSetDraft {
  id?: string
  weight: string
  reps: string
}

export type SetDraftState = "blank" | "partial" | "invalid" | "valid"

function isWeighted(loadType: ExerciseLoadType) {
  return loadType === "per_dumbbell" || loadType === "total"
}

export function getSetDraftState(set: EditableSetDraft, loadType: ExerciseLoadType): SetDraftState {
  const weightText = set.weight.trim()
  const repsText = set.reps.trim()
  const needsWeight = isWeighted(loadType)
  if (!weightText && !repsText) return "blank"
  if ((needsWeight && !weightText) || !repsText) return "partial"
  const weight = needsWeight ? Number(weightText) : null
  const reps = Number(repsText)
  if ((weight !== null && (!Number.isFinite(weight) || weight < 0)) || !Number.isInteger(reps) || reps < 0) return "invalid"
  return "valid"
}

export function createBlankSetDrafts(count: number, savedSets: ExerciseSet[] = []): EditableSetDraft[] {
  return Array.from({ length: Math.max(count, savedSets.length) }, (_, index) => {
    const saved = savedSets.find((set) => set.set_number === index + 1)
    return {
      id: saved?.id,
      weight: saved?.weight_kg === null || saved?.weight_kg === undefined ? "" : String(saved.weight_kg),
      reps: saved ? String(saved.reps) : "",
    }
  })
}

export function copyLastSets(previous: WorkoutSessionExercise | null, targetSets: number): EditableSetDraft[] {
  if (!previous?.sets.length) return createBlankSetDrafts(targetSets)
  return Array.from({ length: Math.max(targetSets, previous.sets.length) }, (_, index) => {
    const previousSet = previous.sets[index] ?? previous.sets.at(-1)
    return {
      weight: previousSet?.weight_kg === null || previousSet?.weight_kg === undefined ? "" : String(previousSet.weight_kg),
      reps: previousSet ? String(previousSet.reps) : "",
    }
  })
}

export function getValidSetValues(set: EditableSetDraft, loadType: ExerciseLoadType) {
  if (getSetDraftState(set, loadType) !== "valid") return null
  return {
    weightKg: isWeighted(loadType) ? Number(set.weight) : null,
    reps: Number(set.reps),
  }
}

export function getFirstSetError(exercises: Array<{ exerciseName: string; loadType: ExerciseLoadType; sets: EditableSetDraft[] }>) {
  for (const exercise of exercises) {
    for (const [index, set] of exercise.sets.entries()) {
      const state = getSetDraftState(set, exercise.loadType)
      if (state === "partial") return `${exercise.exerciseName}, set ${index + 1}: enter both weight and reps.`
      if (state === "invalid") return `${exercise.exerciseName}, set ${index + 1}: check the entered values.`
    }
  }
  return null
}
