import { Activity, Apple, ChartNoAxesCombined, ChevronLeft, ChevronRight, Dumbbell, Home, Settings } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
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

const SIDEBAR_STORAGE_KEY = "steady.desktopSidebarCollapsed"

export function AppShell({ activeTab, onTabChange, onOpenAccount, email, children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
      return stored === null ? window.innerWidth < 1024 : stored === "true"
    }
    catch { return false }
  })

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try { window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)) }
    catch { /* The sidebar still works when storage is unavailable. */ }
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_50%_-8rem,rgba(32,99,190,0.15),transparent_30rem),#050d19] text-white">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-800/80 bg-[#091423] transition-[width] duration-200 md:flex ${sidebarCollapsed ? "w-[4.5rem]" : "w-60"}`} aria-label="Desktop navigation">
        <div className={`flex h-[4.5rem] shrink-0 items-center ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-5"}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500 text-white shadow-[0_8px_22px_-10px_rgba(59,130,246,0.9)]"><Activity className="size-5" /></span>
          {!sidebarCollapsed && <span className="text-lg font-semibold tracking-[-0.03em]">Steady</span>}
        </div>
        <nav className="grid gap-1 px-3 py-4" aria-label="Primary navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onTabChange(id)} aria-label={label} title={sidebarCollapsed ? label : undefined} aria-current={activeTab === id ? "page" : undefined} className={`relative flex h-11 items-center rounded-xl text-sm font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/50 ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"} ${activeTab === id ? "bg-blue-500/12 text-blue-300" : "text-slate-500 hover:bg-slate-800/70 hover:text-slate-200"}`}>
              {activeTab === id && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-blue-400" />}
              <Icon className="size-5 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-3 pb-3">
          <button type="button" onClick={onOpenAccount} aria-label="Open profile and settings" title={sidebarCollapsed ? "Settings" : undefined} className={`flex h-11 w-full items-center rounded-xl text-sm font-medium text-slate-500 outline-none transition duration-200 hover:bg-slate-800/70 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500/50 ${sidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}><Settings className="size-5 shrink-0" />{!sidebarCollapsed && <span>Settings</span>}</button>
          {!sidebarCollapsed && email && <p className="mt-2 truncate px-3 text-[0.68rem] text-slate-700">{email}</p>}
          <div className="my-3 border-t border-slate-800" />
          <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : undefined} className={`flex h-10 w-full items-center rounded-xl text-sm font-medium text-slate-600 outline-none transition duration-200 hover:bg-slate-800/70 hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500/50 ${sidebarCollapsed ? "justify-center" : "justify-end gap-2 px-3"}`}>
          {!sidebarCollapsed && <span>Collapse</span>}
          {sidebarCollapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
        </div>
      </aside>

      <Button variant="ghost" size="icon" className="fixed right-4 top-[calc(env(safe-area-inset-top)+0.6rem)] z-30 size-10 rounded-full border border-[#1b2d45] bg-[#0d1a2c]/90 text-slate-400 shadow-lg backdrop-blur-md md:hidden" onClick={onOpenAccount} aria-label="Open profile and settings" title="Profile and settings"><Settings /></Button>

      <div className={`min-h-dvh transition-[margin-left] duration-200 ${sidebarCollapsed ? "md:ml-[4.5rem]" : "md:ml-60"}`}>
        <main className="mx-auto min-w-0 max-w-7xl px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.9rem)] sm:px-6 sm:pt-5 md:px-8 md:pb-12 md:pt-10 xl:px-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1b2d45] bg-[#071220]/95 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-14px_35px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl md:hidden" aria-label="Primary navigation">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onTabChange(id)} aria-label={label} aria-current={activeTab === id ? "page" : undefined} className={`relative grid min-h-[3.65rem] place-items-center content-center gap-0.5 rounded-xl text-[0.65rem] font-medium outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/50 ${activeTab === id ? "text-sky-400" : "text-slate-600 active:text-slate-300"}`}>
              <span className={`grid size-7 place-items-center rounded-lg transition duration-200 ${activeTab === id ? "bg-blue-500/12 shadow-[0_0_18px_-8px_rgba(56,189,248,0.8)]" : ""}`}><Icon className="size-[1.15rem]" /></span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
