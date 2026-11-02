import { useEffect, useState } from 'react'

/**
 * Shows a person's profile photo, or their initial when they have none
 * (or the image fails to load).
 *
 * Props
 *   src                url of the photo (user.avatar_url)
 *   name               used for the initial and the alt text
 *   size               px. When given, the avatar draws its own circle (list/table rows).
 *                      When omitted, `className` is expected to size and style it (header, sidebar, profile hero).
 *   className          class for both the image and the fallback circle
 *   fallbackClassName  class for the fallback circle only (overrides className)
 *   fallbackText       replaces the automatic initial
 *   style              extra inline style
 */
export default function Avatar({
  src,
  name,
  size,
  className,
  fallbackClassName,
  fallbackText,
  style,
  alt,
}) {
  const [failed, setFailed] = useState(false)

  // A new photo URL gets a fresh chance to load.
  useEffect(() => { setFailed(false) }, [src])

  const sizeStyle = size ? { width: size, height: size } : {}

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt ?? name ?? 'Profile photo'}
        className={className}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{
          ...sizeStyle,
          objectFit: 'cover',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'block',
          ...style,
        }}
      />
    )
  }

  const initial = (fallbackText ?? (name || '').trim().charAt(0) ?? '').toString().toUpperCase() || '?'

  const circleStyle = size
    ? {
        ...sizeStyle,
        borderRadius: '50%',
        background: 'var(--border)',
        color: 'var(--text-sub)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(10, Math.round(size * 0.4))}px`,
        fontWeight: 600,
        flexShrink: 0,
        overflow: 'hidden',
      }
    : {}

  return (
    <div
      className={fallbackClassName ?? className}
      style={{ ...circleStyle, ...style }}
      role="img"
      aria-label={name || 'Profile'}
    >
      {initial}
    </div>
  )
}
