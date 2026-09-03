export function toLocalDateKey(date: Date | string = new Date()) {
  const value = typeof date === "string" ? new Date(date) : date
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseLocalDateKey(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function addLocalDateKeyDays(value: string, amount: number) {
  const date = parseLocalDateKey(value)
  date.setDate(date.getDate() + amount)
  return toLocalDateKey(date)
}

export function isLocalDateKeyWithin(value: string, start: string, end: string) {
  return value >= start && value <= end
}

export function toLocalDateTimeInput(date: Date | string = new Date()) {
  const value = typeof date === "string" ? new Date(date) : date
  const hours = String(value.getHours()).padStart(2, "0")
  const minutes = String(value.getMinutes()).padStart(2, "0")
  return `${toLocalDateKey(value)}T${hours}:${minutes}`
}

export function startOfLocalDay(date: Date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysAgo(days: number, from: Date = new Date()) {
  const date = startOfLocalDay(from)
  date.setDate(date.getDate() - days)
  return date
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    parseLocalDateKey(value),
  )
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
