import { cn } from "@/lib/utils"

export function SteadyLogo({ symbolOnly = false, className }: { symbolOnly?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5 text-slate-50", className)} role="img" aria-label="Steady">
      <img src="/brand/steady-icon.svg" alt="" width="40" height="40" className="size-10 shrink-0" />
      {!symbolOnly && <span aria-hidden="true" className="text-2xl font-semibold tracking-[-0.045em]">Steady</span>}
    </span>
  )
}
