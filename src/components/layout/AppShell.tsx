import { Activity, Apple, ChartNoAxesCombined, Dumbbell, Home, Settings } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export type AppTab = "home" | "food" | "workout" | "progress"

interface AppShellProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  onOpenAccount: () => void
  email?: string
  children: ReactNode
}

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "food", label: "Food", icon: Apple },
  { id: "workout", label: "Workout", icon: Dumbbell },
  { id: "progress", label: "Progress", icon: ChartNoAxesCombined },
] as const

export function AppShell({ activeTab, onTabChange, onOpenAccount, email, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 px-4 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-500"><Activity className="size-5" /></span>
            <span className="font-semibold tracking-tight">Steady</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-52 truncate text-sm text-slate-500 sm:block">{email}</span>
            <Button variant="ghost" size="icon" onClick={onOpenAccount} aria-label="Open profile and settings" title="Profile and settings"><Settings /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8 md:px-6">
        <nav className="hidden pt-8 md:block" aria-label="Primary navigation">
          <div className="sticky top-24 grid gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => onTabChange(id)} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${activeTab === id ? "bg-blue-500/15 text-blue-300" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"}`}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
          </div>
        </nav>
        <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 md:px-0 md:pb-12 md:pt-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Primary navigation">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onTabChange(id)} className={`grid min-h-14 place-items-center gap-0.5 rounded-xl text-[11px] font-medium transition ${activeTab === id ? "text-blue-400" : "text-slate-500"}`}>
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
