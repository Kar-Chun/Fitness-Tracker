import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({ eyebrow, title, description, action, className }: { eyebrow: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-blue-400/90">{eyebrow}</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>{eyebrow && <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-600">{eyebrow}</p>}<h2 className={cn("font-semibold tracking-tight text-slate-100", eyebrow && "mt-1")}>{title}</h2></div>
      {action}
    </div>
  )
}

export function Surface({ children, className, as: Component = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Component className={cn("rounded-2xl border border-slate-800/90 bg-slate-900/75 shadow-[0_1px_0_rgba(255,255,255,0.025)]", className)}>{children}</Component>
}

export function IconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border border-blue-400/10 bg-blue-500/10 text-blue-400", className)}><Icon className="size-4.5" /></span>
}

export function ProgressBar({ value, label, over = false, className }: { value: number; label: string; over?: boolean; className?: string }) {
  const safeValue = Math.min(100, Math.max(0, value))
  return (
    <div className={className}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={label} aria-valuenow={Math.round(safeValue)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-300", over ? "bg-amber-400" : "bg-blue-500")} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}

export function MetricCard({ icon, label, value, suffix, detail, className }: { icon?: LucideIcon; label: string; value: ReactNode; suffix?: string; detail?: ReactNode; className?: string }) {
  return (
    <Surface className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2.5">{icon && <IconBadge icon={icon} />}<p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p></div>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-50 tabular-nums">{value}{suffix && <span className="ml-1.5 text-sm font-normal tracking-normal text-slate-500">{suffix}</span>}</p>
      {detail && <div className="mt-2 text-sm text-slate-500">{detail}</div>}
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
