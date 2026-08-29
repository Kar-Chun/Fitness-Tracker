export const MAX_FOOD_IMAGE_BYTES = 6 * 1024 * 1024
export const SUPPORTED_FOOD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const
export type SupportedFoodImageType = typeof SUPPORTED_FOOD_IMAGE_TYPES[number]

export function getSupportedFoodImageType(file: Pick<File, "name" | "type">): SupportedFoodImageType | null {
  const type = file.type.toLowerCase()
  if (SUPPORTED_FOOD_IMAGE_TYPES.includes(type as SupportedFoodImageType)) return type as SupportedFoodImageType
  if (!type) {
    const extension = file.name.toLowerCase().split(".").pop()
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg"
    if (extension === "png") return "image/png"
    if (extension === "webp") return "image/webp"
    if (extension === "heic") return "image/heic"
    if (extension === "heif") return "image/heif"
  }
  return null
}

export function validateFoodImage(file: Pick<File, "name" | "type" | "size">) {
  const mimeType = getSupportedFoodImageType(file)
  if (!mimeType) return { mimeType: null, error: "Use a JPEG, PNG, WebP, HEIC, or HEIF photo." } as const
  if (file.size > MAX_FOOD_IMAGE_BYTES) return { mimeType: null, error: "This photo is too large. Choose a smaller photo or take another one." } as const
  if (file.size <= 0) return { mimeType: null, error: "The selected photo is empty. Choose another photo." } as const
  return { mimeType, error: "" } as const
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("The selected photo could not be read."))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string" || !result.includes(",")) return reject(new Error("The selected photo could not be read."))
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.readAsDataURL(file)
  })
}
