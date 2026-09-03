import type { WorkoutSessionWithDetails } from "../types/fitness.ts"

export function sameExerciseIdentity(
  exerciseId: string | null,
  exerciseName: string,
  candidateId: string | null,
  candidateName: string,
) {
  if (exerciseId && candidateId) return exerciseId === candidateId
  return exerciseName === candidateName
}

export function completedNormalSessions(sessions: WorkoutSessionWithDetails[]) {
  return sessions
    .filter((session) => session.completed_at && session.mode === "normal")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
}
