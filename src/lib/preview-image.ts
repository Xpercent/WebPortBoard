const MAX_WIDTH = 720

/** 把本地图片压成小尺寸 WebP data URL，避免预览图撑爆 localStorage */
export async function fileToPreviewDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL("image/webp", 0.82)
}
