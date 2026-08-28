import { AlertCircle, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PageLoader({ label = "Loading your data…" }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-slate-400">
      <div className="flex items-center gap-2 text-sm">
        <LoaderCircle className="animate-spin" /> {label}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-100">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-red-200/80">{message}</p>
          {onRetry && (
            <Button variant="outline" className="mt-4" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function InlineError({ message }: { message: string }) {
  if (!message) return null
  return <p className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">{message}</p>
}
