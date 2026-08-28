import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, LoaderCircle, Pencil, Plus, RotateCcw, Save, Star, Trash2, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { caloriesConsumed, caloriesRemaining } from "../lib/calculations.ts"
import { formatDateTime, formatShortDate, toLocalDateKey, toLocalDateTimeInput } from "../lib/date.ts"
import { getRecentFoods, historyOptionToFoodInput, normalizeFoodName, repeatFoodInput, savedMealTotal } from "../lib/food-history.ts"
import type { FavouriteFood, FitnessData, FoodEntry, FoodEntryInput, MealType, SavedMeal } from "../types/fitness.ts"
import { Input } from "../components/shared/FormField.tsx"

interface FoodPageProps {
  data: FitnessData
  onAdd: () => void
  onQuickAdd: (input: FoodEntryInput) => void
  onEdit: (entry: FoodEntry) => void
  onDelete: (entry: FoodEntry) => void
  onToggleFavourite: (entry: FoodEntry, favourite?: FavouriteFood) => Promise<void>
  onSaveAsMeal: (entries: FoodEntry[], mealType: MealType) => void
  onCopyMeal: (entries: FoodEntry[]) => Promise<void>
  onLogSavedMeal: (meal: SavedMeal) => Promise<void>
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
}

function moveDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return toLocalDateKey(date)
}

