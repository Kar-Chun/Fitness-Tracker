import { supabase } from "../lib/supabase.ts"
import { daysAgo, toLocalDateKey } from "../lib/date.ts"
import type { FitnessData, WeightEntry } from "../types/fitness.ts"

export type WeightData = Pick<FitnessData, "weightEntries">

export async function loadWeightEntries(userId: string) {
  const { data, error } = await supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("recorded_on", toLocalDateKey(daysAgo(60)))
    .order("recorded_on", { ascending: false })
  if (error) throw new Error(error.message)
  return data as WeightEntry[]
}

export async function loadWeightData(userId: string): Promise<WeightData> {
  return { weightEntries: await loadWeightEntries(userId) }
}

export async function upsertWeight(userId: string, weightKg: number, recordedOn: string) {
  const { error } = await supabase
    .from("weight_entries")
    .upsert(
      { user_id: userId, weight_kg: weightKg, recorded_on: recordedOn },
      { onConflict: "user_id,recorded_on" },
    )
  if (error) throw new Error(error.message)
}
