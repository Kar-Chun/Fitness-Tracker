import { useState, type FormEvent } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input, Select } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { toLocalDateTimeInput } from "../../lib/date.ts"
import type { FoodEntry, FoodEntryInput, MealType } from "../../types/fitness.ts"

interface FoodEntryFormProps {
  entry?: FoodEntry
  onSubmit: (input: FoodEntryInput) => Promise<void>
  onCancel: () => void
}

export function FoodEntryForm({ entry, onSubmit, onCancel }: FoodEntryFormProps) {
  const [name, setName] = useState(entry?.name ?? "")
  const [calories, setCalories] = useState(entry ? String(entry.calories) : "")
  const [protein, setProtein] = useState(entry?.protein_g === null || !entry ? "" : String(entry.protein_g))
  const [mealType, setMealType] = useState<MealType>(entry?.meal_type ?? "breakfast")
  const [eatenAt, setEatenAt] = useState(toLocalDateTimeInput(entry?.eaten_at))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const calorieValue = Number(calories)
    const proteinValue = protein === "" ? null : Number(protein)
    if (!name.trim()) return setError("Enter a food or meal name.")
    if (!Number.isFinite(calorieValue) || calorieValue < 0 || calorieValue > 10000) {
      return setError("Calories must be between 0 and 10,000.")
    }
    if (proteinValue !== null && (!Number.isFinite(proteinValue) || proteinValue < 0 || proteinValue > 1000)) {
      return setError("Protein must be between 0 and 1,000 grams.")
    }
    if (!eatenAt) return setError("Choose when you ate this food.")

    setSubmitting(true)
    setError("")
    try {
      await onSubmit({
        name: name.trim(),
        calories: Math.round(calorieValue),
        proteinG: proteinValue,
        mealType,
        eatenAt,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save this food entry.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <FieldShell label="Food or meal name" htmlFor="food-name">
        <Input id="food-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />
      </FieldShell>
      <div className="grid grid-cols-2 gap-3">
        <FieldShell label="Calories" htmlFor="food-calories">
          <Input id="food-calories" type="number" min="0" max="10000" inputMode="numeric" value={calories} onChange={(event) => setCalories(event.target.value)} />
        </FieldShell>
        <FieldShell label="Protein" hint="optional" htmlFor="food-protein">
          <Input id="food-protein" type="number" min="0" max="1000" step="0.1" inputMode="decimal" value={protein} onChange={(event) => setProtein(event.target.value)} />
        </FieldShell>
      </div>
      <FieldShell label="Meal" htmlFor="food-meal">
        <Select id="food-meal" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </Select>
      </FieldShell>
      <FieldShell label="Date and time" htmlFor="food-time">
        <Input id="food-time" type="datetime-local" value={eatenAt} onChange={(event) => setEatenAt(event.target.value)} />
      </FieldShell>
      <InlineError message={error} />
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-spin" />} {entry ? "Save changes" : "Add food"}
        </Button>
      </div>
    </form>
  )
}
