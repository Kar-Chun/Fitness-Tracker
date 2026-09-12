import { CalendarRange, Check, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AdaptiveReviewResult } from "../../lib/calorie-adaptation.ts"
import { IconBadge, Surface } from "../shared/Visual.tsx"

interface CalorieReviewCardProps {
  result: AdaptiveReviewResult
  compact?: boolean
  onReview: () => void
}

export function CalorieReviewCard({ result, compact = false, onReview }: CalorieReviewCardProps) {
  const cooldown = result.reasonCode === "review_cooldown"
  const ready = result.status !== "insufficient_data"

  return (
    <Surface className={`relative overflow-hidden ${compact ? "p-4" : "p-4 sm:p-5"}`}>
      <div className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-cyan-300/70" />
      <div className="flex items-center gap-3">
        <IconBadge icon={ready ? Check : CalendarRange} className={ready ? "border-cyan-300/15 bg-cyan-400/10 text-cyan-300" : undefined} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-semibold text-slate-400">Adaptive calorie review</p>
          {ready ? (
            <>
              <h2 className="mt-0.5 text-sm font-semibold text-slate-100">Your review is ready.</h2>
              <p className="mt-1 text-xs text-slate-500">{result.dataQuality.label} · {result.dataQuality.completeFoodDays} complete food days</p>
            </>
          ) : cooldown ? (
            <>
              <h2 className="mt-0.5 text-sm font-semibold text-slate-100">Your latest review is current.</h2>
              <p className="mt-1 text-xs text-slate-500">Next review in about {result.cooldownDaysRemaining} {result.cooldownDaysRemaining === 1 ? "day" : "days"}.</p>
            </>
          ) : (
            <>
              <h2 className="mt-0.5 text-sm font-semibold text-slate-100">Keep logging to build your review.</h2>
              <p className="mt-1 text-xs text-slate-500">Weight {result.dataQuality.weightEntries} / 8 · Complete days {result.dataQuality.completeFoodDays} / 10</p>
            </>
          )}
        </div>
        {ready && <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-full" onClick={onReview} aria-label="Open calorie review"><ChevronRight /></Button>}
      </div>
    </Surface>
  )
}
