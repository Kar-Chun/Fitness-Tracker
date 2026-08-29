import { useMemo, useState } from "react"
import { Check, LoaderCircle, Plus, Search, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldShell, Input, Select } from "../shared/FormField.tsx"
import { createAndAddExercise, rankExercises, normalizeExerciseSearch } from "../../lib/exercise-search.ts"
import { loadTypeLabel } from "../../lib/workout-drafts.ts"
import type { CustomExerciseInput, ExerciseCategory, ExerciseLibraryItem, ExerciseLoadType, WorkoutSessionWithDetails } from "../../types/fitness.ts"

interface ExerciseSearchProps {
  library: ExerciseLibraryItem[]
  sessions: WorkoutSessionWithDetails[]
  excludedIds?: string[]
  onAdd: (exercise: ExerciseLibraryItem) => Promise<void> | void
  onCreateCustom: (input: CustomExerciseInput) => Promise<ExerciseLibraryItem>
  autoFocus?: boolean
}

export function ExerciseSearch({ library, sessions, excludedIds = [], onAdd, onCreateCustom, autoFocus = false }: ExerciseSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(autoFocus)
  const [creating, setCreating] = useState(false)
  const [category, setCategory] = useState<ExerciseCategory>("other")
  const [loadType, setLoadType] = useState<ExerciseLoadType>("per_dumbbell")
  const [progressionStep, setProgressionStep] = useState("2.5")
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const results = useMemo(() => rankExercises(library, sessions, query, excludedIds), [excludedIds, library, query, sessions])
  const normalizedQuery = normalizeExerciseSearch(query)
  const exactMatch = library.some((exercise) => normalizeExerciseSearch(exercise.name) === normalizedQuery)

  async function add(exercise: ExerciseLibraryItem) {
    setBusyId(exercise.id)
    setError("")
    try {
      await onAdd(exercise)
      setConfirmation(`Added ${exercise.name}`)
      setQuery("")
      setOpen(false)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add exercise.")
    } finally {
      setBusyId("")
    }
  }

  async function createAndAdd() {
    const name = query.trim().replace(/\s+/g, " ")
    const step = progressionStep.trim() === "" ? null : Number(progressionStep)
    if (!name) return setError("Enter an exercise name first.")
    if (step !== null && (!Number.isFinite(step) || step < 0)) return setError("Check the progression step.")
    setBusyId("custom")
    setError("")
    try {
      const created = await createAndAddExercise({ name, category, loadType, progressionStepKg: step }, onCreateCustom, onAdd)
      setConfirmation(`Created and added ${created.name}`)
      setQuery("")
      setCreating(false)
      setOpen(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create exercise.")
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          autoFocus={autoFocus}
          className="pl-9 pr-10"
          placeholder="Search exercises..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setCreating(false); setConfirmation("") }}
          aria-label="Search exercises"
          aria-expanded={open}
        />
        {open && <Button type="button" size="icon-sm" variant="ghost" className="absolute right-1.5 top-1.5 text-slate-500" onClick={() => { setOpen(false); setCreating(false) }} aria-label="Close exercise search"><X /></Button>}
      </div>

      {confirmation && <p className="flex items-center gap-1.5 text-xs text-blue-300" role="status"><Check className="size-3.5" />{confirmation}</p>}
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}

      {open && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/20">
          <p className="px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-600">{normalizedQuery ? "Matches" : "Recent and useful"}</p>
          <div className="max-h-72 overflow-y-auto">
            {results.map((exercise) => (
              <div key={exercise.id} className="flex min-h-14 items-center justify-between gap-3 border-t border-slate-800/80 px-3 py-2.5 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{exercise.name}</p>
                  <p className="mt-0.5 truncate text-xs capitalize text-slate-500">{exercise.category} · {loadTypeLabel(exercise.load_type)}{exercise.user_id ? " · Custom" : ""}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" className="shrink-0 text-blue-300" disabled={Boolean(busyId)} onClick={() => add(exercise)}>{busyId === exercise.id ? <LoaderCircle className="animate-spin" /> : <Plus />} Add</Button>
              </div>
            ))}
            {!results.length && <p className="px-3 py-5 text-sm text-slate-500">No matching exercises.</p>}
          </div>

          {normalizedQuery && !exactMatch && !creating && (
            <button type="button" className="flex min-h-14 w-full items-center gap-3 border-t border-slate-800 px-3 py-3 text-left text-sm text-blue-300 hover:bg-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400" onClick={() => setCreating(true)}>
              <Sparkles className="size-4 shrink-0" />
              <span>Can&apos;t find it? <strong>Create “{query.trim()}”</strong></span>
            </button>
          )}

          {creating && (
            <div className="grid gap-3 border-t border-slate-800 bg-slate-900/65 p-3">
              <p className="text-sm font-medium text-slate-100">Create exercise</p>
              <FieldShell label="Exercise name" htmlFor="inline-custom-name"><Input id="inline-custom-name" value={query} onChange={(event) => setQuery(event.target.value)} /></FieldShell>
              <div className="grid grid-cols-2 gap-2">
                <FieldShell label="Load" htmlFor="inline-custom-load"><Select id="inline-custom-load" value={loadType} onChange={(event) => setLoadType(event.target.value as ExerciseLoadType)}><option value="per_dumbbell">Per dumbbell</option><option value="total">Total load</option><option value="bodyweight">Bodyweight</option><option value="none">No load</option></Select></FieldShell>
                <FieldShell label="Category" htmlFor="inline-custom-category"><Select id="inline-custom-category" value={category} onChange={(event) => setCategory(event.target.value as ExerciseCategory)}>{["chest", "back", "shoulders", "arms", "legs", "core", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</Select></FieldShell>
              </div>
              <FieldShell label="Progression step" hint="kg, optional" htmlFor="inline-custom-step"><Input id="inline-custom-step" type="number" min="0" step="0.5" inputMode="decimal" value={progressionStep} onChange={(event) => setProgressionStep(event.target.value)} /></FieldShell>
              <Button type="button" onClick={createAndAdd} disabled={Boolean(busyId)}>{busyId === "custom" && <LoaderCircle className="animate-spin" />} Create &amp; Add</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
