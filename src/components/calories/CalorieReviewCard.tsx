import { CalendarRange, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AdaptiveReviewResult } from "../../lib/calorie-adaptation.ts"

interface CalorieReviewCardProps {
  result: AdaptiveReviewResult
  compact?: boolean
  onReview: () => void
}

export function CalorieReviewCard({ result, compact = false, onReview }: CalorieReviewCardProps) {
  const cooldown = result.reasonCode === "review_cooldown"
  const ready = result.status !== "insufficient_data"
  return (
    <section className={`rounded-3xl border border-slate-800 bg-slate-900 ${compact ? "p-5" : "p-5 sm:p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-400"><CalendarRange className="size-4" /> Calorie Review</div>
          {ready ? (
            <><h2 className="mt-2 text-lg font-semibold">Your review is ready.</h2><p className="mt-1 text-sm text-slate-500">{result.dataQuality.label} · {result.dataQuality.completeFoodDays} complete food days</p></>
          ) : cooldown ? (
            <><h2 className="mt-2 text-lg font-semibold">Latest review is current</h2><p className="mt-1 text-sm text-slate-500">Next review in about {result.cooldownDaysRemaining} {result.cooldownDaysRemaining === 1 ? "day" : "days"}.</p></>
          ) : (
            <><h2 className="mt-2 text-lg font-semibold">Building your trend...</h2><p className="mt-1 text-sm text-slate-500">Weight {result.dataQuality.weightEntries} / 8 · Complete food days {result.dataQuality.completeFoodDays} / 10</p></>
          )}
        </div>
        {ready && <Button variant="ghost" size="icon" onClick={onReview} aria-label="Open calorie review"><ChevronRight /></Button>}
      </div>
    </section>
  )
}
