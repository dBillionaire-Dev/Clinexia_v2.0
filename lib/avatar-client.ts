// Prepares a chosen picture for upload: checks the 2 MB limit, crops it to a square and shrinks it to a small JPEG in the browser,
// so uploads are fast and a photo's hidden location data is never sent. The server checks everything again.
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const SIDE = 384

export type PreparedPhoto = { ok: true; image: string } | { ok: false; error: string }

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")) }
    img.src = url
  })
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "The photo must be 2 MB or smaller." }
  if (!file.type.startsWith("image/")) return { ok: false, error: "Choose a picture (JPEG or PNG)." }
  try {
    const img = await load(file)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    if (!side) return { ok: false, error: "That photo could not be read. Try a different one." }
    const canvas = document.createElement("canvas")
    canvas.width = SIDE
    canvas.height = SIDE
    const ctx = canvas.getContext("2d")
    if (!ctx) return { ok: false, error: "That photo could not be read. Try a different one." }
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, SIDE, SIDE)
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIDE, SIDE)
    return { ok: true, image: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "" }
  } catch {
    return { ok: false, error: "That photo could not be read. Use a JPEG or PNG picture." }
  }
}
