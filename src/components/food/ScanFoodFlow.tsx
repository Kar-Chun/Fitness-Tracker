import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { ArrowLeft, Camera, ImagePlus, LoaderCircle, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fileToBase64, getSupportedFoodImageType, validateFoodImage } from "../../lib/food-image.ts"
import type { FoodEstimateLogInput, FoodImageAnalysisInput, FoodImageAnalysisResult, MealType } from "../../types/fitness.ts"
import { InlineError } from "../shared/Feedback.tsx"
import { FoodEstimateReview } from "./DescribeFoodFlow.tsx"

const imageAccept = "image/jpeg,image/png,image/webp,image/heic,image/heif"
const noteLimit = 300

interface ScanFoodFlowProps {
  defaultMealType: MealType
  onAnalyze: (input: FoodImageAnalysisInput) => Promise<FoodImageAnalysisResult>
  onLog: (input: FoodEstimateLogInput) => Promise<void>
  onDescribe: () => void
  onBack: () => void
}

export function ScanFoodFlow({ defaultMealType, onAnalyze, onLog, onDescribe, onBack }: ScanFoodFlowProps) {
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [note, setNote] = useState("")
  const [result, setResult] = useState<FoodImageAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState("")

  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ""
    if (!selected) return
    const validation = validateFoodImage(selected)
    if (validation.error) return setError(validation.error)
    setFile(selected)
    setPreviewFailed(false)
    setResult(null)
    setError("")
  }

  async function analyze() {
    if (!file || analyzing) return
    const validation = validateFoodImage(file)
    if (validation.error || !validation.mimeType) return setError(validation.error)
    setAnalyzing(true)
    setError("")
    try {
      const imageBase64 = await fileToBase64(file)
      setResult(await onAnalyze({ imageBase64, mimeType: validation.mimeType, note: note.trim() }))
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Could not analyze this meal photo.")
    } finally {
      setAnalyzing(false)
    }
  }

  if (result?.status === "ok") {
    return <FoodEstimateReview estimate={result.estimate} defaultMealType={defaultMealType} onLog={onLog} onTryAgain={() => setResult(null)} previewUrl={previewFailed ? undefined : previewUrl} uncertainties={result.uncertainties} />
  }

  const statusMessage = result?.status === "no_food" || result?.status === "too_uncertain" ? result.message : ""
  return (
    <div className="grid gap-4">
      <button type="button" className="flex items-center gap-2 text-left text-sm text-slate-500 hover:text-slate-300" onClick={onBack}><ArrowLeft className="size-4" /> Back to quick add</button>
      <input ref={cameraInput} className="hidden" type="file" accept={imageAccept} capture="environment" onChange={chooseFile} />
      <input ref={libraryInput} className="hidden" type="file" accept={imageAccept} onChange={chooseFile} />

      {!file ? (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-blue-100"><Camera className="size-4" /> Scan a meal</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">Take one clear photo of your portion. You will review the estimate before anything is logged.</p>
          </div>
          <Button size="lg" className="h-12 bg-blue-500 hover:bg-blue-400" onClick={() => cameraInput.current?.click()}><Camera /> Take photo</Button>
          <Button size="lg" variant="outline" className="h-12" onClick={() => libraryInput.current?.click()}><ImagePlus /> Choose photo</Button>
          <p className="text-center text-xs leading-5 text-slate-500">JPEG, PNG, WebP, HEIC, or HEIF · maximum 6 MB</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            {!previewFailed && previewUrl ? <img src={previewUrl} alt="Selected meal preview" className="max-h-72 w-full object-contain" onError={() => setPreviewFailed(true)} /> : <div className="grid min-h-32 place-items-center px-4 text-center text-sm text-slate-500">Preview unavailable for this format. The photo can still be analyzed.</div>}
            <div className="border-t border-slate-800 p-3"><p className="truncate text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-slate-500">{getSupportedFoodImageType(file)} · {(file.size / 1024 / 1024).toFixed(1)} MB</p></div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><label htmlFor="photo-note" className="text-sm font-medium text-slate-200">Optional meal note</label><span className="text-xs text-slate-500">{note.length}/{noteLimit}</span></div>
            <textarea id="photo-note" className="min-h-24 w-full resize-y rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" maxLength={noteLimit} value={note} placeholder="e.g. half rice, chicken has skin" onChange={(event) => setNote(event.target.value)} />
          </div>
          {statusMessage && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
              <p className="font-medium text-amber-100">{statusMessage}</p>
              {result && result.uncertainties.length > 0 && <ul className="mt-2 grid gap-1 text-sm text-slate-400">{result.uncertainties.map((item) => <li key={item}>• {item}</li>)}</ul>}
            </div>
          )}
          <InlineError message={error} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11" disabled={analyzing} onClick={() => libraryInput.current?.click()}><RefreshCw /> Change photo</Button>
            <Button className="h-11 bg-blue-500 hover:bg-blue-400" disabled={analyzing} onClick={analyze}>{analyzing ? <><LoaderCircle className="animate-spin" /> Analyzing...</> : <><Camera /> Analyze meal</>}</Button>
          </div>
          {statusMessage && <Button variant="ghost" className="h-11" disabled={analyzing} onClick={onDescribe}><Sparkles /> Describe meal instead</Button>}
          <p className="text-center text-xs leading-5 text-slate-500">The photo is sent only when you analyze it and is not intentionally stored by the Fitness App.</p>
        </>
      )}
    </div>
  )
}
