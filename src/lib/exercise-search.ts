import type { CustomExerciseInput, ExerciseLibraryItem, WorkoutSessionWithDetails } from "../types/fitness.ts"

export function normalizeExerciseSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

interface ExerciseUsage {
  count: number
  lastUsedAt: string
}

function getExerciseUsage(sessions: WorkoutSessionWithDetails[]) {
  const usage = new Map<string, ExerciseUsage>()
  sessions
    .filter((session) => Boolean(session.completed_at))
    .forEach((session) => session.session_exercises.forEach((exercise) => {
      if (exercise.status !== "completed") return
      const key = exercise.exercise_id ?? `name:${normalizeExerciseSearch(exercise.exercise_name_snapshot)}`
      const current = usage.get(key)
      usage.set(key, {
        count: (current?.count ?? 0) + 1,
        lastUsedAt: [current?.lastUsedAt ?? "", session.completed_at ?? ""].sort().at(-1) ?? "",
      })
    }))
  return usage
}

function matchScore(name: string, query: string) {
  if (!query) return 0
  if (name === query) return 10_000
  if (name.startsWith(query)) return 8_000
  if (name.includes(query)) return 6_000
  const nameTokens = name.split(" ")
  const queryTokens = query.split(" ")
  if (!queryTokens.every((queryToken) => nameTokens.some((nameToken) => nameToken.includes(queryToken)))) return -1
  return 4_000 + queryTokens.reduce((score, token) => score + (nameTokens.some((nameToken) => nameToken.startsWith(token)) ? 20 : 5), 0)
}

export interface RankedExercise extends ExerciseLibraryItem {
  usageCount: number
  lastUsedAt: string
}

export async function createAndAddExercise(
  input: CustomExerciseInput,
  create: (input: CustomExerciseInput) => Promise<ExerciseLibraryItem>,
  add: (exercise: ExerciseLibraryItem) => Promise<void> | void,
) {
  const created = await create(input)
  await add(created)
  return created
}

export function rankExercises(
  library: ExerciseLibraryItem[],
  sessions: WorkoutSessionWithDetails[],
  query: string,
  excludedIds: string[] = [],
  limit = 8,
): RankedExercise[] {
  const normalizedQuery = normalizeExerciseSearch(query)
  const excluded = new Set(excludedIds)
  const usage = getExerciseUsage(sessions)

  return library
    .filter((exercise) => !excluded.has(exercise.id))
    .map((exercise) => {
      const normalizedName = normalizeExerciseSearch(exercise.name)
      const score = matchScore(normalizedName, normalizedQuery)
      const exerciseUsage = usage.get(exercise.id) ?? usage.get(`name:${normalizedName}`)
      return {
        ...exercise,
        score,
        usageCount: exerciseUsage?.count ?? 0,
        lastUsedAt: exerciseUsage?.lastUsedAt ?? "",
      }
    })
    .filter((exercise) => exercise.score >= 0)
    .sort((a, b) => {
      if (normalizedQuery && a.score !== b.score) return b.score - a.score
      const aUsed = a.usageCount > 0 ? 1 : 0
      const bUsed = b.usageCount > 0 ? 1 : 0
      if (aUsed !== bUsed) return bUsed - aUsed
      if (a.lastUsedAt !== b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt)
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
      const aCustom = a.user_id ? 1 : 0
      const bCustom = b.user_id ? 1 : 0
      if (aCustom !== bCustom) return bCustom - aCustom
      return a.name.localeCompare(b.name)
    })
    .slice(0, limit)
    .map(({ score: _score, ...exercise }) => exercise)
}
