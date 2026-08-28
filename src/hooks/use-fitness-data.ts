import { useCallback, useEffect, useState } from "react"
import { loadFitnessData } from "../services/fitness.ts"
import type { FitnessData } from "../types/fitness.ts"

export function useFitnessData(userId: string) {
  const [data, setData] = useState<FitnessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setError("")
    try {
      setData(await loadFitnessData(userId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your fitness data.")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- this starts the external Supabase sync.
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
