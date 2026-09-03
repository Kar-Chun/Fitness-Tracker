export function requireData<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error(fallback)
  return data
}
