import { MAX_IMAGE_BYTES, MAX_IMAGE_NOTE_LENGTH, SUPPORTED_IMAGE_MIME_TYPES, type SupportedImageMimeType } from "./config.ts"
import { FoodAnalysisError } from "./errors.ts"

export interface ValidatedImageRequest { imageBase64: string; mimeType: SupportedImageMimeType; note: string }
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4

export function base64ByteLength(value: string) {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0
  return value.length / 4 * 3 - padding
}

export function validateImageMetadata(mimeType: unknown, bytes: number) {
  if (typeof mimeType !== "string" || !SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType)) {
    throw new FoodAnalysisError("unsupported_image_type", "Use a JPEG, PNG, WebP, HEIC, or HEIF photo.", 400)
  }
  if (bytes > MAX_IMAGE_BYTES) throw new FoodAnalysisError("image_too_large", "This photo is too large. Choose a smaller photo or take another one.", 413)
  if (bytes <= 0) throw new FoodAnalysisError("invalid_image", "The selected photo is empty. Choose another photo.", 400)
  return mimeType as SupportedImageMimeType
}

export function validateImageRequest(value: unknown): ValidatedImageRequest {
  if (!value || typeof value !== "object") throw new FoodAnalysisError("invalid_request", "Choose a valid meal photo.", 400)
  const body = value as { imageBase64?: unknown; mimeType?: unknown; note?: unknown }
  if (typeof body.imageBase64 !== "string") throw new FoodAnalysisError("invalid_image", "The selected photo could not be read.", 400)
  if (body.imageBase64.length > MAX_BASE64_LENGTH) throw new FoodAnalysisError("image_too_large", "This photo is too large. Choose a smaller photo or take another one.", 413)
  const bytes = base64ByteLength(body.imageBase64)
  if (bytes === null) throw new FoodAnalysisError("invalid_image", "The selected photo could not be read.", 400)
  const mimeType = validateImageMetadata(body.mimeType, bytes)
  if (body.note !== undefined && typeof body.note !== "string") throw new FoodAnalysisError("invalid_note", "The meal note must be text.", 400)
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (note.length > MAX_IMAGE_NOTE_LENGTH) throw new FoodAnalysisError("note_too_long", `Keep the meal note under ${MAX_IMAGE_NOTE_LENGTH} characters.`, 400)
  return { imageBase64: body.imageBase64, mimeType, note }
}