export function FoodPage({ data, onAdd, onQuickAdd, onEdit, onDelete, onToggleFavourite, onSaveAsMeal, onCopyMeal, onLogSavedMeal }: FoodPageProps) {
  const today = toLocalDateKey()
  const yesterday = moveDate(today, -1)
  const [selectedDate, setSelectedDate] = useState(today)
  const [busyMeal, setBusyMeal] = useState("")
  const [busyFavourite, setBusyFavourite] = useState("")
  const [error, setError] = useState("")
  const entries = data.foodEntries.filter((entry) => toLocalDateKey(entry.eaten_at) === selectedDate)
  const consumed = caloriesConsumed(entries)
  const target = data.calorieTarget?.calories ?? 0
  const remaining = caloriesRemaining(target, consumed)
  const recent = useMemo(() => getRecentFoods(data.foodEntries, 3), [data.foodEntries])
  const grouped = (["breakfast", "lunch", "dinner", "snack"] as MealType[])
    .map((meal) => ({ meal, entries: entries.filter((entry) => entry.meal_type === meal) }))
    .filter((group) => group.entries.length)
  const dateLabel = selectedDate === today ? "Today" : selectedDate === yesterday ? "Yesterday" : formatShortDate(selectedDate)

  async function copyMeal(mealEntries: FoodEntry[], mealType: MealType) {
    if (busyMeal) return
    if (!window.confirm(`Copy ${mealLabels[mealType].toLowerCase()} to today? This will add ${mealEntries.length} new ${mealEntries.length === 1 ? "entry" : "entries"}.`)) return
    const key = `copy-${mealType}`
    setBusyMeal(key)
    setError("")
    try {
      await onCopyMeal(mealEntries)
      setSelectedDate(today)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Could not copy this meal.")
    } finally {
      setBusyMeal("")
    }
  }

  async function toggleFavourite(entry: FoodEntry) {
    if (busyFavourite) return
    const favourite = data.favouriteFoods.find((item) => item.normalized_name === normalizeFoodName(entry.name))
    setBusyFavourite(entry.id)
    setError("")
    try { await onToggleFavourite(entry, favourite) }
    catch (favouriteError) { setError(favouriteError instanceof Error ? favouriteError.message : "Could not update favourites.") }
    finally { setBusyFavourite("") }
  }

  async function quickLogMeal(meal: SavedMeal) {
    if (busyMeal) return
    if (!window.confirm(`Log all ${meal.items.length} items from “${meal.name}” now?`)) return
    setBusyMeal(meal.id)
    setError("")
    try { await onLogSavedMeal(meal); setSelectedDate(today) }
    catch (mealError) { setError(mealError instanceof Error ? mealError.message : "Could not log this saved meal.") }
    finally { setBusyMeal("") }
  }

  return (
    <div className="grid gap-6">
      <header className="flex items-end justify-between gap-4">
        <div><p className="text-sm text-slate-500">Daily diary</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Food</h1></div>
        <Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" onClick={onAdd}><Plus /> Add food</Button>
      </header>

      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <Button variant="outline" size="icon" className="size-11" onClick={() => setSelectedDate(moveDate(selectedDate, -1))} aria-label="Previous day"><ChevronLeft /></Button>
        <label className="relative"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-300">{dateLabel}</span><Input className="h-11 cursor-pointer text-right text-transparent [color-scheme:dark]" type="date" max={today} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Choose diary date" /></label>
        <Button variant="outline" size="icon" className="size-11" disabled={selectedDate >= today} onClick={() => setSelectedDate(moveDate(selectedDate, 1))} aria-label="Next day"><ChevronRight /></Button>
      </div>

      <section className="grid grid-cols-3 gap-2 rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:gap-5 sm:p-6">
        <div><p className="text-xs text-slate-500 sm:text-sm">Eaten</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-3xl">{consumed.toLocaleString()}</p></div>
        <div className="border-x border-slate-800 px-3 sm:px-5"><p className="text-xs text-slate-500 sm:text-sm">Target</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-3xl">{target.toLocaleString()}</p></div>
        <div><p className="text-xs text-slate-500 sm:text-sm">Remaining</p><p className={`mt-1 text-xl font-semibold tabular-nums sm:text-3xl ${remaining < 0 ? "text-amber-300" : "text-blue-400"}`}>{remaining.toLocaleString()}</p></div>
      </section>

      {error && <p className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      {grouped.length ? (
        <div className="grid gap-5">
          {grouped.map(({ meal, entries: mealEntries }) => (
            <section key={meal}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <div><h2 className="text-sm font-medium text-slate-300">{mealLabels[meal]}</h2><span className="text-xs text-slate-600">{caloriesConsumed(mealEntries)} kcal</span></div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onSaveAsMeal(mealEntries, meal)}><Save /> Save as meal</Button>
                  {selectedDate !== today && <Button variant="ghost" size="sm" disabled={busyMeal === `copy-${meal}`} onClick={() => copyMeal(mealEntries, meal)}>{busyMeal === `copy-${meal}` ? <LoaderCircle className="animate-spin" /> : <Copy />} Copy to today</Button>}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                {mealEntries.map((entry, index) => {
                  const favourite = data.favouriteFoods.some((item) => item.normalized_name === normalizeFoodName(entry.name))
                  return <article key={entry.id} className={`p-4 ${index ? "border-t border-slate-800" : ""}`}><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-100">{entry.name}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.eaten_at)}{entry.protein_g !== null ? ` · ${entry.protein_g}g protein` : ""}</p></div><p className="shrink-0 text-sm font-medium tabular-nums">{entry.calories} kcal</p></div><div className="mt-2 flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => onQuickAdd(repeatFoodInput(entry))}><RotateCcw /> Log again</Button><Button variant="ghost" size="icon" disabled={busyFavourite === entry.id} className={favourite ? "text-amber-300" : "text-slate-600"} onClick={() => toggleFavourite(entry)} aria-label={favourite ? `Remove ${entry.name} from favourites` : `Favourite ${entry.name}`}>{busyFavourite === entry.id ? <LoaderCircle className="animate-spin" /> : <Star className={favourite ? "fill-current" : ""} />}</Button><Button variant="ghost" size="icon" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.name}`}><Pencil /></Button><Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-300" onClick={() => onDelete(entry)} aria-label={`Delete ${entry.name}`}><Trash2 /></Button></div></article>
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="grid place-items-center rounded-3xl border border-dashed border-slate-800 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-slate-900 text-slate-500"><Utensils /></span><h2 className="mt-4 font-semibold">Nothing logged {selectedDate === today ? "today" : "on this day"}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Choose a recent food or add a manual entry.</p>{selectedDate === today && <Button className="mt-5 bg-blue-500 hover:bg-blue-400" onClick={onAdd}><Plus /> Add food</Button>}
        </section>
      )}

      {selectedDate === today && (recent.length > 0 || data.favouriteFoods.length > 0 || data.savedMeals.length > 0) && (
        <section className="grid gap-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-slate-300">Quick add</p><p className="mt-1 text-xs text-slate-600">Your familiar foods, ready to reuse</p></div><Button variant="ghost" size="sm" onClick={onAdd}>View all</Button></div>
          {recent.length > 0 && <QuickRow title="Recent" items={recent.map((item) => ({ key: item.key, name: item.name, detail: `${item.calories} kcal`, action: () => onQuickAdd(historyOptionToFoodInput(item)) }))} />}
          {data.favouriteFoods.length > 0 && <QuickRow title="Favourites" items={data.favouriteFoods.slice(0, 3).map((item) => ({ key: item.id, name: item.name, detail: `${item.calories} kcal`, action: () => onQuickAdd({ name: item.name, calories: item.calories, proteinG: item.protein_g, mealType: item.default_meal_type ?? "snack", eatenAt: toLocalDateTimeInput() }) }))} />}
          {data.savedMeals.length > 0 && <QuickRow title="Saved meals" items={data.savedMeals.slice(0, 3).map((meal) => ({ key: meal.id, name: meal.name, detail: `${meal.items.length} items · ${savedMealTotal(meal.items)} kcal`, action: () => quickLogMeal(meal), busy: busyMeal === meal.id }))} />}
        </section>
      )}
    </div>
  )
}

function QuickRow({ title, items }: { title: string; items: { key: string; name: string; detail: string; action: () => void; busy?: boolean }[] }) {
  return <div><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">{title}</h3><div className="grid gap-2 sm:grid-cols-3">{items.map((item) => <button key={item.key} type="button" disabled={item.busy} onClick={item.action} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left transition hover:border-blue-400/30 hover:bg-slate-800 disabled:opacity-50"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{item.name}</span><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></span>{item.busy ? <LoaderCircle className="size-4 shrink-0 animate-spin text-blue-400" /> : <Plus className="size-4 shrink-0 text-blue-400" />}</button>)}</div></div>
}
