import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({ eyebrow, title, description, action, className }: { eyebrow: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-3 sm:gap-4", className)}>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-blue-400/90">{eyebrow}</p>
        <h1 className="mt-1 text-[1.8rem] font-semibold leading-tight tracking-[-0.04em] text-slate-50 sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.82rem] leading-5 text-slate-500 sm:text-sm sm:leading-6">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function MobilePageHeader({ title, subtitle, eyebrow, action, className }: { title: string; subtitle?: string; eyebrow?: string; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[0.78rem] font-medium text-blue-200/75">{eyebrow}</p>}
        <h1 className="text-[1.85rem] font-semibold leading-none tracking-[-0.045em] text-slate-50 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[0.82rem] leading-5 text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-4 sm:mb-3">
      <div>{eyebrow && <p className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-600">{eyebrow}</p>}<h2 className={cn("text-[0.95rem] font-semibold tracking-tight text-slate-100 sm:text-base", eyebrow && "mt-1")}>{title}</h2></div>
      {action}
    </div>
  )
}

export function Surface({ children, className, as: Component = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Component className={cn("rounded-[1.15rem] border border-[#1b2d45] bg-[#0d1a2c]/95 shadow-[0_1px_0_rgba(255,255,255,0.035),0_16px_40px_-32px_rgba(0,0,0,0.95)]", className)}>{children}</Component>
}

export function IconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-blue-400/15 bg-blue-500/12 text-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", className)}><Icon className="size-4.5" /></span>
}

export function ProgressBar({ value, label, over = false, className }: { value: number; label: string; over?: boolean; className?: string }) {
  const safeValue = Math.min(100, Math.max(0, value))
  return (
    <div className={className}>
      <div className="h-2 overflow-hidden rounded-full bg-[#1a2b44]" role="progressbar" aria-label={label} aria-valuenow={Math.round(safeValue)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-300", over ? "bg-amber-400" : "bg-gradient-to-r from-blue-500 to-cyan-300")} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}

export function CircularProgress({ value, label, over = false }: { value: number; label: string; over?: boolean }) {
  const safeValue = Math.min(100, Math.max(0, value))
  const color = over ? "#fbbf24" : "#38d8f5"
  return (
    <div className="relative grid size-[4.65rem] shrink-0 place-items-center rounded-full p-[0.42rem]" style={{ background: `conic-gradient(${color} ${safeValue * 3.6}deg, #1a2b44 0deg)` }} role="progressbar" aria-label={label} aria-valuenow={Math.round(safeValue)} aria-valuemin={0} aria-valuemax={100}>
      <div className="grid size-full place-items-center rounded-full bg-[#0b1728] text-base font-semibold tabular-nums text-slate-100">{Math.round(safeValue)}%</div>
    </div>
  )
}

export function MetricCard({ icon, label, value, suffix, detail, className }: { icon?: LucideIcon; label: string; value: ReactNode; suffix?: string; detail?: ReactNode; className?: string }) {
  return (
    <Surface className={cn("min-w-0 p-3.5 sm:p-5", className)}>
      <div className="flex items-center gap-2">{icon && <IconBadge icon={icon} className="size-7" />}<p className="min-w-0 text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p></div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-slate-50 tabular-nums sm:mt-4 sm:text-3xl">{value}{suffix && <span className="ml-1 text-[0.68rem] font-normal tracking-normal text-slate-500 sm:text-sm">{suffix}</span>}</p>
      {detail && <div className="mt-1.5 text-[0.72rem] leading-4 text-slate-500 sm:mt-2 sm:text-sm">{detail}</div>}
    </Surface>
  )
}

export function EmptyState({ icon: Icon, title, description, action, compact = false }: { icon: LucideIcon; title: string; description: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("grid place-items-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 px-5 text-center", compact ? "py-6" : "py-10")}>
      <IconBadge icon={Icon} className="border-slate-700/60 bg-slate-800/60 text-slate-400" />
      <h3 className="mt-3 font-medium text-slate-200">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
