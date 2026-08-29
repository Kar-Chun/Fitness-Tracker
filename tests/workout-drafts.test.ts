import assert from "node:assert/strict"
import test from "node:test"
import { copySessionToDraft, createRoutineWorkoutDraft, loadTypeLabel, replaceDraftExercise, routineToInput } from "../src/lib/workout-drafts.ts"
import type { WorkoutSessionWithDetails, WorkoutTemplate } from "../src/types/fitness.ts"

const routine: WorkoutTemplate = {
  id: "routine",
  user_id: "user",
  name: "Chest + Triceps",
  created_at: "2026-08-01T00:00:00Z",
  exercises: [
    { id: "planned-1", user_id: "user", template_id: "routine", exercise_id: "bench", exercise_name: "Dumbbell Bench Press", position: 0, target_sets: 3, target_rep_min: 8, target_rep_max: 12, progression_step_kg: 2.5, include_in_light: true, light_target_sets: 2, load_type: "per_dumbbell" },
    { id: "planned-2", user_id: "user", template_id: "routine", exercise_id: "fly", exercise_name: "Dumbbell Fly", position: 1, target_sets: 2, target_rep_min: 10, target_rep_max: 15, progression_step_kg: 2.5, include_in_light: false, light_target_sets: null, load_type: "per_dumbbell" },
  ],
}

const previous: WorkoutSessionWithDetails = {
  id: "previous",
  user_id: "user",
  template_id: "routine",
  template_name: routine.name,
  mode: "normal",
  readiness: null,
  title: routine.name,
  logged_retrospectively: false,
  started_at: "2026-08-20T10:00:00Z",
  completed_at: "2026-08-20T11:00:00Z",
  sets: [],
  session_exercises: [{
    id: "performed-bench",
    user_id: "user",
    session_id: "previous",
    exercise_id: "bench",
    exercise_name_snapshot: "Dumbbell Bench Press",
    position: 0,
    load_type: "per_dumbbell",
    target_sets: 3,
    target_rep_min: 8,
    target_rep_max: 12,
    progression_step_kg: 2.5,
    status: "completed",
    created_at: "2026-08-20T10:00:00Z",
    sets: [10, 10, 8].map((reps, index) => ({ id: `set-${index}`, user_id: "user", session_id: "previous", session_exercise_id: "performed-bench", exercise_name: "Dumbbell Bench Press", set_number: index + 1, weight_kg: 15, reps, created_at: "2026-08-20T10:00:00Z" })),
  }],
}

test("routine order is preserved and Light includes only selected exercises", () => {
  assert.deepEqual(routineToInput(routine).exercises.map((exercise) => exercise.exerciseName), ["Dumbbell Bench Press", "Dumbbell Fly"])
  const light = createRoutineWorkoutDraft(routine, [previous], "light")
  assert.deepEqual(light.map((exercise) => exercise.exerciseName), ["Dumbbell Bench Press"])
  assert.equal(light[0]?.sets.length, 2)
})

test("a new routine draft does not silently copy previous performance", () => {
  const draft = createRoutineWorkoutDraft(routine, [previous], "normal")
  assert.deepEqual(draft[0]?.sets.map((set) => [set.weightKg, set.reps]), [[null, 0], [null, 0], [null, 0]])
  assert.equal(draft[0]?.sets.every((set) => !set.completed), true)
  assert.equal(previous.session_exercises[0]?.sets.length, 3)
})

test("Copy Last creates identity-free draft values and leaves history unchanged", () => {
  const snapshot = JSON.stringify(previous)
  const copied = copySessionToDraft(previous)
  assert.equal("id" in (copied[0] ?? {}), false)
  assert.deepEqual(copied[0]?.sets.map((set) => set.reps), [10, 10, 8])
  if (copied[0]?.sets[2]) copied[0].sets[2].reps = 9
  assert.equal(JSON.stringify(previous), snapshot)
})

test("session-only replacement does not mutate the source routine", () => {
  const draft = createRoutineWorkoutDraft(routine, [previous], "normal")
  const replaced = replaceDraftExercise(draft, 1, { id: "push-up", name: "Push-Up", load_type: "bodyweight", progression_step_kg: null })
  assert.equal(replaced[1]?.exerciseName, "Push-Up")
  assert.equal(routine.exercises[1]?.exercise_name, "Dumbbell Fly")
})

test("per-dumbbell load semantics remain explicit", () => {
  assert.equal(loadTypeLabel("per_dumbbell"), "kg each")
  assert.equal(loadTypeLabel("total"), "kg total")
})
