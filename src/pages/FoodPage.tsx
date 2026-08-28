import { Pencil, Plus, Trash2, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { caloriesConsumed, caloriesRemaining, entriesForToday } from "../lib/calculations.ts"
import { formatDateTime } from "../lib/date.ts"
import type { FitnessData, FoodEntry, MealType } from "../types/fitness.ts"

interface FoodPageProps {
  data: FitnessData
  onAdd: () => void
  onEdit: (entry: FoodEntry) => void
  onDelete: (entry: FoodEntry) => void
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
}

export function FoodPage({ data, onAdd, onEdit, onDelete }: FoodPageProps) {
  const entries = entriesForToday(data.foodEntries)
  const consumed = caloriesConsumed(entries)
  const target = data.calorieTarget?.calories ?? 0
  const remaining = caloriesRemaining(target, consumed)
  const grouped = (["breakfast", "lunch", "dinner", "snack"] as MealType[])
    .map((meal) => ({ meal, entries: entries.filter((entry) => entry.meal_type === meal) }))
    .filter((group) => group.entries.length)

  return (
    <div className="grid gap-6">
      <header className="flex items-end justify-between gap-4">
        <div><p className="text-sm text-slate-500">Daily diary</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Food</h1></div>
        <Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" onClick={onAdd}><Plus /> Add food</Button>
      </header>

      <section className="grid grid-cols-3 gap-2 rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:gap-5 sm:p-6">
        <div><p className="text-xs text-slate-500 sm:text-sm">Eaten</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-3xl">{consumed.toLocaleString()}</p></div>
        <div className="border-x border-slate-800 px-3 sm:px-5"><p className="text-xs text-slate-500 sm:text-sm">Target</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-3xl">{target.toLocaleString()}</p></div>
        <div><p className="text-xs text-slate-500 sm:text-sm">Remaining</p><p className={`mt-1 text-xl font-semibold tabular-nums sm:text-3xl ${remaining < 0 ? "text-amber-300" : "text-blue-400"}`}>{remaining.toLocaleString()}</p></div>
      </section>

      {grouped.length ? (
        <div className="grid gap-5">
          {grouped.map(({ meal, entries: mealEntries }) => (
            <section key={meal}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-slate-400">{mealLabels[meal]}</h2>
                <span className="text-xs text-slate-600">{caloriesConsumed(mealEntries)} kcal</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                {mealEntries.map((entry, index) => (
                  <article key={entry.id} className={`flex items-center gap-3 p-4 ${index ? "border-t border-slate-800" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-100">{entry.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.eaten_at)}{entry.protein_g !== null ? ` · ${entry.protein_g}g protein` : ""}</p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">{entry.calories} kcal</p>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.name}`}><Pencil /></Button>
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-300" onClick={() => onDelete(entry)} aria-label={`Delete ${entry.name}`}><Trash2 /></Button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="grid place-items-center rounded-3xl border border-dashed border-slate-800 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-slate-900 text-slate-500"><Utensils /></span>
          <h2 className="mt-4 font-semibold">Nothing logged today</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Add meals as you go. The calorie values are your own manual estimates.</p>
          <Button className="mt-5 bg-blue-500 hover:bg-blue-400" onClick={onAdd}><Plus /> Add your first food</Button>
        </section>
      )}
    </div>
  )
}
