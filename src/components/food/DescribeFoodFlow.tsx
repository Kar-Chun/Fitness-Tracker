import { useState, type FormEvent } from "react"
import { ArrowLeft, Check, LoaderCircle, Pencil, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toLocalDateTimeInput } from "../../lib/date.ts"
import { nutrientsForEditedGrams, rangeForEditedTotal, totalsFromEstimateItems } from "../../lib/food-estimate.ts"
import type { FoodEstimate, FoodEstimateItem, FoodEstimateLogInput, MealType } from "../../types/fitness.ts"
import { FieldShell, Input, Select } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"

const DESCRIPTION_LIMIT = 500

interface DescribeFoodFlowProps {
  defaultMealType: MealType
  onAnalyze: (description: string) => Promise<FoodEstimate>
  onLog: (input: FoodEstimateLogInput) => Promise<void>
  onBack: () => void
}

export function DescribeFoodFlow({ defaultMealType, onAnalyze, onLog, onBack }: DescribeFoodFlowProps) {
  const [description, setDescription] = useState("")
  const [estimate, setEstimate] = useState<FoodEstimate | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState("")

  async function analyze(event: FormEvent) {
    event.preventDefault()
    const trimmed = description.trim()
    if (!trimmed) return setError("Describe what you ate first.")
    if (trimmed.length > DESCRIPTION_LIMIT) return setError(`Keep the description under ${DESCRIPTION_LIMIT} characters.`)
    setAnalyzing(true)
    setError("")
    try {
      setEstimate(await onAnalyze(trimmed))
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Could not estimate this meal. Please try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  if (estimate) {
    return (
      <FoodEstimateReview
        estimate={estimate}
        defaultMealType={defaultMealType}
        onLog={onLog}
        onTryAgain={() => setEstimate(null)}
      />
    )
  }

  return (
    <form className="grid gap-4" onSubmit={analyze}>
      <button type="button" className="flex items-center gap-2 text-left text-sm text-slate-500 hover:text-slate-300" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to quick add
      </button>
      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
        <div className="flex items-center gap-2 font-semibold text-blue-100"><Sparkles className="size-4" /> Describe your meal</div>
        <p className="mt-2 text-sm leading-6 text-slate-400">Use everyday language. You will review and edit the estimate before anything is logged.</p>
      </div>
      <FieldShell label="Meal description" htmlFor="meal-description" hint={`${description.length}/${DESCRIPTION_LIMIT}`}>
        <textarea
          id="meal-description"
          className="min-h-32 w-full resize-y rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          value={description}
          maxLength={DESCRIPTION_LIMIT}
          autoFocus
          placeholder="e.g. caifan with half rice, curry chicken, fried egg and cabbage"
          onChange={(event) => setDescription(event.target.value)}
        />
      </FieldShell>
      <InlineError message={error} />
      <Button type="submit" size="lg" className="h-12 bg-blue-500 hover:bg-blue-400" disabled={analyzing || !description.trim()}>
        {analyzing ? <><LoaderCircle className="animate-spin" /> Estimating your meal...</> : <><Sparkles /> Analyze meal</>}
      </Button>
      <p className="text-center text-xs leading-5 text-slate-500">AI interprets the description. Nutrition is matched to your history and USDA data where possible, then clearly marked as estimated.</p>
    </form>
  )
}

interface FoodEstimateReviewProps {
  estimate: FoodEstimate
  defaultMealType: MealType
  onLog: (input: FoodEstimateLogInput) => Promise<void>
  onTryAgain: () => void
  previewUrl?: string
  uncertainties?: string[]
}

export function FoodEstimateReview({ estimate, defaultMealType, onLog, onTryAgain, previewUrl, uncertainties = [] }: FoodEstimateReviewProps) {
  const [name, setName] = useState(estimate.mealName)
  const [items, setItems] = useState(estimate.items)
  const [totalCalories, setTotalCalories] = useState(estimate.totalCalories)
  const [totalProtein, setTotalProtein] = useState(estimate.totalProteinG)
  const [calorieRange, setCalorieRange] = useState(estimate.calorieRange)
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [eatenAt, setEatenAt] = useState(toLocalDateTimeInput())
  const [editingItems, setEditingItems] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function replaceItems(nextItems: FoodEstimateItem[]) {
    const totals = totalsFromEstimateItems(nextItems)
    setItems(nextItems)
    setTotalCalories(totals.calories)
    setTotalProtein(totals.proteinG)
    setCalorieRange(totals.calorieRange)
  }

  function updateItem(index: number, patch: Partial<FoodEstimateItem>) {
    replaceItems(items.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      if (typeof patch.calories === "number") {
        const calories = Math.max(0, patch.calories)
        return { ...item, ...patch, calories, calorieRange: rangeForEditedTotal(item.calorieRange, item.calories, calories) }
      }
      return { ...item, ...patch }
    }))
  }

  function updateGrams(index: number, grams: number) {
    replaceItems(items.map((item, itemIndex) => itemIndex === index ? nutrientsForEditedGrams(item, grams) : item))
  }

  function updateTotalCalories(value: number) {
    const safeValue = Math.max(0, Math.round(value))
    setCalorieRange(rangeForEditedTotal(calorieRange, totalCalories, safeValue))
    setTotalCalories(safeValue)
  }

  async function logMeal() {
    if (saving) return
    if (!name.trim() || !Number.isFinite(totalCalories) || totalCalories <= 0 || !Number.isFinite(totalProtein) || totalProtein < 0) {
      return setError("Check the meal name, calories, and protein before logging.")
    }
    setSaving(true)
    setError("")
    try {
      await onLog({
        name: name.trim(),
        calories: Math.round(totalCalories),
        proteinG: Math.round(totalProtein * 10) / 10,
        mealType,
        eatenAt,
        source: estimate.source,
        confidence: estimate.confidence,
        estimateLowCalories: Math.min(Math.round(totalCalories), Math.round(calorieRange.low)),
        estimateHighCalories: Math.max(Math.round(totalCalories), Math.round(calorieRange.high)),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not log this meal.")
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      {previewUrl && <img src={previewUrl} alt="Selected meal" className="max-h-64 w-full rounded-2xl border border-slate-800 bg-slate-950 object-contain" />}
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Estimated</p><h3 className="mt-1 text-xl font-semibold">{name}</h3></div>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs capitalize text-slate-300">{estimate.confidence} confidence</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        {items.map((item, index) => (
          <div key={`${index}-${item.name}`} className={`bg-slate-950/50 p-4 ${index ? "border-t border-slate-800" : ""}`}>
            {editingItems ? (
              <div className="grid gap-3">
                <Input aria-label={`Item ${index + 1} name`} value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <FieldShell label="Grams" htmlFor={`estimate-grams-${index}`}><Input id={`estimate-grams-${index}`} type="number" min="0" step="1" inputMode="decimal" value={item.estimatedGrams} onChange={(event) => updateGrams(index, Number(event.target.value))} /></FieldShell>
                  <FieldShell label="Calories" htmlFor={`estimate-cal-${index}`}><Input id={`estimate-cal-${index}`} type="number" min="0" step="1" inputMode="numeric" value={item.calories} onChange={(event) => updateItem(index, { calories: Math.max(0, Number(event.target.value)) })} /></FieldShell>
                  <FieldShell label="Protein" htmlFor={`estimate-protein-${index}`}><Input id={`estimate-protein-${index}`} type="number" min="0" step="0.1" inputMode="decimal" value={item.proteinG} onChange={(event) => updateItem(index, { proteinG: Math.max(0, Number(event.target.value)) })} /></FieldShell>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.estimatedGrams > 0 ? `~${item.estimatedGrams}g · ` : ""}{item.portionDescription}</p><p className="mt-1 text-xs capitalize text-slate-600">{sourceLabel(item.source)}</p></div>
                <div className="shrink-0 text-right"><p className="font-semibold">~{item.calories} kcal</p><p className="mt-1 text-xs text-slate-500">~{item.proteinG}g protein</p></div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
        {editingTotal ? (
          <div className="grid gap-3">
            <FieldShell label="Meal name" htmlFor="estimate-name"><Input id="estimate-name" value={name} onChange={(event) => setName(event.target.value)} /></FieldShell>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldShell label="Total calories" htmlFor="estimate-total-cal"><Input id="estimate-total-cal" type="number" min="1" step="1" inputMode="numeric" value={totalCalories} onChange={(event) => updateTotalCalories(Number(event.target.value))} /></FieldShell>
              <FieldShell label="Total protein" htmlFor="estimate-total-protein"><Input id="estimate-total-protein" type="number" min="0" step="0.1" inputMode="decimal" value={totalProtein} onChange={(event) => setTotalProtein(Math.max(0, Number(event.target.value)))} /></FieldShell>
            </div>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-4"><div><p className="text-sm text-slate-400">Estimated total</p><p className="mt-1 text-3xl font-semibold">~{totalCalories} <span className="text-base font-normal text-slate-400">kcal</span></p><p className="mt-1 text-sm text-slate-400">~{totalProtein}g protein · ~{calorieRange.low}–{calorieRange.high} kcal</p></div></div>
        )}
      </div>
      <p className="text-sm leading-6 text-slate-400">{estimate.sourceSummary}</p>
      {uncertainties.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm font-medium text-amber-100">Photo uncertainty</p>
          <ul className="mt-2 grid gap-1 text-sm leading-5 text-slate-400">{uncertainties.map((note) => <li key={note}>• {note}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" className="h-11" onClick={() => setEditingItems((current) => !current)}><Pencil /> {editingItems ? "Done" : "Edit items"}</Button>
        <Button variant="outline" className="h-11" onClick={() => setEditingTotal((current) => !current)}><Pencil /> {editingTotal ? "Done" : "Edit total"}</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell label="Meal" htmlFor="estimate-meal"><Select id="estimate-meal" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}><MealOptions /></Select></FieldShell>
        <FieldShell label="Date and time" htmlFor="estimate-time"><Input id="estimate-time" type="datetime-local" value={eatenAt} onChange={(event) => setEatenAt(event.target.value)} /></FieldShell>
      </div>
      <InlineError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" className="h-12" disabled={saving} onClick={onTryAgain}><RotateCcw /> Try again</Button>
        <Button size="lg" className="h-12 bg-blue-500 hover:bg-blue-400" disabled={saving} onClick={logMeal}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />} Log meal</Button>
      </div>
      <p className="text-center text-xs leading-5 text-slate-500">This is an estimate, not verified nutrition information.</p>
    </div>
  )
}

function sourceLabel(source: FoodEstimateItem["source"]) {
  if (source === "usda") return "USDA nutrition match"
  if (source === "ai_estimate") return "AI nutrition estimate"
  if (source === "saved_meal") return "Saved meal"
  if (source === "favourite") return "Favourite"
  return "Food history"
}

function MealOptions() {
  return <><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></>
}
