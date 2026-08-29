import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { AppShell, type AppTab } from "./components/layout/AppShell.tsx"
import { ErrorState, PageLoader } from "./components/shared/Feedback.tsx"
import { Modal } from "./components/shared/Modal.tsx"
import { FoodEntryForm } from "./components/food/FoodEntryForm.tsx"
import { FastFoodDialog } from "./components/food/FastFoodDialog.tsx"
import { WeightForm } from "./components/weight/WeightForm.tsx"
import { EquipmentSettings } from "./components/workout/EquipmentSettings.tsx"
import { CalorieReviewPanel } from "./components/calories/CalorieReviewPanel.tsx"
import { AdaptiveCalorieSettings } from "./components/calories/AdaptiveCalorieSettings.tsx"
import { useAuth } from "./hooks/use-auth.ts"
import { useFitnessData } from "./hooks/use-fitness-data.ts"
import { getWeightTrend } from "./lib/calculations.ts"
import { evaluateCalorieReview } from "./lib/calorie-adaptation.ts"
import { acceptCalorieReview, analyzeFoodImage, analyzeFoodText, copyMealFromDate, createCalorieReview, deleteFavouriteFood, deleteFoodEntry, deleteSavedMeal, dismissCalorieReview, getProfile, logSavedMeal, saveEquipmentSettings, saveFavouriteFood, saveFoodEntry, saveFoodEstimate, saveSavedMeal, setAdaptiveCalorieEnabled, setDailyFoodLogComplete, upsertWeight } from "./services/fitness.ts"
import { AuthPage } from "./pages/AuthPage.tsx"
import { FoodPage } from "./pages/FoodPage.tsx"
import { HomePage } from "./pages/HomePage.tsx"
import { OnboardingPage } from "./pages/OnboardingPage.tsx"
import { ProgressPage } from "./pages/ProgressPage.tsx"
import { WorkoutPage } from "./pages/WorkoutPage.tsx"
import type { FavouriteFood, FoodEntry, FoodEntryInput, FoodEstimateLogInput, MealType, Profile, SavedMeal, SavedMealInput } from "./types/fitness.ts"
import { supabase } from "./lib/supabase.ts"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

type FastFoodTab = "recent" | "frequent" | "favourites" | "meals" | "search" | "manual"
type ModalState =
  | { type: "food"; entry: FoodEntry }
  | { type: "fast-food"; seed?: FoodEntryInput; initialTab?: FastFoodTab; initialMeal?: SavedMealInput }
  | { type: "weight" }
  | { type: "account" }
  | { type: "calorie-review" }
  | null

function getInitialTab(): AppTab {
  const hash = window.location.hash.replace("#", "")
  return ["home", "food", "workout", "progress"].includes(hash) ? hash as AppTab : "home"
}

