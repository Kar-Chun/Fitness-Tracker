import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react"

interface FieldShellProps {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}

export function FieldShell({ label, htmlFor, hint, children }: FieldShellProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-200" htmlFor={htmlFor}>
      <span>
        {label}
        {hint && <span className="ml-1 font-normal text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${props.className ?? ""}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${props.className ?? ""}`}
    />
  )
}
