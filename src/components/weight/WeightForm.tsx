import { useState, type FormEvent } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { toLocalDateKey } from "../../lib/date.ts"

interface WeightFormProps {
  latestWeight?: number | null
  onSubmit: (weightKg: number, recordedOn: string) => Promise<void>
  onCancel: () => void
}

export function WeightForm({ latestWeight, onSubmit, onCancel }: WeightFormProps) {
  const [weight, setWeight] = useState(latestWeight ? String(latestWeight) : "")
  const [date, setDate] = useState(toLocalDateKey())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(weight)
    if (!Number.isFinite(value) || value <= 0 || value >= 500) {
      return setError("Enter a weight between 1 and 499 kg.")
    }
    setSubmitting(true)
    setError("")
    try {
      await onSubmit(value, date)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save your weight.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FieldShell label="Weight in kg" htmlFor="weight-value">
        <Input id="weight-value" type="number" min="1" max="499" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} autoFocus />
      </FieldShell>
      <FieldShell label="Date" htmlFor="weight-date">
        <Input id="weight-date" type="date" max={toLocalDateKey()} value={date} onChange={(event) => setDate(event.target.value)} />
      </FieldShell>
      <p className="text-xs leading-5 text-slate-500">Logging again for the same date replaces that day’s entry.</p>
      <InlineError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-spin" />} Save weight
        </Button>
      </div>
    </form>
  )
}
