import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { AppShell, type AppTab } from "./components/layout/AppShell.tsx"
import { ErrorState, PageLoader } from "./components/shared/Feedback.tsx"
import { Modal } from "./components/shared/Modal.tsx"
import { FoodEntryForm } from "./components/food/FoodEntryForm.tsx"
import { WeightForm } from "./components/weight/WeightForm.tsx"
import { useAuth } from "./hooks/use-auth.ts"
import { useFitnessData } from "./hooks/use-fitness-data.ts"
import { getWeightTrend } from "./lib/calculations.ts"
import { completeWorkoutSession, deleteFoodEntry, getProfile, saveFoodEntry, startWorkout, upsertWeight } from "./services/fitness.ts"
import { AuthPage } from "./pages/AuthPage.tsx"
import { FoodPage } from "./pages/FoodPage.tsx"
import { HomePage } from "./pages/HomePage.tsx"
import { OnboardingPage } from "./pages/OnboardingPage.tsx"
import { ProgressPage } from "./pages/ProgressPage.tsx"
import { WorkoutPage } from "./pages/WorkoutPage.tsx"
import type { FoodEntry, Profile, WorkoutMode, WorkoutTemplate } from "./types/fitness.ts"
import { supabase } from "./lib/supabase.ts"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

type ModalState = { type: "food"; entry?: FoodEntry } | { type: "weight" } | { type: "account" } | null

function getInitialTab(): AppTab {
  const hash = window.location.hash.replace("#", "")
  return ["home", "food", "workout", "progress"].includes(hash) ? hash as AppTab : "home"
}

function MainApp({ user, profile }: { user: User; profile: Profile }) {
  const { data, loading, error, refresh } = useFitnessData(user.id)
  const [tab, setTab] = useState<AppTab>(getInitialTab)
  const [modal, setModal] = useState<ModalState>(null)
  const [actionError, setActionError] = useState("")

  function changeTab(nextTab: AppTab) {
    setTab(nextTab)
    window.history.replaceState(null, "", `#${nextTab}`)
  }

  async function handleFoodSave(input: Parameters<typeof saveFoodEntry>[1]) {
    await saveFoodEntry(user.id, input, modal?.type === "food" ? modal.entry?.id : undefined)
    await refresh()
    setModal(null)
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

  async function handleStartWorkout(template: WorkoutTemplate, mode: WorkoutMode) {
    const existing = data?.sessions.find((session) => !session.completed_at)
    if (existing) {
      changeTab("workout")
      return
    }
    await startWorkout(user.id, template.id, mode)
    await refresh()
    changeTab("workout")
  }

  async function handleCompleteWorkout(sessionId: string) {
    await completeWorkoutSession(user.id, sessionId)
    await refresh()
  }

  if (loading) return <AppShell activeTab={tab} onTabChange={changeTab} onOpenAccount={() => setModal({ type: "account" })} email={user.email}><PageLoader /></AppShell>
  if (error || !data) return <AppShell activeTab={tab} onTabChange={changeTab} onOpenAccount={() => setModal({ type: "account" })} email={user.email}><ErrorState message={error || "No data was returned."} onRetry={refresh} /></AppShell>

  const trend = getWeightTrend(data.weightEntries)
  return (
    <AppShell activeTab={tab} onTabChange={changeTab} onOpenAccount={() => setModal({ type: "account" })} email={user.email}>
      {actionError && <div className="mb-5"><ErrorState message={actionError} /></div>}
      {tab === "home" && <HomePage data={data} onAddFood={() => setModal({ type: "food" })} onLogWeight={() => setModal({ type: "weight" })} onStartWorkout={handleStartWorkout} />}
      {tab === "food" && <FoodPage data={data} onAdd={() => setModal({ type: "food" })} onEdit={(entry) => setModal({ type: "food", entry })} onDelete={handleDeleteFood} />}
      {tab === "workout" && <WorkoutPage userId={user.id} data={data} onStart={handleStartWorkout} onComplete={handleCompleteWorkout} onRefresh={refresh} />}
      {tab === "progress" && <ProgressPage data={data} />}

      {modal?.type === "food" && (
        <Modal title={modal.entry ? "Edit food" : "Add food"} description="Use your own best estimate for calories and protein." onClose={() => setModal(null)}>
          <FoodEntryForm entry={modal.entry} onSubmit={handleFoodSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "weight" && (
        <Modal title="Log weight" description="Daily changes are noisy. The app focuses on your 7-day average." onClose={() => setModal(null)}>
          <WeightForm latestWeight={trend.latest} onSubmit={handleWeightSave} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "account" && (
        <Modal title="Profile & settings" description={user.email} onClose={() => setModal(null)}>
          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-950 p-4 text-sm">
            <div><dt className="text-slate-500">Goal</dt><dd className="mt-1 capitalize text-slate-200">{profile.goal} weight</dd></div>
            <div><dt className="text-slate-500">Activity</dt><dd className="mt-1 capitalize text-slate-200">{profile.activity_level === "light" ? "Lightly active" : profile.activity_level}</dd></div>
            <div><dt className="text-slate-500">Height</dt><dd className="mt-1 text-slate-200">{profile.height_cm} cm</dd></div>
            <div><dt className="text-slate-500">Starting target</dt><dd className="mt-1 text-slate-200">{data.calorieTarget?.calories.toLocaleString() ?? "—"} kcal</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-slate-500">Your calorie target is the starting estimate from onboarding. V1 does not adjust it automatically.</p>
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
  return <MainApp user={user} profile={profile} />
}

function App() {
  const { session, loading } = useAuth()
  if (loading) return <main className="min-h-dvh bg-slate-950 text-white"><PageLoader label="Checking your session…" /></main>
  if (!session) return <AuthPage />
  return <AuthenticatedApp user={session.user} />
}

export default App
