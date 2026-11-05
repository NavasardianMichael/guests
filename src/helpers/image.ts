/**
 * A photographed list, ready to send for reading: a JPEG data URL whose long side is at most
 * `edge` pixels. A phone photo is several MB; handwriting stays legible at 2000px, and the
 * request stays well under the API's body limit (`server/src/routes/ai.ts`).
 */
export const fileToUploadDataUrl = async (file: Blob, edge = 2000, quality = 0.85): Promise<string> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const ratio = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio)
    canvas.height = Math.round(bitmap.height * ratio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context unavailable')
    // A transparent PNG would turn black in a JPEG.
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}

/** Hands a downloaded blob to the browser as a file. */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers start the download asynchronously; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
