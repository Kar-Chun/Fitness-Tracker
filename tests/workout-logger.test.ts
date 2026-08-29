import assert from "node:assert/strict"
import test from "node:test"
import { createAndAddExercise, normalizeExerciseSearch, rankExercises } from "../src/lib/exercise-search.ts"
import { copyLastSets, getFirstSetError, getSetDraftState, getValidSetValues } from "../src/lib/workout-logger.ts"
import type { ExerciseLibraryItem, WorkoutSessionExercise, WorkoutSessionWithDetails } from "../src/types/fitness.ts"

function exercise(id: string, name: string, userId: string | null = null): ExerciseLibraryItem {
  return { id, user_id: userId, name, category: "chest", load_type: "per_dumbbell", progression_step_kg: 2.5, requires_dumbbells: true, requires_bench: false, requires_pull_up_bar: false, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }
}

function session(id: string, completedAt: string | null, performed: Array<{ id: string; name: string }>): WorkoutSessionWithDetails {
  return {
    id, user_id: "user", template_id: null, template_name: "Workout", mode: "normal", readiness: null, title: "Workout", logged_retrospectively: false,
    started_at: "2026-08-01T10:00:00Z", completed_at: completedAt, sets: [],
    session_exercises: performed.map((item, index) => ({ id: `${id}-${index}`, user_id: "user", session_id: id, exercise_id: item.id, exercise_name_snapshot: item.name, position: index, load_type: "per_dumbbell", target_sets: 3, target_rep_min: 8, target_rep_max: 12, progression_step_kg: 2.5, status: "completed", created_at: "2026-08-01T10:00:00Z", sets: [] })),
  }
}

const library = [
  exercise("bench", "Dumbbell Bench Press"),
  exercise("incline", "Incline Dumbbell Bench Press"),
  exercise("lateral", "Dumbbell Lateral Raise"),
  exercise("rear", "Rear Delt Fly", "user"),
]

test("exercise search is case-insensitive, space-normalized, and supports partial tokens", () => {
  assert.equal(normalizeExerciseSearch("  DUMBBELL   bench "), "dumbbell bench")
  assert.deepEqual(rankExercises(library, [], "BENCH").map((item) => item.id), ["bench", "incline"])
  assert.deepEqual(rankExercises(library, [], "rear delt").map((item) => item.id), ["rear"])
})

test("exercise search includes user exercises and ranks recent completed use first", () => {
  const sessions = [
    session("old", "2026-08-20T10:00:00Z", [{ id: "bench", name: "Dumbbell Bench Press" }]),
    session("recent", "2026-08-29T10:00:00Z", [{ id: "lateral", name: "Dumbbell Lateral Raise" }]),
    session("unfinished", null, [{ id: "incline", name: "Incline Dumbbell Bench Press" }]),
  ]
  const ranked = rankExercises(library, sessions, "")
  assert.equal(ranked[0]?.id, "lateral")
  assert.equal(ranked[1]?.id, "bench")
  assert.equal(ranked.some((item) => item.id === "rear" && item.user_id === "user"), true)
})

test("no exercise match leaves room for the inline custom creation option", () => {
  assert.deepEqual(rankExercises(library, [], "Cable-style Dumbbell Row"), [])
})

test("Create & Add persists the custom exercise before adding it to the current draft", async () => {
  const actions: string[] = []
  const created = exercise("custom", "Cable-style Dumbbell Row", "user")
  const result = await createAndAddExercise(
    { name: created.name, category: "back", loadType: "per_dumbbell", progressionStepKg: 2.5 },
    async () => { actions.push("persisted"); return created },
    async (item) => { actions.push(`added:${item.id}`) },
  )
  assert.deepEqual(actions, ["persisted", "added:custom"])
  assert.equal(result, created)
})

test("filled rows count as performed without a completion tick and blank rows are ignored", () => {
  assert.equal(getSetDraftState({ weight: "15", reps: "10" }, "per_dumbbell"), "valid")
  assert.equal(getSetDraftState({ weight: "", reps: "" }, "per_dumbbell"), "blank")
  assert.deepEqual(getValidSetValues({ weight: "15", reps: "10" }, "per_dumbbell"), { weightKg: 15, reps: 10 })
  assert.equal(getValidSetValues({ weight: "", reps: "" }, "per_dumbbell"), null)
})

test("bodyweight rows need reps only and partial weighted rows are rejected on Finish", () => {
  assert.equal(getSetDraftState({ weight: "", reps: "12" }, "bodyweight"), "valid")
  assert.equal(getSetDraftState({ weight: "15", reps: "" }, "per_dumbbell"), "partial")
  assert.match(getFirstSetError([{ exerciseName: "Bench Press", loadType: "per_dumbbell", sets: [{ weight: "15", reps: "" }] }]) ?? "", /enter both weight and reps/i)
})

test("Copy Last Sets creates editable values without mutating history", () => {
  const previous: WorkoutSessionExercise = {
    id: "performed", user_id: "user", session_id: "previous", exercise_id: "bench", exercise_name_snapshot: "Dumbbell Bench Press", position: 0, load_type: "per_dumbbell", target_sets: 3, target_rep_min: 8, target_rep_max: 12, progression_step_kg: 2.5, status: "completed", created_at: "2026-08-20T10:00:00Z",
    sets: [10, 10, 8].map((reps, index) => ({ id: `set-${index}`, user_id: "user", session_id: "previous", session_exercise_id: "performed", exercise_name: "Dumbbell Bench Press", set_number: index + 1, weight_kg: 15, reps, created_at: "2026-08-20T10:00:00Z" })),
  }
  const snapshot = JSON.stringify(previous)
  const copied = copyLastSets(previous, 3)
  copied[2]!.reps = "9"
  assert.deepEqual(copied.slice(0, 2), [{ weight: "15", reps: "10" }, { weight: "15", reps: "10" }])
  assert.equal(JSON.stringify(previous), snapshot)
})

test("a partial workout can omit untouched exercises and keep performed rows", () => {
  const bench = [{ weight: "15", reps: "10" }, { weight: "15", reps: "9" }]
  const fly = [{ weight: "", reps: "" }]
  assert.equal(bench.map((set) => getValidSetValues(set, "per_dumbbell")).filter(Boolean).length, 2)
  assert.equal(fly.map((set) => getValidSetValues(set, "per_dumbbell")).filter(Boolean).length, 0)
  assert.equal(getFirstSetError([{ exerciseName: "Bench", loadType: "per_dumbbell", sets: bench }, { exerciseName: "Fly", loadType: "per_dumbbell", sets: fly }]), null)
})
