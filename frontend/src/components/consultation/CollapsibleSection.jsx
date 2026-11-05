import { useId } from 'react'

/**
 * A numbered section of the consultation form that can be folded away.
 *
 * The content stays mounted while folded (it is only hidden), so anything inside keeps its state
 * and effects, for example the medicine picker that loads the items already dispensed on an edit.
 *
 * Props
 *   number       section number shown before the title (keep them sequential)
 *   title        section title
 *   optional     adds the "(Optional)" tag
 *   open         whether the content is shown
 *   onToggle     called when the header is clicked; leave out for a section that is always open
 *   badge        short text on the right of the header, e.g. "2 items"
 *   badgeTone    'warn' makes the badge amber (e.g. an allergy warning)
 */
export default function CollapsibleSection({
  number, title, optional = false, open = true, onToggle, badge, badgeTone, children,
}) {
  const bodyId = useId()
  const collapsible = typeof onToggle === 'function'

  const heading = (
    <>
      <span className="consult-section-title">{number}. {title}</span>
      {optional && <span className="consult-section-tag">(Optional)</span>}
      {badge && <span className={`consult-section-badge${badgeTone ? ` is-${badgeTone}` : ''}`}>{badge}</span>}
      {collapsible && (
        <svg className="consult-section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </>
  )

  return (
    <section className={`consult-section${open ? ' is-open' : ''}`}>
      {collapsible ? (
        <button type="button" className="consult-section-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          {heading}
        </button>
      ) : (
        <div className="consult-section-head consult-section-head--static">{heading}</div>
      )}
      <div id={bodyId} className="consult-section-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
