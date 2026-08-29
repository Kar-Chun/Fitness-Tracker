export const FOOD_PARSER_MODEL = "gemini-3.5-flash-lite"
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_IMAGE_NOTE_LENGTH = 300
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024
export const USDA_SEARCH_RESULT_LIMIT = 20

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const

export type SupportedImageMimeType = typeof SUPPORTED_IMAGE_MIME_TYPES[number]
