export function normalizeFoodName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}
