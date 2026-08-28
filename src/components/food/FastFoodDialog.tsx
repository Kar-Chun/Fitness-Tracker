import { useMemo, useState, type FormEvent } from "react"
import { Check, LoaderCircle, Pencil, Plus, Search, Sparkles, Star, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFrequentFoods, getRecentFoods, historyOptionToFoodInput, savedMealTotal, searchFoodHistory } from "../../lib/food-history.ts"
import { toLocalDateTimeInput } from "../../lib/date.ts"
import type { FavouriteFood, FavouriteFoodInput, FoodEntry, FoodEntryInput, FoodEstimate, FoodEstimateLogInput, FoodHistoryOption, MealType, SavedMeal, SavedMealInput, SavedMealItemInput } from "../../types/fitness.ts"
import { FieldShell, Input, Select } from "../shared/FormField.tsx"
import { InlineError } from "../shared/Feedback.tsx"
import { FoodEntryForm } from "./FoodEntryForm.tsx"
import { DescribeFoodFlow } from "./DescribeFoodFlow.tsx"

type FastFoodTab = "recent" | "frequent" | "favourites" | "meals" | "search" | "manual"

interface FastFoodDialogProps {
  foodEntries: FoodEntry[]
  favourites: FavouriteFood[]
  savedMeals: SavedMeal[]
  defaultMealType: MealType
  initialSeed?: FoodEntryInput
  initialMealInput?: SavedMealInput
  initialTab?: FastFoodTab
  onAdd: (input: FoodEntryInput) => Promise<void>
  onSaveFavourite: (input: FavouriteFoodInput, id?: string) => Promise<void>
  onDeleteFavourite: (id: string) => Promise<void>
  onSaveMeal: (input: SavedMealInput, id?: string) => Promise<void>
  onDeleteMeal: (id: string) => Promise<void>
  onLogMeal: (meal: SavedMeal, mealType: MealType) => Promise<void>
  onAnalyzeFood: (description: string) => Promise<FoodEstimate>
  onLogEstimate: (input: FoodEstimateLogInput) => Promise<void>
  onClose: () => void
}

const tabs: { id: FastFoodTab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "frequent", label: "Frequent" },
  { id: "favourites", label: "Favourites" },
  { id: "meals", label: "Saved Meals" },
  { id: "search", label: "Search" },
  { id: "manual", label: "Manual" },
]

