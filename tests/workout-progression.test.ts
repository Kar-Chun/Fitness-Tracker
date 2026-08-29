import assert from "node:assert/strict"
import test from "node:test"
import {
  compareExercisePerformance,
  evaluateExerciseProgression,
  getPreviousNormalPerformance,
  type ExercisePerformance,
} from "../src/lib/workout-progression.ts"
import type { WorkoutMode, WorkoutSessionWithDetails, WorkoutTemplateExercise } from "../src/types/fitness.ts"

const exercise: WorkoutTemplateExercise = {
  id: "exercise",
  user_id: "user",
  template_id: "template",
  exercise_name: "Bench Press",
  position: 0,
  target_sets: 3,
  target_rep_min: 8,
  target_rep_max: 12,
  progression_step_kg: 2.5,
}

function session(
  id: string,
  reps: number[],
  options: { weight?: number | null; mode?: WorkoutMode; completed?: boolean; date?: string; exerciseName?: string } = {},
): WorkoutSessionWithDetails {
  const weight = options.weight === undefined ? 40 : options.weight
  const date = options.date ?? `2026-08-${id.padStart(2, "0")}T10:00:00.000Z`
  return {
    id,
    user_id: "user",
    template_id: "template",
    template_name: "Workout A",
    mode: options.mode ?? "normal",
    readiness: "normal",
    started_at: date,
    completed_at: options.completed === false ? null : date,
    sets: reps.map((value, index) => ({
      id: `${id}-${index}`,
      user_id: "user",
      session_id: id,
      exercise_name: options.exerciseName ?? exercise.exercise_name,
      set_number: index + 1,
      weight_kg: weight,
      reps: value,
      created_at: date,
    })),
  }
}

test("all prescribed sets at the maximum recommend one configured increase", () => {
  const result = evaluateExerciseProgression(exercise, [session("01", [12, 12, 12])])
  assert.equal(result.action, "increase")
  assert.equal(result.suggestedWeightKg, 42.5)
})

test("reps within the range keep the current weight", () => {
  const result = evaluateExerciseProgression(exercise, [session("01", [10, 10, 9])])
  assert.equal(result.action, "keep")
  assert.equal(result.suggestedWeightKg, 40)
})

test("almost reaching the maximum still keeps the current weight", () => {
  assert.equal(evaluateExerciseProgression(exercise, [session("01", [12, 12, 11])]).action, "keep")
})

test("one weak Normal session does not trigger a reduction", () => {
  assert.equal(evaluateExerciseProgression(exercise, [session("01", [8, 7, 6])]).action, "keep")
})

test("two consecutive weak Normal sessions can suggest one conservative reduction", () => {
  const result = evaluateExerciseProgression(exercise, [
    session("02", [8, 7, 7]),
    session("01", [8, 7, 6]),
  ])
  assert.equal(result.action, "consider_reduce")
  assert.equal(result.suggestedWeightKg, 37.5)
})

test("Light performance is ignored for progression", () => {
  const normal = session("01", [11, 11, 10])
  const light = session("02", [8, 8], { weight: 30, mode: "light" })
  const previous = getPreviousNormalPerformance([light, normal], exercise)
  assert.equal(previous?.sessionId, normal.id)
  assert.equal(evaluateExerciseProgression(exercise, [light, normal]).suggestedWeightKg, 40)
})

test("bodyweight exercises never receive a kilogram increase", () => {
  const pushUp = { ...exercise, exercise_name: "Push-up", progression_step_kg: null }
  const result = evaluateExerciseProgression(pushUp, [session("01", [12, 12, 12], { weight: null, exerciseName: "Push-up" })])
  assert.equal(result.action, "bodyweight")
  assert.equal(result.suggestedWeightKg, null)
})

test("an incomplete session cannot drive progression", () => {
  const abandoned = session("02", [12, 12, 12], { completed: false })
  const prior = session("01", [10, 10, 9])
  const result = evaluateExerciseProgression(exercise, [abandoned, prior])
  assert.equal(result.action, "keep")
  assert.equal(result.previousWeightKg, 40)
})

test("more total reps at the same load counts as improvement", () => {
  const previous: ExercisePerformance = { sessionId: "previous", completedAt: "2026-08-01", weightKg: 40, reps: [10, 10, 9] }
  const current: ExercisePerformance = { sessionId: "current", completedAt: "2026-08-02", weightKg: 40, reps: [11, 10, 10] }
  assert.equal(compareExercisePerformance(current, previous, 8), true)
})

test("equipment ceiling prevents an unavailable per-dumbbell increase", () => {
  const dumbbellExercise = { ...exercise, exercise_id: "bench", load_type: "per_dumbbell" as const }
  const result = evaluateExerciseProgression(dumbbellExercise, [session("01", [12, 12, 12], { weight: 20 })], { dumbbellMaxKg: 20 })
  assert.equal(result.action, "equipment_limit")
  assert.equal(result.suggestedWeightKg, 20)
})

test("a skipped structured exercise does not influence progression", () => {
  const legacy = session("01", [12, 12, 12])
  const skipped = {
    ...legacy,
    session_exercises: [{
      id: "actual",
      user_id: "user",
      session_id: legacy.id,
      exercise_id: "bench",
      exercise_name_snapshot: exercise.exercise_name,
      position: 0,
      load_type: "per_dumbbell" as const,
      target_sets: 3,
      target_rep_min: 8,
      target_rep_max: 12,
      progression_step_kg: 2.5,
      status: "skipped" as const,
      created_at: legacy.started_at,
      sets: legacy.sets,
    }],
  }
  const result = evaluateExerciseProgression({ ...exercise, exercise_id: "bench", load_type: "per_dumbbell" }, [skipped])
  assert.equal(result.action, "keep")
  assert.equal(result.previousWeightKg, null)
})
