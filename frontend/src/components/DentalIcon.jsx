/**
 * The ONE tooth icon used for everything dental / dentist
 * (sidebar, tabs, chatbot, dashboards, appointment types, reports).
 *
 * Outline style, drawn with `currentColor`, so it takes whatever color the
 * icon next to it uses (blue when active, gray when inactive).
 * Defaults match the other sidebar icons (18px, 1.9 stroke); pass `size` /
 * `strokeWidth` to match the icons beside it in other places.
 *
 * To change the tooth shape everywhere, edit DENTAL_ICON_PATH below.
 */
export const DENTAL_ICON_PATH =
  'M12 5.5C10.9 4.9 9.4 4 8 4 5.9 4 4 5.2 4 9c0 4.9 1.1 8.4 2.7 10.5.6.8 2 .5 2.6-.2.4-.5.8-1.4 1.3-2.8.3-.8.9-1.5 1.5-1.5s1.2.7 1.5 1.5c.4 1.4.8 2.3 1.2 2.8.6.7 2 1 2.5.2C18.9 17.4 20 13.9 20 9c0-3.8-1.9-5-4-5-1.4 0-2.9.9-4 1.5z'

export default function DentalIcon({ size = 18, strokeWidth = 1.9, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={DENTAL_ICON_PATH} />
    </svg>
  )
}
