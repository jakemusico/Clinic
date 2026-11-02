// Client-side image helpers for the profile photo flow.
// Nothing here produces base64: results are Blobs that get uploaded as files.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PICK_BYTES = 15 * 1024 * 1024   // generous: the result is compressed anyway
export const OUTPUT_SIZE = 400                    // px, square
export const MAX_OUTPUT_BYTES = 500 * 1024        // 500 KB
const MAX_SOURCE_SIDE = 2048                      // keeps canvases small enough for mobile browsers

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('This file could not be read as an image.'))
    img.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image.'))),
      type,
      quality,
    )
  })
}

/**
 * Validates the picked file. Returns an error message, or null when it is fine.
 */
export function validatePickedFile(file) {
  if (!file) return 'Please choose a photo.'
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG or WEBP image.'
  if (file.size > MAX_PICK_BYTES) return 'That photo is too large. Please choose one under 15MB.'
  return null
}

/**
 * Returns an object URL to show in the cropper. Very large photos (e.g. 12MP phone shots)
 * are scaled down first so cropping works on mobile browsers with small canvas limits.
 * The caller must URL.revokeObjectURL() the result when done.
 */
export async function prepareImageForCrop(file) {
  const originalUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(originalUrl)
    const longest = Math.max(img.naturalWidth, img.naturalHeight)
    if (longest <= MAX_SOURCE_SIDE) return originalUrl

    const scale = MAX_SOURCE_SIDE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const keepPng = file.type === 'image/png'
    const blob = await canvasToBlob(canvas, keepPng ? 'image/png' : 'image/jpeg', 0.92)
    URL.revokeObjectURL(originalUrl)
    return URL.createObjectURL(blob)
  } catch (err) {
    URL.revokeObjectURL(originalUrl)
    throw err
  }
}

/**
 * Applies rotation + crop, resizes to OUTPUT_SIZE x OUTPUT_SIZE and compresses to a JPEG
 * under MAX_OUTPUT_BYTES.
 *
 * @param {string} imageSrc    object URL of the (prepared) image
 * @param {{x:number,y:number,width:number,height:number}} pixelCrop  from react-easy-crop (natural-pixel units)
 * @param {number} rotation    degrees, multiples of 90 from the Rotate button
 * @returns {Promise<Blob>}
 */
export async function getCroppedBlob(imageSrc, pixelCrop, rotation = 0) {
  const image = await loadImage(imageSrc)
  const rad = (rotation * Math.PI) / 180

  // Bounding box of the rotated image (react-easy-crop reports the crop in this space).
  const bboxW = Math.abs(Math.cos(rad) * image.naturalWidth) + Math.abs(Math.sin(rad) * image.naturalHeight)
  const bboxH = Math.abs(Math.sin(rad) * image.naturalWidth) + Math.abs(Math.cos(rad) * image.naturalHeight)

  const rotated = document.createElement('canvas')
  rotated.width = Math.round(bboxW)
  rotated.height = Math.round(bboxH)
  const rctx = rotated.getContext('2d')
  rctx.fillStyle = '#ffffff'            // transparent PNGs become white instead of black in JPEG
  rctx.fillRect(0, 0, rotated.width, rotated.height)
  rctx.translate(rotated.width / 2, rotated.height / 2)
  rctx.rotate(rad)
  rctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

  const out = document.createElement('canvas')
  out.width = OUTPUT_SIZE
  out.height = OUTPUT_SIZE
  const octx = out.getContext('2d')
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(
    rotated,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
  )

  let quality = 0.92
  let blob = await canvasToBlob(out, 'image/jpeg', quality)
  while (blob.size > MAX_OUTPUT_BYTES && quality > 0.4) {
    quality = Math.max(0.4, quality - 0.08)
    blob = await canvasToBlob(out, 'image/jpeg', quality)
  }
  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('The photo is still too large after compression. Please choose a different one.')
  }
  return blob
}
