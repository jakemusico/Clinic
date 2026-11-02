import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { toast } from 'react-hot-toast'
import { getCroppedBlob } from '../utils/imageCrop'
import './PhotoCropModal.css'

/**
 * Reusable square-crop dialog with a circular preview, zoom slider and rotate button.
 * Used by every role's My Profile page (via useProfilePhoto).
 *
 * Props
 *   open       boolean
 *   imageSrc   object URL of the picked image
 *   saving     boolean  true while the parent is uploading (locks the dialog)
 *   onCancel   () => void
 *   onSave     (blob: Blob) => Promise<void>   called with the cropped 400x400 JPEG (< 500KB)
 */
export default function PhotoCropModal({ open, imageSrc, saving = false, onCancel, onSave }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pixels, setPixels] = useState(null)
  const [processing, setProcessing] = useState(false)
  const lockRef = useRef(false)          // blocks double clicks before React re-renders

  // Start fresh for every new image.
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setPixels(null)
      setProcessing(false)
      lockRef.current = false
    }
  }, [open, imageSrc])

  const busy = saving || processing

  const handleCancel = useCallback(() => {
    if (!lockRef.current && !busy) onCancel?.()
  }, [busy, onCancel])

  // Esc closes (unless a save is running).
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleCancel])

  // Lock page scroll behind the dialog.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const onCropComplete = useCallback((_area, areaPixels) => setPixels(areaPixels), [])

  const handleSave = async () => {
    if (lockRef.current || busy || !pixels) return
    lockRef.current = true
    setProcessing(true)
    try {
      const blob = await getCroppedBlob(imageSrc, pixels, rotation)
      await onSave?.(blob)
    } catch (err) {
      toast.error(err?.message || 'Could not process the photo. Please try another one.')
    } finally {
      lockRef.current = false
      setProcessing(false)
    }
  }

  if (!open || !imageSrc) return null

  return (
    <div
      className="modal-overlay photo-crop-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel() }}
    >
      <div className="modal-card photo-crop-card" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title">
        <div className="modal-header">
          <h2 id="photo-crop-title">Adjust Profile Photo</h2>
          <button type="button" className="modal-close" onClick={handleCancel} disabled={busy} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="photo-crop-body">
          <div className="photo-crop-area">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              minZoom={1}
              maxZoom={4}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="photo-crop-controls">
            <label className="photo-crop-zoom" htmlFor="photo-crop-zoom-range">
              <span className="photo-crop-zoom-label">Zoom</span>
              <input
                id="photo-crop-zoom-range"
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                disabled={busy}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
              />
            </label>

            <button
              type="button"
              className="btn-secondary photo-crop-rotate"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={busy}
              aria-label="Rotate photo 90 degrees"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
              </svg>
              Rotate
            </button>
          </div>

          <p className="photo-crop-hint">Drag to reposition. Pinch or use the slider to zoom.</p>
        </div>

        <div className="photo-crop-footer">
          <button type="button" className="btn-secondary" onClick={handleCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={busy || !pixels}>
            {busy ? (
              <>
                <span className="loader-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
                <span>Saving…</span>
              </>
            ) : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
