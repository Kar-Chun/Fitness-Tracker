import { calculateCalorieTarget } from "../lib/calculations.ts"
import { toLocalDateKey } from "../lib/date.ts"
import { supabase } from "../lib/supabase.ts"
import { ensureDefaultWorkoutTemplates } from "./workout.ts"
import { upsertWeight } from "./weight.ts"
import type { EquipmentSettingsInput, OnboardingInput, Profile } from "../types/fitness.ts"

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Profile | null
}

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const target = calculateCalorieTarget({
    age: input.age,
    sex: input.sex,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    goal: input.goal,
    activityLevel: input.activityLevel,
  })

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: userId,
    age: input.age,
    sex: input.sex,
    height_cm: input.heightCm,
    goal: input.goal,
    activity_level: input.activityLevel,
    onboarding_completed: false,
  })
  if (profileError) throw new Error(profileError.message)

  const { data: existingTarget, error: targetLookupError } = await supabase
    .from("calorie_targets")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "initial_estimate")
    .maybeSingle()
  if (targetLookupError) throw new Error(targetLookupError.message)

  const targetPayload = {
    user_id: userId,
    calories: target,
    effective_from: toLocalDateKey(),
    reason: "initial_estimate",
  }
  const targetResult = existingTarget
    ? await supabase.from("calorie_targets").update(targetPayload).eq("id", existingTarget.id)
    : await supabase.from("calorie_targets").insert(targetPayload)
  if (targetResult.error) throw new Error(targetResult.error.message)

  await upsertWeight(userId, input.weightKg, toLocalDateKey())
  await ensureDefaultWorkoutTemplates(userId)
  const { error: completionError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", userId)
  if (completionError) throw new Error(completionError.message)
  return target
}

export async function saveEquipmentSettings(userId: string, input: EquipmentSettingsInput) {
  if (input.hasAdjustableDumbbells && (input.dumbbellMaxKg === null || input.dumbbellMaxKg <= 0)) {
    throw new Error("Enter a valid maximum dumbbell weight.")
  }
  const { error } = await supabase.from("profiles").update({
    has_adjustable_dumbbells: input.hasAdjustableDumbbells,
    dumbbell_max_kg: input.hasAdjustableDumbbells ? input.dumbbellMaxKg : null,
    has_bench: input.hasBench,
    has_pull_up_bar: input.hasPullUpBar,
  }).eq("user_id", userId)
  if (error) throw new Error(error.message)
}