export function FastFoodDialog(props: FastFoodDialogProps) {
  const [tab, setTab] = useState<FastFoodTab>(props.initialTab ?? "recent")
  const [draft, setDraft] = useState<FoodEntryInput | null>(props.initialSeed ?? null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingFavourite, setEditingFavourite] = useState<FavouriteFood | null>(null)
  const [editingMeal, setEditingMeal] = useState<SavedMeal | "new" | "seed" | null>(props.initialMealInput ? "seed" : null)
  const [loggingMeal, setLoggingMeal] = useState<SavedMeal | null>(null)
  const [describing, setDescribing] = useState(false)

  function chooseOption(option: FoodHistoryOption | FavouriteFood) {
    const input = "lastUsedAt" in option
      ? historyOptionToFoodInput(option)
      : {
          name: option.name,
          calories: option.calories,
          proteinG: option.protein_g,
          mealType: option.default_meal_type ?? props.defaultMealType,
          eatenAt: toLocalDateTimeInput(),
          source: "favourite" as const,
        }
    setDraft(input)
    setEditingDetails(false)
  }

  if (draft) {
    if (editingDetails) {
      return <FoodEntryForm initial={draft} onSubmit={props.onAdd} onCancel={() => setEditingDetails(false)} />
    }
    return <QuickConfirm draft={draft} onChange={setDraft} onAdd={props.onAdd} onEdit={() => setEditingDetails(true)} onBack={() => setDraft(null)} />
  }

  if (editingFavourite) {
    return <FavouriteEditor favourite={editingFavourite} onSave={async (input) => { await props.onSaveFavourite(input, editingFavourite.id); setEditingFavourite(null) }} onCancel={() => setEditingFavourite(null)} />
  }

  if (editingMeal) {
    const existingMeal = typeof editingMeal === "object" ? editingMeal : undefined
    return <SavedMealEditor meal={existingMeal} initial={editingMeal === "seed" ? props.initialMealInput : undefined} onSave={async (input) => { await props.onSaveMeal(input, existingMeal?.id); setEditingMeal(null) }} onCancel={() => setEditingMeal(null)} />
  }

  if (loggingMeal) {
    return <LogMealConfirm meal={loggingMeal} onLog={props.onLogMeal} onBack={() => setLoggingMeal(null)} />
  }

  if (describing) {
    return <DescribeFoodFlow defaultMealType={props.defaultMealType} onAnalyze={props.onAnalyzeFood} onLog={props.onLogEstimate} onBack={() => setDescribing(false)} />
  }

  return (
    <div>
      <button type="button" className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4 text-left transition hover:border-blue-400/50 hover:bg-blue-500/15" onClick={() => setDescribing(true)}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500 text-white"><Sparkles className="size-5" /></span>
        <span className="min-w-0"><span className="block font-semibold text-blue-100">Describe Meal</span><span className="mt-0.5 block text-sm text-slate-400">Get an estimate, then review before logging.</span></span>
      </button>
      <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Add food options">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`h-10 shrink-0 rounded-xl px-3 text-sm font-medium transition ${tab === item.id ? "bg-blue-500 text-white" : "bg-slate-950 text-slate-400 hover:text-white"}`}>{item.label}</button>
        ))}
      </div>
      {tab === "recent" && <HistoryList title="Recently logged" empty="No recent foods yet." options={getRecentFoods(props.foodEntries)} favourites={props.favourites} onChoose={chooseOption} onFavourite={props.onSaveFavourite} />}
      {tab === "frequent" && <HistoryList title="Frequently used" empty="Log foods a few times to build this list." options={getFrequentFoods(props.foodEntries)} favourites={props.favourites} showCount onChoose={chooseOption} onFavourite={props.onSaveFavourite} />}
      {tab === "favourites" && <FavouriteList favourites={props.favourites} onChoose={chooseOption} onEdit={setEditingFavourite} onDelete={props.onDeleteFavourite} />}
      {tab === "meals" && <SavedMealList meals={props.savedMeals} onLog={setLoggingMeal} onEdit={setEditingMeal} onDelete={props.onDeleteMeal} onNew={() => setEditingMeal("new")} />}
      {tab === "search" && <HistorySearch entries={props.foodEntries} favourites={props.favourites} onChoose={chooseOption} onFavourite={props.onSaveFavourite} />}
      {tab === "manual" && <FoodEntryForm defaultMealType={props.defaultMealType} onSubmit={props.onAdd} onCancel={props.onClose} />}
    </div>
  )
}

