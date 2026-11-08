import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import ConfirmModal from '../components/ConfirmModal'
import { prepareImageForCrop, validatePickedFile } from '../utils/imageCrop'
import { getApiErrorMessage, getLocalErrorMessage } from '../utils/apiError'

// The cropper (react-easy-crop) is only needed after a photo is picked: load it on demand.
const PhotoCropModal = lazy(() => import('../components/PhotoCropModal'))

/**
 * Everything a My Profile page needs for photo changes, for every role:
 * file picker -> PhotoCropModal -> multipart upload -> shared auth user updated
 * (so header, sidebar and profile show the new photo immediately).
 *
 * Usage
 *   const { pickPhoto, requestRemove, busy, photoUi } = useProfilePhoto()
 *   ...
 *   <button onClick={pickPhoto}>Upload Photo</button>
 *   {photoUi}        // render once, anywhere in the page
 */
export default function useProfilePhoto() {
  const { updateUser } = useAuth()
  const inputRef = useRef(null)
  const busyRef = useRef(false)
  const cropUrlRef = useRef(null)

  const [cropSrc, setCropSrc] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const setBusyBoth = (value) => { busyRef.current = value; setBusy(value) }

  const releaseCropUrl = useCallback(() => {
    if (cropUrlRef.current) {
      URL.revokeObjectURL(cropUrlRef.current)
      cropUrlRef.current = null
    }
    setCropSrc(null)
  }, [])

  // Free the object URL if the page unmounts mid-crop.
  useEffect(() => () => {
    if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current)
  }, [])

  const pickPhoto = useCallback(() => {
    if (!busyRef.current) inputRef.current?.click()
  }, [])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''                      // lets the same file be picked again later
    if (!file) return

    const problem = validatePickedFile(file)
    if (problem) { toast.error(problem); return }

    try {
      const url = await prepareImageForCrop(file)
      cropUrlRef.current = url
      setCropSrc(url)
    } catch (err) {
      toast.error(getLocalErrorMessage(err, 'This file could not be read as an image.'))
    }
  }

  const handleSave = async (blob) => {
    if (busyRef.current) return
    setBusyBoth(true)
    try {
      const form = new FormData()
      form.append('photo', blob, 'profile.jpg')
      const res = await authApi.uploadPhoto(form)
      if (res.data?.user) updateUser(res.data.user)
      toast.success('Profile photo updated.')
      releaseCropUrl()
    } catch (err) {
      // Dialog stays open so the user can retry.
      toast.error(getApiErrorMessage(err, 'Could not upload your photo. Please try again.'))
    } finally {
      setBusyBoth(false)
    }
  }

  const handleRemove = async () => {
    if (busyRef.current) return
    setBusyBoth(true)
    try {
      const res = await authApi.removePhoto()
      if (res.data?.user) updateUser(res.data.user)
      toast.success('Profile photo removed.')
      setConfirmRemove(false)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not remove your photo. Please try again.'))
    } finally {
      setBusyBoth(false)
    }
  }

  const photoUi = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {cropSrc && (
        <Suspense fallback={null}>
          <PhotoCropModal
            open
            imageSrc={cropSrc}
            saving={busy}
            onCancel={releaseCropUrl}
            onSave={handleSave}
          />
        </Suspense>
      )}
      <ConfirmModal
        open={confirmRemove}
        title="Remove profile photo?"
        message="Your photo will be deleted and your initial will be shown instead."
        confirmLabel="Remove Photo"
        loading={busy}
        onConfirm={handleRemove}
        onCancel={() => { if (!busyRef.current) setConfirmRemove(false) }}
      />
    </>
  )

  return {
    pickPhoto,
    requestRemove: () => { if (!busyRef.current) setConfirmRemove(true) },
    busy,
    photoUi,
  }
}