function MainApp({ user, profile, onProfileRefresh }: { user: User; profile: Profile; onProfileRefresh: () => Promise<void> }) {
  const { data, loading, error, refresh } = useFitnessData(user.id)
  const [tab, setTab] = useState<AppTab>(getInitialTab)
  const [modal, setModal] = useState<ModalState>(null)
  const [actionError, setActionError] = useState("")
  const [lastMealType, setLastMealType] = useState<MealType>("breakfast")

  function changeTab(nextTab: AppTab) {
    setTab(nextTab)
    window.history.replaceState(null, "", `#${nextTab}`)
  }

  async function handleFoodSave(input: Parameters<typeof saveFoodEntry>[1]) {
    await saveFoodEntry(user.id, input, modal?.type === "food" ? modal.entry.id : undefined)
    setLastMealType(input.mealType)
    await refresh()
    setModal(null)
  }

  async function handleFoodEstimateSave(input: FoodEstimateLogInput) {
    await saveFoodEstimate(user.id, input)
    setLastMealType(input.mealType)
    await refresh()
    setModal(null)
  }

  async function handleSaveFavourite(input: Parameters<typeof saveFavouriteFood>[1], id?: string) {
    await saveFavouriteFood(user.id, input, id)
    await refresh()
  }

  async function handleDeleteFavourite(id: string) {
    await deleteFavouriteFood(user.id, id)
    await refresh()
  }

  async function handleToggleFavourite(entry: FoodEntry, favourite?: FavouriteFood) {
    if (favourite) await deleteFavouriteFood(user.id, favourite.id)
    else await saveFavouriteFood(user.id, { name: entry.name, calories: entry.calories, proteinG: entry.protein_g, defaultMealType: entry.meal_type })
    await refresh()
  }

  async function handleSaveMeal(input: SavedMealInput, id?: string) {
    await saveSavedMeal(user.id, input, id)
    await refresh()
  }

  async function handleDeleteSavedMeal(id: string) {
    await deleteSavedMeal(user.id, id)
    await refresh()
  }

  async function handleLogSavedMeal(meal: SavedMeal, mealType?: MealType) {
    await logSavedMeal(user.id, meal, mealType)
    setLastMealType(mealType ?? meal.default_meal_type ?? "snack")
    await refresh()
    setModal(null)
  }

  async function handleCopyMeal(entries: FoodEntry[]) {
    await copyMealFromDate(user.id, entries)
    await refresh()
  }

  async function handleDeleteFood(entry: FoodEntry) {
    if (!window.confirm(`Delete “${entry.name}”? This cannot be undone.`)) return
    setActionError("")
    try {
      await deleteFoodEntry(user.id, entry.id)
      await refresh()
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Could not delete this entry.")
    }
  }

  async function handleWeightSave(weightKg: number, recordedOn: string) {
    await upsertWeight(user.id, weightKg, recordedOn)
    await refresh()
    setModal(null)
  }

  async function handleFoodLogCompletion(date: string, isComplete: boolean) {
    await setDailyFoodLogComplete(user.id, date, isComplete)
    await refresh()
  }

  if (loading) return <AppShell activeTab={tab} onTabChange={changeTab} onOpenAccount={() => setModal({ type: "account" })} email={user.email}><PageLoader /></AppShell>
  if (error || !data) return <AppShell activeTab={tab} onTabChange={changeTab} onOpenAccount={() => setModal({ type: "account" })} email={user.email}><ErrorState message={error || "No data was returned."} onRetry={refresh} /></AppShell>

  const trend = getWeightTrend(data.weightEntries)
  const adaptiveReview = profile.adaptive_calorie_enabled && data.calorieTarget ? evaluateCalorieReview({
    goal: profile.goal,
    currentTarget: data.calorieTarget.calories,
    targetHistory: data.calorieTargetHistory,
    weights: data.weightEntries,
    foodEntries: data.foodEntries,
    foodStatuses: data.dailyFoodLogStatuses,
    previousReviews: data.calorieReviews,
  }) : undefined

  async function acknowledgeCalorieReview(accept: boolean) {
    if (!adaptiveReview || adaptiveReview.status === "insufficient_data") return
    const review = await createCalorieReview(user.id, profile.goal, adaptiveReview)
    if (accept && adaptiveReview.suggestedTarget !== null) await acceptCalorieReview(review.id)
    else await dismissCalorieReview(user.id, review.id)
    await refresh()
    setModal(null)
  }
  return (
    <AppShell activeTab={tab} onTabChange={changeTab} onOpenAccount={() => setModal({ type: "account" })} email={user.email}>
      {actionError && <div className="mb-5"><ErrorState message={actionError} /></div>}
      {tab === "home" && <HomePage data={data} onAddFood={() => setModal({ type: "fast-food" })} onLogWeight={() => setModal({ type: "weight" })} onOpenWorkout={() => changeTab("workout")} adaptiveReview={adaptiveReview} onOpenCalorieReview={() => setModal({ type: "calorie-review" })} />}
      {tab === "food" && <FoodPage data={data} onAdd={() => setModal({ type: "fast-food" })} onQuickAdd={(seed) => setModal({ type: "fast-food", seed })} onEdit={(entry) => setModal({ type: "food", entry })} onDelete={handleDeleteFood} onToggleFavourite={handleToggleFavourite} onSaveAsMeal={(entries, mealType) => setModal({ type: "fast-food", initialTab: "meals", initialMeal: { name: "", defaultMealType: mealType, items: entries.map((entry) => ({ name: entry.name, calories: entry.calories, proteinG: entry.protein_g })) } })} onCopyMeal={handleCopyMeal} onLogSavedMeal={handleLogSavedMeal} onSetDayComplete={handleFoodLogCompletion} />}
      {tab === "workout" && <WorkoutPage userId={user.id} data={data} dumbbellMaxKg={profile.has_adjustable_dumbbells ? profile.dumbbell_max_kg : null} onRefresh={refresh} />}
      {tab === "progress" && <ProgressPage data={data} adaptiveReview={adaptiveReview} onOpenCalorieReview={() => setModal({ type: "calorie-review" })} onLogWeight={() => setModal({ type: "weight" })} />}

      {modal?.type === "food" && (
        <Modal title="Edit food" description="Historical entries keep the values saved on that day." onClose={() => setModal(null)}>
          <FoodEntryForm entry={modal.entry} onSubmit={handleFoodSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "fast-food" && (
        <Modal title="Add food" description="Reuse something familiar or enter it manually." onClose={() => setModal(null)}>
          <FastFoodDialog foodEntries={data.foodEntries} favourites={data.favouriteFoods} savedMeals={data.savedMeals} defaultMealType={lastMealType} initialSeed={modal.seed} initialTab={modal.initialTab} initialMealInput={modal.initialMeal} onAdd={handleFoodSave} onSaveFavourite={handleSaveFavourite} onDeleteFavourite={handleDeleteFavourite} onSaveMeal={handleSaveMeal} onDeleteMeal={handleDeleteSavedMeal} onLogMeal={handleLogSavedMeal} onAnalyzeFood={analyzeFoodText} onAnalyzeImage={analyzeFoodImage} onLogEstimate={handleFoodEstimateSave} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "weight" && (
        <Modal title="Log weight" description="Daily changes are noisy. The app focuses on your 7-day average." onClose={() => setModal(null)}>
          <WeightForm latestWeight={trend.latest} onSubmit={handleWeightSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "calorie-review" && adaptiveReview && adaptiveReview.status !== "insufficient_data" && (
        <Modal title="Weekly Calorie Review" description="A conservative check based on two weeks of complete logs." onClose={() => setModal(null)}>
          <CalorieReviewPanel result={adaptiveReview} onAccept={() => acknowledgeCalorieReview(true)} onKeep={() => acknowledgeCalorieReview(false)} />
        </Modal>
      )}
      {modal?.type === "account" && (
        <Modal title="Profile & settings" description={user.email} onClose={() => setModal(null)}>
          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-950 p-4 text-sm">
            <div><dt className="text-slate-500">Goal</dt><dd className="mt-1 capitalize text-slate-200">{profile.goal} weight</dd></div>
            <div><dt className="text-slate-500">Activity</dt><dd className="mt-1 capitalize text-slate-200">{profile.activity_level === "light" ? "Lightly active" : profile.activity_level}</dd></div>
            <div><dt className="text-slate-500">Height</dt><dd className="mt-1 text-slate-200">{profile.height_cm} cm</dd></div>
            <div><dt className="text-slate-500">Current target</dt><dd className="mt-1 text-slate-200">{data.calorieTarget?.calories.toLocaleString() ?? "—"} kcal</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-slate-500">Formula baseline: {data.calorieTargetHistory.find((target) => target.reason === "initial_estimate" || target.reason === "profile_recalculation")?.calories.toLocaleString() ?? "—"} kcal. Accepted adaptive changes create new history rows and never overwrite it.</p>
          <AdaptiveCalorieSettings enabled={profile.adaptive_calorie_enabled} onToggle={async (enabled) => { await setAdaptiveCalorieEnabled(user.id, enabled); await onProfileRefresh(); await refresh() }} />
          <EquipmentSettings profile={profile} onSave={async (input) => { await saveEquipmentSettings(user.id, input); await onProfileRefresh() }} />
          <Button variant="outline" size="lg" className="mt-6 h-11 w-full text-red-200 hover:text-red-100" onClick={() => supabase.auth.signOut()}><LogOut /> Sign out</Button>
        </Modal>
      )}
    </AppShell>
  )
}

function AuthenticatedApp({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [error, setError] = useState("")

  const loadProfile = useCallback(async () => {
    setError("")
    try {
      setProfile(await getProfile(user.id))
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not load your profile.")
    }
  }, [user.id])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- this starts the external Supabase sync.
    void loadProfile()
  }, [loadProfile])

  if (error) return <main className="min-h-dvh bg-slate-950 p-5 text-white"><div className="mx-auto mt-24 max-w-lg"><ErrorState message={error} onRetry={loadProfile} /></div></main>
  if (profile === undefined) return <main className="min-h-dvh bg-slate-950 text-white"><PageLoader label="Preparing your account…" /></main>
  if (!profile?.onboarding_completed) return <OnboardingPage userId={user.id} onComplete={loadProfile} />
  return <MainApp user={user} profile={profile} onProfileRefresh={loadProfile} />
}

function App() {
  const { session, loading } = useAuth()
  if (loading) return <main className="min-h-dvh bg-slate-950 text-white"><PageLoader label="Checking your session…" /></main>
  if (!session) return <AuthPage />
  return <AuthenticatedApp user={session.user} />
}

export default App
