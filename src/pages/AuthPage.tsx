import { useState, type FormEvent } from "react"
import { Activity, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "../lib/supabase.ts"
import { FieldShell, Input } from "../components/shared/FormField.tsx"
import { InlineError } from "../components/shared/Feedback.tsx"

type AuthMode = "login" | "signup"

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.includes("@")) return setError("Enter a valid email address.")
    if (password.length < 6) return setError("Password must be at least 6 characters.")
    setSubmitting(true)
    setError("")
    setMessage("")
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (result.error) return setError(result.error.message)
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then come back to log in.")
    }
  }

  return (
    <main className="min-h-dvh bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-md content-center">
        <div className="mb-8">
          <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
            <Activity className="size-6" />
          </div>
          <p className="mb-2 text-sm font-medium text-blue-400">CONSISTENCY, MADE SIMPLE</p>
          <h1 className="text-4xl font-semibold tracking-tight">Your daily fitness, clearly.</h1>
          <p className="mt-3 max-w-sm leading-7 text-slate-400">Track calories, complete a practical workout, and follow the trend—not the noise.</p>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-950 p-1" aria-label="Authentication mode">
            {(["login", "signup"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`h-10 rounded-lg text-sm font-medium transition ${mode === item ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
                onClick={() => { setMode(item); setError(""); setMessage("") }}
              >
                {item === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <FieldShell label="Email" htmlFor="auth-email">
              <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FieldShell>
            <FieldShell label="Password" htmlFor="auth-password">
              <Input id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
            </FieldShell>
            <InlineError message={error} />
            {message && <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{message}</p>}
            <Button type="submit" size="lg" className="mt-2 h-11 bg-blue-500 hover:bg-blue-400" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}
