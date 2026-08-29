import { useState } from "react"
import { Check, LoaderCircle } from "lucide-react"

export function AdaptiveCalorieSettings({ enabled, onToggle }: { enabled: boolean; onToggle: (enabled: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError("")
    try { await onToggle(!enabled) }
    catch (toggleError) { setError(toggleError instanceof Error ? toggleError.message : "Could not update this setting.") }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-800 p-4">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-slate-200">Adaptive Calorie Reviews</p><p className="mt-1 text-xs leading-5 text-slate-500">Uses your logged food and weight trend to periodically review your calorie target.</p></div>
        <button type="button" role="switch" aria-checked={enabled} disabled={busy} onClick={toggle} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${enabled ? "bg-blue-500" : "bg-slate-700"}`}>
          <span className={`absolute top-1 grid size-5 place-items-center rounded-full bg-white text-blue-600 transition ${enabled ? "left-6" : "left-1"}`}>{busy ? <LoaderCircle className="size-3 animate-spin" /> : enabled && <Check className="size-3" />}</span>
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">Changes are never applied automatically. This is a general estimate, not medical advice.</p>
      {error && <p className="mt-3 rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}
    </div>
  )
}
