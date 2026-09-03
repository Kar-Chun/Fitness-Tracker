import { useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Copy, LoaderCircle, MoreHorizontal, Pencil, Plus, RotateCcw, Save, Star, Trash2, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { caloriesConsumed, caloriesRemaining } from "../lib/calculations.ts"
import { addLocalDateKeyDays, formatDateTime, parseLocalDateKey, toLocalDateKey, toLocalDateTimeInput } from "../lib/date.ts"
import { getRecentFoods, historyOptionToFoodInput, normalizeFoodName, repeatFoodInput, savedMealTotal } from "../lib/food-history.ts"
import type { FavouriteFood, FitnessData, FoodEntry, FoodEntryInput, MealType, SavedMeal } from "../types/fitness.ts"
import { EmptyState, PageHeader, ProgressBar, SectionHeader, Surface } from "../components/shared/Visual.tsx"

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
  onSetDayComplete: (date: string, isComplete: boolean) => Promise<void>
}

const mealLabels: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" }

function diaryDateLabel(dateKey: string, today: string) {
  const date = parseLocalDateKey(dateKey)
  if (dateKey === today) return `Today · ${new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date)}`
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date)
}

export function FoodPage({ data, onAdd, onQuickAdd, onEdit, onDelete, onToggleFavourite, onSaveAsMeal, onCopyMeal, onLogSavedMeal, onSetDayComplete }: FoodPageProps) {
  const today = toLocalDateKey()
  const [selectedDate, setSelectedDate] = useState(today)
  const [busyMeal, setBusyMeal] = useState("")
  const [busyFavourite, setBusyFavourite] = useState("")
  const [error, setError] = useState("")
  const [completionBusy, setCompletionBusy] = useState(false)
  const entries = data.foodEntries.filter((entry) => toLocalDateKey(entry.eaten_at) === selectedDate)
  const consumed = caloriesConsumed(entries)
  const target = data.calorieTarget?.calories ?? 0
  const remaining = caloriesRemaining(target, consumed)
  const percentage = target > 0 ? Math.min(100, Math.max(0, (consumed / target) * 100)) : 0
  const recent = useMemo(() => getRecentFoods(data.foodEntries, 3), [data.foodEntries])
  const grouped = (["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((meal) => ({ meal, entries: entries.filter((entry) => entry.meal_type === meal) })).filter((group) => group.entries.length)
  const isComplete = data.dailyFoodLogStatuses.some((status) => status.date === selectedDate && status.is_complete)

  async function toggleComplete() {
    if (completionBusy) return
    setCompletionBusy(true)
    setError("")
    try { await onSetDayComplete(selectedDate, !isComplete) }
    catch (completionError) { setError(completionError instanceof Error ? completionError.message : "Could not update this food log.") }
    finally { setCompletionBusy(false) }
  }

  async function copyMeal(mealEntries: FoodEntry[], mealType: MealType) {
    if (busyMeal || !window.confirm(`Copy ${mealLabels[mealType].toLowerCase()} to today? This will add ${mealEntries.length} new ${mealEntries.length === 1 ? "entry" : "entries"}.`)) return
    const key = `copy-${mealType}`
    setBusyMeal(key)
    setError("")
    try { await onCopyMeal(mealEntries); setSelectedDate(today) }
    catch (copyError) { setError(copyError instanceof Error ? copyError.message : "Could not copy this meal.") }
    finally { setBusyMeal("") }
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
    if (busyMeal || !window.confirm(`Log all ${meal.items.length} items from “${meal.name}” now?`)) return
    setBusyMeal(meal.id)
    setError("")
    try { await onLogSavedMeal(meal); setSelectedDate(today) }
    catch (mealError) { setError(mealError instanceof Error ? mealError.message : "Could not log this saved meal.") }
    finally { setBusyMeal("") }
  }

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow="Daily diary" title="Food" description="Log quickly, then get on with your day." action={<Button size="lg" className="h-11 px-5" onClick={onAdd}><Plus /> Add food</Button>} />

      <div className="grid max-w-md grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <Button variant="outline" size="icon" className="size-11" onClick={() => setSelectedDate(addLocalDateKeyDays(selectedDate, -1))} aria-label="Previous day"><ChevronLeft /></Button>
        <div className="flex h-11 min-w-0 items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/70 pl-4 pr-1">
          <span className="truncate text-sm font-medium text-slate-200">{diaryDateLabel(selectedDate, today)}</span>
          <label className="relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-blue-300 focus-within:ring-2 focus-within:ring-blue-500/40" title="Choose date">
            <CalendarDays className="size-4" />
            <input className="absolute inset-0 cursor-pointer opacity-0" type="date" max={today} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Choose diary date" />
          </label>
        </div>
        <Button variant="outline" size="icon" className="size-11" disabled={selectedDate >= today} onClick={() => setSelectedDate(addLocalDateKeyDays(selectedDate, 1))} aria-label="Next day"><ChevronRight /></Button>
      </div>

      <Surface className="p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-3">
          <DiaryMetric label="Eaten" value={consumed} />
          <DiaryMetric label="Target" value={target} bordered />
          <DiaryMetric label={remaining >= 0 ? "Remaining" : "Over"} value={Math.abs(remaining)} accent={remaining < 0 ? "amber" : "blue"} />
        </div>
        <ProgressBar className="mt-5" value={percentage} label="Daily calorie progress" over={remaining < 0} />
      </Surface>

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${isComplete ? "border-blue-400/15 bg-blue-500/5" : "border-slate-800/80 bg-slate-900/40"}`}>
        <div className="flex min-w-0 items-center gap-2.5"><CheckCircle2 className={`size-4.5 shrink-0 ${isComplete ? "text-blue-400" : "text-slate-600"}`} /><div><p className="text-sm font-medium text-slate-300">{isComplete ? "Food log complete" : "Food log incomplete"}</p><p className="text-xs text-slate-600">Complete days improve calorie reviews.</p></div></div>
        <Button variant="ghost" size="sm" disabled={completionBusy} onClick={toggleComplete}>{completionBusy && <LoaderCircle className="animate-spin" />}{isComplete ? "Undo" : "Mark complete"}</Button>
      </div>

      {error && <p className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      {grouped.length ? <div className="grid gap-4">{grouped.map(({ meal, entries: mealEntries }) => (
        <Surface key={meal} className="overflow-visible">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-3">
            <div className="flex items-baseline gap-2"><h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">{mealLabels[meal]}</h2><span className="text-xs tabular-nums text-slate-600">{caloriesConsumed(mealEntries)} kcal</span></div>
            <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => onSaveAsMeal(mealEntries, meal)}><Save /> Save as meal</Button>{selectedDate !== today && <Button variant="ghost" size="sm" disabled={busyMeal === `copy-${meal}`} onClick={() => copyMeal(mealEntries, meal)}>{busyMeal === `copy-${meal}` ? <LoaderCircle className="animate-spin" /> : <Copy />} Copy to today</Button>}</div>
          </div>
          <div>{mealEntries.map((entry, index) => <FoodRow key={entry.id} entry={entry} index={index} favourite={data.favouriteFoods.some((item) => item.normalized_name === normalizeFoodName(entry.name))} busy={busyFavourite === entry.id} onQuickAdd={onQuickAdd} onFavourite={toggleFavourite} onEdit={onEdit} onDelete={onDelete} />)}</div>
        </Surface>
      ))}</div> : <EmptyState icon={Utensils} title={`Nothing logged ${selectedDate === today ? "today" : "on this day"}`} description="Choose a recent food or add a manual entry." action={selectedDate === today ? <Button onClick={onAdd}><Plus /> Add food</Button> : undefined} />}

      {selectedDate === today && (recent.length > 0 || data.favouriteFoods.length > 0 || data.savedMeals.length > 0) && (
        <section className="grid gap-4">
          <SectionHeader eyebrow="Faster logging" title="Quick add" action={<Button variant="ghost" size="sm" onClick={onAdd}>View all</Button>} />
          {recent.length > 0 && <QuickRow title="Recent" items={recent.map((item) => ({ key: item.key, name: item.name, detail: `${item.calories} kcal`, action: () => onQuickAdd(historyOptionToFoodInput(item)) }))} />}
          {data.favouriteFoods.length > 0 && <QuickRow title="Favourites" items={data.favouriteFoods.slice(0, 3).map((item) => ({ key: item.id, name: item.name, detail: `${item.calories} kcal`, action: () => onQuickAdd({ name: item.name, calories: item.calories, proteinG: item.protein_g, mealType: item.default_meal_type ?? "snack", eatenAt: toLocalDateTimeInput() }) }))} />}
          {data.savedMeals.length > 0 && <QuickRow title="Saved meals" items={data.savedMeals.slice(0, 3).map((meal) => ({ key: meal.id, name: meal.name, detail: `${meal.items.length} items · ${savedMealTotal(meal.items)} kcal`, action: () => quickLogMeal(meal), busy: busyMeal === meal.id }))} />}
        </section>
      )}
    </div>
  )
}

function DiaryMetric({ label, value, bordered = false, accent }: { label: string; value: number; bordered?: boolean; accent?: "blue" | "amber" }) {
  return <div className={bordered ? "border-x border-slate-800 px-3 sm:px-5" : ""}><p className="text-[0.68rem] font-semibold uppercase tracking-wider text-slate-600">{label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${accent === "blue" ? "text-blue-300" : accent === "amber" ? "text-amber-300" : "text-slate-100"}`}>{value.toLocaleString()}</p><p className="text-xs text-slate-600">kcal</p></div>
}

function FoodRow({ entry, index, favourite, busy, onQuickAdd, onFavourite, onEdit, onDelete }: { entry: FoodEntry; index: number; favourite: boolean; busy: boolean; onQuickAdd: (input: FoodEntryInput) => void; onFavourite: (entry: FoodEntry) => Promise<void>; onEdit: (entry: FoodEntry) => void; onDelete: (entry: FoodEntry) => void }) {
  return (
    <article className={`flex items-center gap-3 px-4 py-3 ${index ? "border-t border-slate-800/70" : ""}`}>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{entry.name}</p><p className="mt-1 truncate text-xs text-slate-600">{formatDateTime(entry.eaten_at)}{entry.protein_g !== null ? ` · ${entry.protein_g}g protein` : ""}</p></div>
      <p className="shrink-0 text-sm font-medium tabular-nums text-slate-300">{entry.calories} kcal</p>
      <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => onQuickAdd(repeatFoodInput(entry))}><RotateCcw /> Log again</Button>
      <details className="group relative">
        <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 [&::-webkit-details-marker]:hidden" aria-label={`More actions for ${entry.name}`}><MoreHorizontal className="size-4" /></summary>
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
          <FoodAction mobile icon={RotateCcw} label="Log again" onClick={() => onQuickAdd(repeatFoodInput(entry))} />
          <FoodAction icon={Star} label={favourite ? "Unfavourite" : "Favourite"} disabled={busy} iconClass={favourite ? "fill-current text-amber-300" : ""} onClick={() => onFavourite(entry)} />
          <FoodAction icon={Pencil} label="Edit" onClick={() => onEdit(entry)} />
          <FoodAction icon={Trash2} label="Delete" destructive onClick={() => onDelete(entry)} />
        </div>
      </details>
    </article>
  )
}

function FoodAction({ icon: Icon, label, onClick, disabled, destructive = false, mobile = false, iconClass = "" }: { icon: typeof Star; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean; mobile?: boolean; iconClass?: string }) {
  return <button type="button" disabled={disabled} className={`${mobile ? "sm:hidden" : ""} flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm disabled:opacity-50 ${destructive ? "text-red-300 hover:bg-red-400/10" : "text-slate-300 hover:bg-slate-800"}`} onClick={onClick}><Icon className={`size-4 ${iconClass}`} /> {label}</button>
}

function QuickRow({ title, items }: { title: string; items: { key: string; name: string; detail: string; action: () => void; busy?: boolean }[] }) {
  return <div><h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3><div className="grid gap-2 sm:grid-cols-3">{items.map((item) => <button key={item.key} type="button" disabled={item.busy} onClick={item.action} className="steady-interactive flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left disabled:opacity-50"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{item.name}</span><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></span>{item.busy ? <LoaderCircle className="size-4 shrink-0 animate-spin text-blue-400" /> : <Plus className="size-4 shrink-0 text-blue-400" />}</button>)}</div></div>
}
