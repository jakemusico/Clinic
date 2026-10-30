/**
 * MobileInput — Philippine mobile number input with live validation
 *
 * Props:
 *   id        {string}
 *   name      {string}
 *   value     {string}
 *   onChange  {fn(e)} — standard input onChange
 *   error     {string|null} — server-side error to show
 *   label     {string}
 *   required  {boolean}
 *   className {string}
 *   placeholder {string}
 */

export function validateMobile(value) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null                         // empty is ok unless required
  if (!digits.startsWith('09')) return 'Mobile number must start with 09.'
  if (digits.length !== 11) return `Must be exactly 11 digits (${digits.length} entered).`
  return null // valid
}

export function isMobileValid(value) {
  if (!value || value.trim() === '') return true   // empty fields are allowed to be optional
  return validateMobile(value) === null
}

export default function MobileInput({
  id,
  name,
  value,
  onChange,
  error,
  label,
  required = false,
  className = '',
  placeholder = '09xx-xxx-xxxx',
}) {
  const validationError = value ? validateMobile(value) : null
  const digits = value ? value.replace(/\D/g, '') : ''
  const isValid = value && digits.length === 11 && digits.startsWith('09')

  const displayError = error || validationError

  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}{required && ' *'}</label>}
      <input
        id={id}
        type="tel"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        inputMode="numeric"
        maxLength={11}
        className={`${displayError ? 'input-error' : ''} ${className}`}
      />
      {displayError ? (
        <span className="field-error">{displayError}</span>
      ) : isValid ? (
        <span className="field-success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Valid 11-digit Philippine mobile number
        </span>
      ) : null}
    </div>
  )
}
