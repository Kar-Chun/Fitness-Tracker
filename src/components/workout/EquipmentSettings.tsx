import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import type { EquipmentSettingsInput, Profile } from "../../types/fitness.ts"

export function EquipmentSettings({ profile, onSave }: { profile: Profile; onSave: (input: EquipmentSettingsInput) => Promise<void> }) {
  const [dumbbells, setDumbbells] = useState(profile.has_adjustable_dumbbells)
  const [maximum, setMaximum] = useState(profile.dumbbell_max_kg === null ? "20" : String(profile.dumbbell_max_kg))
  const [bench, setBench] = useState(profile.has_bench)
  const [pullUpBar, setPullUpBar] = useState(profile.has_pull_up_bar)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    const dumbbellMaxKg = dumbbells ? Number(maximum) : null
    if (dumbbells && (!Number.isFinite(dumbbellMaxKg) || (dumbbellMaxKg ?? 0) <= 0)) return setError("Enter a valid dumbbell maximum.")
    setSaving(true)
    setError("")
    try {
      await onSave({ hasAdjustableDumbbells: dumbbells, dumbbellMaxKg, hasBench: bench, hasPullUpBar: pullUpBar })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save equipment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-5 border-t border-slate-800 pt-5">
      <h3 className="font-medium text-slate-100">Equipment</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">Used only to clarify loads and avoid unavailable progression suggestions.</p>
      <div className="mt-4 grid gap-4">
        <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl bg-slate-950 p-3 text-sm"><span>Adjustable dumbbells</span><input type="checkbox" className="size-5 accent-blue-500" checked={dumbbells} onChange={(event) => setDumbbells(event.target.checked)} /></label>
        {dumbbells && <FieldShell label="Maximum per dumbbell" hint="kg each" htmlFor="equipment-dumbbell-max"><Input id="equipment-dumbbell-max" type="number" min="0.5" step="0.5" inputMode="decimal" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></FieldShell>}
        <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl bg-slate-950 p-3 text-sm"><span>Bench available</span><input type="checkbox" className="size-5 accent-blue-500" checked={bench} onChange={(event) => setBench(event.target.checked)} /></label>
        <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl bg-slate-950 p-3 text-sm"><span>Pull-up bar available</span><input type="checkbox" className="size-5 accent-blue-500" checked={pullUpBar} onChange={(event) => setPullUpBar(event.target.checked)} /></label>
      </div>
      <InlineError message={error} />
      <Button className="mt-4 w-full" variant="outline" disabled={saving} onClick={save}>{saving && <LoaderCircle className="animate-spin" />} Save equipment</Button>
    </section>
  )
}
