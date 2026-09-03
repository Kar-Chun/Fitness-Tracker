import type {
  ExerciseSet,
  WorkoutSessionWithDetails,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../types/fitness.ts"
import { completedNormalSessions, sameExerciseIdentity } from "./workout-history.ts"

export type WorkoutProgressionAction = "increase" | "keep" | "consider_reduce" | "bodyweight" | "equipment_limit"

export interface ExercisePerformance {
  sessionId: string
  completedAt: string
  weightKg: number | null
  reps: number[]
}

export interface WorkoutProgressionResult {
  action: WorkoutProgressionAction
  previousWeightKg: number | null
  suggestedWeightKg: number | null
  suggestedRepMin: number
  suggestedRepMax: number
  reason: string
}

export interface WorkoutProgressSummaryItem {
  exerciseName: string
  previous: ExercisePerformance
  current: ExercisePerformance
  improved: boolean
  recommendation: WorkoutProgressionResult
}

export interface StrengthProgressItem {
  exerciseName: string
  fromWeightKg: number
  toWeightKg: number
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100
}

function relevantSets(sets: ExerciseSet[], targetSets: number) {
  return sets
    .filter((set) =>
      set.set_number >= 1
      && set.set_number <= targetSets
      && Number.isInteger(set.reps)
      && set.reps > 0)
    .sort((a, b) => a.set_number - b.set_number)
    .slice(0, targetSets)
}

function sharedWorkingWeight(sets: ExerciseSet[]) {
  const weights = sets.map((set) => set.weight_kg)
  if (!weights.length || weights.some((weight) => weight === null)) return null
  const first = weights[0]
  return weights.every((weight) => weight === first) ? first : null
}

function toPerformance(
  session: WorkoutSessionWithDetails,
  exercise: Pick<WorkoutTemplateExercise, "exercise_id" | "exercise_name" | "target_sets">,
): ExercisePerformance | null {
  if (!session.completed_at || session.mode !== "normal") return null
  const actualExercise = session.session_exercises?.find((candidate) =>
    candidate.status === "completed"
    && sameExerciseIdentity(exercise.exercise_id, exercise.exercise_name, candidate.exercise_id, candidate.exercise_name_snapshot))
  if ((session.session_exercises?.length ?? 0) > 0 && !actualExercise) return null
  const sourceSets = actualExercise?.sets
    ?? session.sets.filter((set) => set.exercise_name === exercise.exercise_name)
  const sets = relevantSets(sourceSets, exercise.target_sets)
  if (sets.length !== exercise.target_sets) return null
  return {
    sessionId: session.id,
    completedAt: session.completed_at,
    weightKg: sharedWorkingWeight(sets),
    reps: sets.map((set) => set.reps),
  }
}

export function getNormalExercisePerformances(
  sessions: WorkoutSessionWithDetails[],
  exercise: Pick<WorkoutTemplateExercise, "exercise_id" | "exercise_name" | "target_sets">,
) {
  return completedNormalSessions(sessions)
    .map((session) => toPerformance(session, exercise))
    .filter((performance): performance is ExercisePerformance => performance !== null)
}

export function getPreviousNormalPerformance(
  sessions: WorkoutSessionWithDetails[],
  exercise: Pick<WorkoutTemplateExercise, "exercise_id" | "exercise_name" | "target_sets">,
) {
  return getNormalExercisePerformances(sessions, exercise)[0] ?? null
}

function isBelowMinimum(performance: ExercisePerformance, targetRepMin: number) {
  return performance.reps.some((reps) => reps < targetRepMin)
}

function reachedMaximum(performance: ExercisePerformance, targetRepMax: number) {
  return performance.reps.every((reps) => reps >= targetRepMax)
}

function nextRepFloor(performance: ExercisePerformance, targetRepMin: number, targetRepMax: number) {
  return Math.min(targetRepMax, Math.max(targetRepMin, Math.min(...performance.reps) + 1))
}

export function evaluateExerciseProgression(
  exercise: Pick<WorkoutTemplateExercise, "exercise_id" | "exercise_name" | "target_sets" | "target_rep_min" | "target_rep_max" | "progression_step_kg" | "load_type">,
  sessions: WorkoutSessionWithDetails[],
  equipment?: { dumbbellMaxKg: number | null },
): WorkoutProgressionResult {
  const performances = getNormalExercisePerformances(sessions, exercise)
  const latest = performances[0]
  const progressionStep = exercise.progression_step_kg

  if (!latest) {
    return {
      action: progressionStep === null ? "bodyweight" : "keep",
      previousWeightKg: null,
      suggestedWeightKg: null,
      suggestedRepMin: exercise.target_rep_min,
      suggestedRepMax: exercise.target_rep_max,
      reason: "Complete a Normal session to build a progression suggestion.",
    }
  }

  if (progressionStep === null || progressionStep <= 0) {
    return {
      action: "bodyweight",
      previousWeightKg: latest.weightKg,
      suggestedWeightKg: latest.weightKg,
      suggestedRepMin: exercise.target_rep_min,
      suggestedRepMax: exercise.target_rep_max,
      reason: reachedMaximum(latest, exercise.target_rep_max)
        ? "Target reps achieved."
        : `Aim for ${nextRepFloor(latest, exercise.target_rep_min, exercise.target_rep_max)}–${exercise.target_rep_max} reps.`,
    }
  }

  if (latest.weightKg === null) {
    return {
      action: "keep",
      previousWeightKg: null,
      suggestedWeightKg: null,
      suggestedRepMin: exercise.target_rep_min,
      suggestedRepMax: exercise.target_rep_max,
      reason: "Keep your current setup and aim for more reps.",
    }
  }

  const prior = performances[1]
  const repeatedUnderperformance = prior !== undefined
    && prior.weightKg === latest.weightKg
    && isBelowMinimum(latest, exercise.target_rep_min)
    && isBelowMinimum(prior, exercise.target_rep_min)

  if (repeatedUnderperformance) {
    return {
      action: "consider_reduce",
      previousWeightKg: latest.weightKg,
      suggestedWeightKg: roundWeight(Math.max(0, latest.weightKg - progressionStep)),
      suggestedRepMin: exercise.target_rep_min,
      suggestedRepMax: exercise.target_rep_max,
      reason: "Two consecutive Normal sessions fell below the target minimum.",
    }
  }

  if (reachedMaximum(latest, exercise.target_rep_max)) {
    const increasedWeight = roundWeight(latest.weightKg + progressionStep)
    if (exercise.load_type === "per_dumbbell"
      && equipment?.dumbbellMaxKg !== null
      && equipment?.dumbbellMaxKg !== undefined
      && increasedWeight > equipment.dumbbellMaxKg) {
      return {
        action: "equipment_limit",
        previousWeightKg: latest.weightKg,
        suggestedWeightKg: latest.weightKg,
        suggestedRepMin: exercise.target_rep_min,
        suggestedRepMax: exercise.target_rep_max,
        reason: `Current dumbbell maximum of ${equipment.dumbbellMaxKg}kg each reached.`,
      }
    }
    return {
      action: "increase",
      previousWeightKg: latest.weightKg,
      suggestedWeightKg: increasedWeight,
      suggestedRepMin: exercise.target_rep_min,
      suggestedRepMax: exercise.target_rep_max,
      reason: `Reached ${exercise.target_rep_max} reps on all ${exercise.target_sets} target sets.`,
    }
  }

  return {
    action: "keep",
    previousWeightKg: latest.weightKg,
    suggestedWeightKg: latest.weightKg,
    suggestedRepMin: isBelowMinimum(latest, exercise.target_rep_min)
      ? exercise.target_rep_min
      : nextRepFloor(latest, exercise.target_rep_min, exercise.target_rep_max),
    suggestedRepMax: exercise.target_rep_max,
    reason: isBelowMinimum(latest, exercise.target_rep_min)
      ? "Keep the weight for now. One lower session is normal."
      : "Keep the weight and aim for more reps.",
  }
}

export function compareExercisePerformance(
  current: ExercisePerformance,
  previous: ExercisePerformance,
  targetRepMin: number,
) {
  const currentTotal = current.reps.reduce((total, reps) => total + reps, 0)
  const previousTotal = previous.reps.reduce((total, reps) => total + reps, 0)
  if (current.weightKg === previous.weightKg) return currentTotal > previousTotal
  if (current.weightKg === null || previous.weightKg === null) return false
  return current.weightKg > previous.weightKg && current.reps.every((reps) => reps >= targetRepMin)
}

export function getWorkoutProgressSummary(
  currentSession: WorkoutSessionWithDetails,
  previousSessions: WorkoutSessionWithDetails[],
  template: WorkoutTemplate,
) {
  if (currentSession.mode === "light") return []
  const completedCurrent = currentSession.completed_at
    ? currentSession
    : { ...currentSession, completed_at: new Date().toISOString() }

  return template.exercises.flatMap((exercise): WorkoutProgressSummaryItem[] => {
    const current = toPerformance(completedCurrent, exercise)
    const previous = getPreviousNormalPerformance(
      previousSessions.filter((session) => session.id !== currentSession.id),
      exercise,
    )
    if (!current || !previous) return []
    const recommendation = evaluateExerciseProgression(exercise, [completedCurrent, ...previousSessions])
    const improved = compareExercisePerformance(current, previous, exercise.target_rep_min)
    if (!improved && recommendation.action !== "increase" && recommendation.action !== "consider_reduce") return []
    return [{ exerciseName: exercise.exercise_name, previous, current, improved, recommendation }]
  })
}

export function getStrengthProgress(
  sessions: WorkoutSessionWithDetails[],
  templates: WorkoutTemplate[],
  since: Date,
): StrengthProgressItem[] {
  const candidates = [
    ...templates.flatMap((template) => template.exercises),
    ...sessions.flatMap((session) => session.session_exercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name_snapshot,
      target_sets: exercise.target_sets,
      progression_step_kg: exercise.progression_step_kg,
    }))),
  ]
  const seen = new Set<string>()
  return candidates.filter((exercise) => {
    const key = exercise.exercise_id ?? exercise.exercise_name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).flatMap((exercise): StrengthProgressItem[] => {
    if (exercise.progression_step_kg === null) return []
    const performances = getNormalExercisePerformances(sessions, exercise)
      .filter((performance) => new Date(performance.completedAt) >= since && performance.weightKg !== null)
    if (performances.length < 2) return []
    const newest = performances[0]?.weightKg
    const oldest = performances.at(-1)?.weightKg
    if (typeof newest !== "number" || typeof oldest !== "number" || newest <= oldest) return []
    return [{ exerciseName: exercise.exercise_name, fromWeightKg: oldest, toWeightKg: newest }]
  }).slice(0, 5)
}

export function formatExercisePerformance(performance: ExercisePerformance) {
  const load = performance.weightKg === null ? "Bodyweight" : `${performance.weightKg}kg`
  return `${load} · ${performance.reps.join(" / ")}`
}
