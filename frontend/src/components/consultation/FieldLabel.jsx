/**
 * Label for a consultation form field. Required fields get a red *, everything else says "(Optional)".
 */
export default function FieldLabel({ children, required = false, optional = false, htmlFor }) {
  return (
    <label htmlFor={htmlFor}>
      {children}
      {required && <span className="req-mark" aria-hidden="true"> *</span>}
      {optional && <span className="optional-tag"> (Optional)</span>}
    </label>
  )
}
