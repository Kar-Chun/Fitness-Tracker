import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CALORIE_REVIEW_MESSAGES, type AdaptiveReviewResult } from "../../lib/calorie-adaptation.ts"

interface CalorieReviewPanelProps {
  result: AdaptiveReviewResult
  onAccept: () => Promise<void>
  onKeep: () => Promise<void>
}

export function CalorieReviewPanel({ result, onAccept, onKeep }: CalorieReviewPanelProps) {
  const [busy, setBusy] = useState<"accept" | "keep" | null>(null)
  const [error, setError] = useState("")
  const hasSuggestion = result.suggestedTarget !== null

  async function run(action: "accept" | "keep") {
    if (busy) return
    setBusy(action)
    setError("")
    try { await (action === "accept" ? onAccept() : onKeep()) }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Could not save this review.") }
    finally { setBusy(null) }
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-950 p-4">
        <div><p className="text-xs text-slate-500">Current target</p><p className="mt-1 text-xl font-semibold">{result.currentTarget.toLocaleString()} kcal</p></div>
        <div><p className="text-xs text-slate-500">Data quality</p><p className="mt-1 text-sm font-medium text-slate-200">{result.dataQuality.label}</p></div>
        <div><p className="text-xs text-slate-500">Weight trend</p><p className="mt-1 text-sm font-medium text-slate-200">{result.previousWeightAverage?.toFixed(1)} → {result.currentWeightAverage?.toFixed(1)} kg</p></div>
        <div><p className="text-xs text-slate-500">Complete-day average</p><p className="mt-1 text-sm font-medium text-slate-200">{result.averageCalories?.toLocaleString()} kcal</p></div>
      </div>
      <div><p className="text-sm font-medium text-slate-300">Result</p><p className="mt-2 text-sm leading-6 text-slate-400">{CALORIE_REVIEW_MESSAGES[result.reasonCode]}</p></div>
      {hasSuggestion && <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4"><p className="text-xs text-blue-300">Small suggested adjustment</p><p className="mt-1 text-2xl font-semibold">{result.currentTarget.toLocaleString()} → {result.suggestedTarget?.toLocaleString()} kcal</p></div>}
      <p className="text-xs leading-5 text-slate-500">This is a general wellness estimate based on logged data, not a medical measurement. Exercise calories are not added to your allowance.</p>
      {error && <p className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {hasSuggestion && <Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" disabled={Boolean(busy)} onClick={() => run("accept")}>{busy === "accept" && <LoaderCircle className="animate-spin" />} Accept {result.suggestedTarget?.toLocaleString()}</Button>}
        <Button size="lg" variant="outline" className="h-11" disabled={Boolean(busy)} onClick={() => run("keep")}>{busy === "keep" && <LoaderCircle className="animate-spin" />} Keep {result.currentTarget.toLocaleString()}</Button>
      </div>
    </div>
  )
}
