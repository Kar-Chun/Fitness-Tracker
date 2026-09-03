import { useMemo, useState, type FormEvent } from "react"
import { Activity, ArrowRight, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { calculateCalorieTarget } from "../lib/calculations.ts"
import { completeOnboarding } from "../services/profile.ts"
import type { ActivityLevel, Goal, Sex } from "../types/fitness.ts"
import { FieldShell, Input, Select } from "../components/shared/FormField.tsx"
import { InlineError } from "../components/shared/Feedback.tsx"

interface OnboardingPageProps {
  userId: string
  onComplete: () => void
}

export function OnboardingPage({ userId, onComplete }: OnboardingPageProps) {
  const [age, setAge] = useState("")
  const [sex, setSex] = useState<Sex>("female")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [goal, setGoal] = useState<Goal>("maintain")
  const [activity, setActivity] = useState<ActivityLevel>("sedentary")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const estimate = useMemo(() => {
    const values = { age: Number(age), heightCm: Number(height), weightKg: Number(weight) }
    if (!values.age || !values.heightCm || !values.weightKg) return null
    return calculateCalorieTarget({ ...values, sex, goal, activityLevel: activity })
  }, [activity, age, goal, height, sex, weight])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const ageValue = Number(age)
    const heightValue = Number(height)
    const weightValue = Number(weight)
    if (!Number.isInteger(ageValue) || ageValue < 13 || ageValue > 120) return setError("Enter an age between 13 and 120.")
    if (!Number.isFinite(heightValue) || heightValue < 80 || heightValue > 250) return setError("Enter a height between 80 and 250 cm.")
    if (!Number.isFinite(weightValue) || weightValue <= 0 || weightValue >= 500) return setError("Enter a weight between 1 and 499 kg.")

    setSubmitting(true)
    setError("")
    try {
      await completeOnboarding(userId, {
        age: ageValue,
        sex,
        heightCm: heightValue,
        weightKg: weightValue,
        goal,
        activityLevel: activity,
      })
      onComplete()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save your profile.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-blue-500"><Activity className="size-5" /></div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">One-time setup</p>
            <h1 className="text-2xl font-semibold">Set your starting point</h1>
          </div>
        </div>

        <form className="grid gap-6" onSubmit={handleSubmit}>
          <section className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2 sm:p-6">
            <FieldShell label="Age" htmlFor="age">
              <Input id="age" type="number" min="13" max="120" inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} />
            </FieldShell>
            <FieldShell label="Sex used for calculation" htmlFor="sex">
              <Select id="sex" value={sex} onChange={(event) => setSex(event.target.value as Sex)}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
            </FieldShell>
            <FieldShell label="Height" hint="cm" htmlFor="height">
              <Input id="height" type="number" min="80" max="250" step="0.1" inputMode="decimal" value={height} onChange={(event) => setHeight(event.target.value)} />
            </FieldShell>
            <FieldShell label="Current weight" hint="kg" htmlFor="weight">
              <Input id="weight" type="number" min="1" max="499" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </FieldShell>
            <FieldShell label="Goal" htmlFor="goal">
              <Select id="goal" value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>
                <option value="lose">Lose weight</option>
                <option value="maintain">Maintain weight</option>
                <option value="gain">Gain weight</option>
              </Select>
            </FieldShell>
            <FieldShell label="Activity" htmlFor="activity">
              <Select id="activity" value={activity} onChange={(event) => setActivity(event.target.value as ActivityLevel)}>
                <option value="sedentary">Mostly sedentary</option>
                <option value="light">Lightly active</option>
                <option value="active">Active</option>
              </Select>
            </FieldShell>
          </section>

          <section className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5 sm:p-6">
            <p className="text-sm font-medium text-blue-300">Starting calorie estimate</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{estimate ? estimate.toLocaleString() : "—"} <span className="text-lg font-normal text-slate-400">kcal/day</span></p>
            <p className="mt-3 text-sm leading-6 text-slate-400">This is a practical estimate from the Mifflin-St Jeor formula, not an exact biological measurement. V1 will not automatically change it when you log weight.</p>
          </section>

          <InlineError message={error} />
          <Button type="submit" size="lg" className="h-12 bg-blue-500 text-base hover:bg-blue-400" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            Save and continue
          </Button>
        </form>
      </div>
    </main>
  )
}