function QuickConfirm({ draft, onChange, onAdd, onEdit, onBack }: { draft: FoodEntryInput; onChange: (value: FoodEntryInput) => void; onAdd: (value: FoodEntryInput) => Promise<void>; onEdit: () => void; onBack: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function add() {
    if (saving) return
    setSaving(true)
    setError("")
    try { await onAdd(draft) } catch (addError) { setError(addError instanceof Error ? addError.message : "Could not add this food."); setSaving(false) }
  }
  return (
    <div className="grid gap-4">
      <button type="button" className="text-left text-sm text-slate-500 hover:text-slate-300" onClick={onBack}>← Back to quick add</button>
      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4"><p className="text-lg font-semibold">{draft.name}</p><p className="mt-1 text-sm text-slate-400">{draft.calories} kcal{draft.proteinG !== null ? ` · ${draft.proteinG}g protein` : ""}</p></div>
      <FieldShell label="Meal" htmlFor="quick-meal"><Select id="quick-meal" value={draft.mealType} onChange={(event) => onChange({ ...draft, mealType: event.target.value as MealType })}><MealOptions /></Select></FieldShell>
      <FieldShell label="Date and time" htmlFor="quick-time"><Input id="quick-time" type="datetime-local" value={draft.eatenAt} onChange={(event) => onChange({ ...draft, eatenAt: event.target.value })} /></FieldShell>
      <InlineError message={error} />
      <div className="grid grid-cols-2 gap-3"><Button variant="outline" size="lg" className="h-11" onClick={onEdit}><Pencil /> Edit details</Button><Button size="lg" className="h-11 bg-blue-500 hover:bg-blue-400" disabled={saving} onClick={add}>{saving ? <LoaderCircle className="animate-spin" /> : <Plus />} Add</Button></div>
    </div>
  )
}

function HistoryList({ title, empty, options, favourites, showCount, onChoose, onFavourite }: { title: string; empty: string; options: FoodHistoryOption[]; favourites: FavouriteFood[]; showCount?: boolean; onChoose: (option: FoodHistoryOption) => void; onFavourite: (input: FavouriteFoodInput) => Promise<void> }) {
  const [saving, setSaving] = useState("")
  const [error, setError] = useState("")
  if (!options.length) return <EmptyText>{empty}</EmptyText>
  async function favourite(option: FoodHistoryOption) { setSaving(option.key); setError(""); try { await onFavourite({ name: option.name, calories: option.calories, proteinG: option.proteinG, defaultMealType: option.mealType }) } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save favourite.") } finally { setSaving("") } }
  return <div><h3 className="mb-2 text-sm font-medium text-slate-400">{title}</h3><div className="overflow-hidden rounded-2xl border border-slate-800">{options.map((option, index) => { const isFavourite = favourites.some((item) => item.normalized_name === option.key); return <div key={option.key} className={`flex items-center gap-2 bg-slate-950/50 p-3 ${index ? "border-t border-slate-800" : ""}`}><button type="button" className="min-w-0 flex-1 text-left" onClick={() => onChoose(option)}><p className="truncate font-medium">{option.name}</p><p className="mt-1 text-xs text-slate-500">{option.calories} kcal{showCount ? ` · Logged ${option.count} ${option.count === 1 ? "time" : "times"}` : ""}</p></button><Button variant="ghost" size="icon" disabled={isFavourite || Boolean(saving)} className={isFavourite ? "text-amber-300" : "text-slate-600"} onClick={() => favourite(option)} aria-label={isFavourite ? `${option.name} is a favourite` : `Favourite ${option.name}`}>{saving === option.key ? <LoaderCircle className="animate-spin" /> : <Star className={isFavourite ? "fill-current" : ""} />}</Button><Button size="sm" onClick={() => onChoose(option)}>Add</Button></div> })}</div>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</div>
}

function FavouriteList({ favourites, onChoose, onEdit, onDelete }: { favourites: FavouriteFood[]; onChoose: (item: FavouriteFood) => void; onEdit: (item: FavouriteFood) => void; onDelete: (id: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState("")
  const [error, setError] = useState("")
  if (!favourites.length) return <EmptyText>No favourites yet. Favourite foods you eat often for faster logging.</EmptyText>
  async function remove(item: FavouriteFood) { if (!window.confirm(`Remove “${item.name}” from favourites?`)) return; setDeleting(item.id); setError(""); try { await onDelete(item.id) } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Could not remove favourite.") } finally { setDeleting("") } }
  return <div><div className="overflow-hidden rounded-2xl border border-slate-800">{favourites.map((item, index) => <div key={item.id} className={`flex items-center gap-2 bg-slate-950/50 p-3 ${index ? "border-t border-slate-800" : ""}`}><button type="button" className="min-w-0 flex-1 text-left" onClick={() => onChoose(item)}><p className="truncate font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.calories} kcal{item.protein_g !== null ? ` · ${item.protein_g}g protein` : ""}</p></button><Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><Pencil /></Button><Button variant="ghost" size="icon" disabled={deleting === item.id} className="text-slate-500 hover:text-red-300" onClick={() => remove(item)} aria-label={`Remove ${item.name} from favourites`}>{deleting === item.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}</Button><Button size="sm" onClick={() => onChoose(item)}>Add</Button></div>)}</div>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</div>
}

function SavedMealList({ meals, onLog, onEdit, onDelete, onNew }: { meals: SavedMeal[]; onLog: (meal: SavedMeal) => void; onEdit: (meal: SavedMeal) => void; onDelete: (id: string) => Promise<void>; onNew: () => void }) {
  const [deleting, setDeleting] = useState("")
  const [error, setError] = useState("")
  async function remove(meal: SavedMeal) { if (!window.confirm(`Delete saved meal “${meal.name}”? Diary entries already logged will not change.`)) return; setDeleting(meal.id); setError(""); try { await onDelete(meal.id) } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Could not delete saved meal.") } finally { setDeleting("") } }
  return <div className="grid gap-3"><Button variant="outline" className="h-11" onClick={onNew}><Plus /> Create saved meal</Button>{!meals.length ? <EmptyText>No saved meals yet.</EmptyText> : meals.map((meal) => <div key={meal.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{meal.name}</p><p className="mt-1 text-xs text-slate-500">{meal.items.length} items · {savedMealTotal(meal.items)} kcal</p></div><div className="flex"><Button variant="ghost" size="icon" onClick={() => onEdit(meal)} aria-label={`Edit ${meal.name}`}><Pencil /></Button><Button variant="ghost" size="icon" disabled={deleting === meal.id} className="text-slate-500 hover:text-red-300" onClick={() => remove(meal)} aria-label={`Delete ${meal.name}`}>{deleting === meal.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}</Button></div></div><ul className="my-3 grid gap-1 text-sm text-slate-400">{meal.items.map((item) => <li key={item.id} className="flex justify-between gap-4"><span className="truncate">{item.name}</span><span className="shrink-0">{item.calories} kcal</span></li>)}</ul><Button className="w-full bg-blue-500 hover:bg-blue-400" onClick={() => onLog(meal)}><Plus /> Log meal</Button></div>)}{error && <p className="text-sm text-red-300">{error}</p>}</div>
}

function HistorySearch({ entries, favourites, onChoose, onFavourite }: { entries: FoodEntry[]; favourites: FavouriteFood[]; onChoose: (option: FoodHistoryOption) => void; onFavourite: (input: FavouriteFoodInput) => Promise<void> }) {
  const [query, setQuery] = useState("")
  const results = useMemo(() => searchFoodHistory(entries, query), [entries, query])
  return <div className="grid gap-4"><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-slate-600" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your food history" autoFocus /></div>{query.trim() ? <HistoryList title="Results" empty="No matching foods in your history." options={results} favourites={favourites} onChoose={onChoose} onFavourite={onFavourite} /> : <EmptyText>Type a food name to search your own history.</EmptyText>}</div>
}

function FavouriteEditor({ favourite, onSave, onCancel }: { favourite: FavouriteFood; onSave: (input: FavouriteFoodInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(favourite.name); const [calories, setCalories] = useState(String(favourite.calories)); const [protein, setProtein] = useState(favourite.protein_g === null ? "" : String(favourite.protein_g)); const [meal, setMeal] = useState<MealType>(favourite.default_meal_type ?? "snack"); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  async function submit(event: FormEvent) { event.preventDefault(); const calorieValue = Number(calories); const proteinValue = protein === "" ? null : Number(protein); if (!name.trim() || !Number.isFinite(calorieValue) || calorieValue < 0 || (proteinValue !== null && (!Number.isFinite(proteinValue) || proteinValue < 0))) return setError("Check the name, calories, and protein values."); setSaving(true); setError(""); try { await onSave({ name: name.trim(), calories: Math.round(calorieValue), proteinG: proteinValue, defaultMealType: meal }) } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save favourite."); setSaving(false) } }
  return <form className="grid gap-4" onSubmit={submit}><button type="button" className="text-left text-sm text-slate-500" onClick={onCancel}>← Back to favourites</button><FieldShell label="Name" htmlFor="fav-name"><Input id="fav-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></FieldShell><div className="grid grid-cols-2 gap-3"><FieldShell label="Calories" htmlFor="fav-cal"><Input id="fav-cal" type="number" min="0" inputMode="numeric" value={calories} onChange={(event) => setCalories(event.target.value)} /></FieldShell><FieldShell label="Protein" hint="optional" htmlFor="fav-protein"><Input id="fav-protein" type="number" min="0" step="0.1" inputMode="decimal" value={protein} onChange={(event) => setProtein(event.target.value)} /></FieldShell></div><FieldShell label="Default meal" htmlFor="fav-meal"><Select id="fav-meal" value={meal} onChange={(event) => setMeal(event.target.value as MealType)}><MealOptions /></Select></FieldShell><InlineError message={error} /><div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" className="h-11" onClick={onCancel}>Cancel</Button><Button type="submit" className="h-11 bg-blue-500 hover:bg-blue-400" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />} Save</Button></div></form>
}

function SavedMealEditor({ meal, initial, onSave, onCancel }: { meal?: SavedMeal; initial?: SavedMealInput; onSave: (input: SavedMealInput) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(meal?.name ?? initial?.name ?? ""); const [mealType, setMealType] = useState<MealType>(meal?.default_meal_type ?? initial?.defaultMealType ?? "breakfast"); const [items, setItems] = useState<SavedMealItemInput[]>(meal?.items.map((item) => ({ name: item.name, calories: item.calories, proteinG: item.protein_g })) ?? initial?.items ?? [{ name: "", calories: 0, proteinG: null }]); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  function updateItem(index: number, patch: Partial<SavedMealItemInput>) { setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)) }
  async function submit(event: FormEvent) { event.preventDefault(); if (!name.trim() || !items.length || items.some((item) => !item.name.trim() || !Number.isFinite(item.calories) || item.calories < 0 || (item.proteinG !== null && (!Number.isFinite(item.proteinG) || item.proteinG < 0)))) return setError("Add a meal name and check every item’s values."); setSaving(true); setError(""); try { await onSave({ name: name.trim(), defaultMealType: mealType, items: items.map((item) => ({ ...item, name: item.name.trim(), calories: Math.round(item.calories) })) }) } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save this meal."); setSaving(false) } }
  return <form className="grid gap-4" onSubmit={submit}><button type="button" className="text-left text-sm text-slate-500" onClick={onCancel}>← Back to saved meals</button><FieldShell label="Meal name" htmlFor="saved-name"><Input id="saved-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Usual Breakfast" autoFocus /></FieldShell><FieldShell label="Default meal" htmlFor="saved-type"><Select id="saved-type" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}><MealOptions /></Select></FieldShell><div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium text-slate-200">Items</p><span className="text-xs text-slate-500">{savedMealTotal(items)} kcal total</span></div><div className="grid gap-3">{items.map((item, index) => <div key={index} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs text-slate-500">Item {index + 1}</span>{items.length > 1 && <button type="button" className="text-slate-600 hover:text-red-300" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove item ${index + 1}`}><X className="size-4" /></button>}</div><Input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="Food name" /><div className="mt-2 grid grid-cols-2 gap-2"><Input type="number" min="0" inputMode="numeric" value={item.calories || ""} onChange={(event) => updateItem(index, { calories: Number(event.target.value) })} placeholder="Calories" aria-label={`Item ${index + 1} calories`} /><Input type="number" min="0" step="0.1" inputMode="decimal" value={item.proteinG ?? ""} onChange={(event) => updateItem(index, { proteinG: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Protein (optional)" aria-label={`Item ${index + 1} protein`} /></div></div>)}</div><Button type="button" variant="ghost" className="mt-2" onClick={() => setItems((current) => [...current, { name: "", calories: 0, proteinG: null }])}><Plus /> Add item</Button></div><InlineError message={error} /><div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" className="h-11" onClick={onCancel}>Cancel</Button><Button type="submit" className="h-11 bg-blue-500 hover:bg-blue-400" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />} Save meal</Button></div></form>
}

function LogMealConfirm({ meal, onLog, onBack }: { meal: SavedMeal; onLog: (meal: SavedMeal, mealType: MealType) => Promise<void>; onBack: () => void }) {
  const [mealType, setMealType] = useState<MealType>(meal.default_meal_type ?? "snack"); const [logging, setLogging] = useState(false); const [error, setError] = useState("")
  async function log() { if (logging) return; setLogging(true); setError(""); try { await onLog(meal, mealType) } catch (logError) { setError(logError instanceof Error ? logError.message : "Could not log this meal."); setLogging(false) } }
  return <div className="grid gap-4"><button type="button" className="text-left text-sm text-slate-500" onClick={onBack}>← Back to saved meals</button><div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4"><p className="text-lg font-semibold">{meal.name}</p><p className="mt-1 text-sm text-slate-400">{meal.items.length} items · {savedMealTotal(meal.items)} kcal</p><ul className="mt-3 grid gap-1 text-sm text-slate-400">{meal.items.map((item) => <li key={item.id}>{item.name} — {item.calories} kcal</li>)}</ul></div><FieldShell label="Log as" htmlFor="log-meal-type"><Select id="log-meal-type" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}><MealOptions /></Select></FieldShell><p className="text-xs leading-5 text-slate-500">This creates new diary entries. Later edits to the saved meal will not change today’s log.</p><InlineError message={error} /><Button className="h-11 bg-blue-500 hover:bg-blue-400" disabled={logging} onClick={log}>{logging ? <LoaderCircle className="animate-spin" /> : <Plus />} Log {meal.items.length} items</Button></div>
}

function MealOptions() { return <><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></> }
function EmptyText({ children }: { children: string }) { return <p className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center text-sm leading-6 text-slate-500">{children}</p> }
