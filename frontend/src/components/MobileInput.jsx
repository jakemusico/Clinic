/**
 * MobileInput — the ONE Philippine mobile number field of the app (and the one place that
 * defines what a valid number is). Mirrors App\Support\PhoneNumber on the server.
 *
 * Stored / shown format: 09XXXXXXXXX (11 digits).
 * Accepted as input:     09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX, with spaces or dashes.
 *   - while typing, everything except digits (and a leading +) is dropped
 *   - pasting 0917-123-4567 or +63 917 123 4567 replaces the field with 09171234567
 *   - as soon as the text is a complete valid number it is shown as 09XXXXXXXXX
 *
 * The parent keeps the value in its own state, exactly as before: onChange receives an
 * event-like object, { target: { name, id, value } }, so both `handleChange(e)` and
 * `e => handleChange('field', e.target.value)` keep working.
 *
 * Props:
 *   id, name, value, onChange
 *   label           {string}
 *   required        {boolean}  adds " *" to the label
 *   error           {string}   server-side or form-level message (wins over the live check)
 *   disabled        {boolean}
 *   groupClassName  {string}   wrapper class (default 'form-group'; profile pages use 'profile-field-group')
 *   labelClassName  {string}   class for the <label> (the admin form uses 'form-label')
 *   className       {string}   extra class(es) for the <input> (e.g. 'profile-input')
 *   placeholder     {string}
 *   showSuccess     {boolean}  show the green "valid" line (default true)
 */

export const MOBILE_FORMAT_HINT = '09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX'
export const MOBILE_ERROR = `Enter a valid Philippine mobile number: ${MOBILE_FORMAT_HINT}.`

/** Canonical 09XXXXXXXXX for a valid number in any accepted format, otherwise null. */
export function normalizeMobile(value) {
  if (value === null || value === undefined) return null
  const compact = String(value).trim().replace(/[\s\-.()]+/g, '')
  const intl = compact.match(/^\+?63(9\d{9})$/)
  if (intl) return `0${intl[1]}`
  return /^09\d{9}$/.test(compact) ? compact : null
}

/**
 * What the field keeps while the user types or pastes: digits and a leading "+" only,
 * cut to the longest a number in that format can be.
 */
export function sanitizeMobile(text) {
  const raw = String(text ?? '')
  const plus = raw.trim().startsWith('+')
  const digits = raw.replace(/\D/g, '')
  const max = plus || digits.startsWith('63') ? 12 : 11
  return (plus ? '+' : '') + digits.slice(0, max)
}

/** The value as the field shows it: a valid number in canonical form, anything else as typed. */
export function formatMobile(value) {
  if (value === null || value === undefined || value === '') return ''
  return normalizeMobile(value) ?? String(value)
}

/** null when the value is empty or a valid number, otherwise the message to show. */
export function validateMobile(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null                              // empty is ok unless the form requires it
  if (normalizeMobile(text)) return null

  const digits = text.replace(/\D/g, '')
  if (digits.startsWith('09')) return `Must be 11 digits (${digits.length} entered).`
  if (digits.startsWith('63')) return 'A +63 number needs 10 digits after +63 (for example +639171234567).'
  return MOBILE_ERROR
}

export function isMobileValid(value) {
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
  disabled = false,
  groupClassName = 'form-group',
  labelClassName = '',
  className = '',
  placeholder = '09171234567',
  showSuccess = true,
}) {
  const shown = formatMobile(value)
  const validationError = shown ? validateMobile(shown) : null
  const displayError = error || validationError
  const isValid = Boolean(shown) && !displayError && normalizeMobile(shown) !== null

  const emit = (next) => {
    if (onChange) onChange({ target: { name, id, value: next, type: 'tel' } })
  }

  const handleChange = (e) => {
    const cleaned = sanitizeMobile(e.target.value)
    emit(normalizeMobile(cleaned) ?? cleaned)
  }

  // A pasted number (0917-123-4567, +63 917 123 4567 ...) replaces the whole field
  const handlePaste = (e) => {
    const pasted = e.clipboardData?.getData('text')
    const number = normalizeMobile(pasted)
    if (number) {
      e.preventDefault()
      emit(number)
    }
  }

  return (
    <div className={groupClassName}>
      {label && <label htmlFor={id} className={labelClassName || undefined}>{label}{required && ' *'}</label>}
      <input
        id={id}
        type="tel"
        name={name}
        value={shown}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        inputMode="tel"
        autoComplete="tel"
        className={`${displayError ? 'input-error' : ''} ${className}`.trim()}
      />
      {displayError ? (
        <span className="field-error">{displayError}</span>
      ) : isValid && showSuccess ? (
        <span className="field-success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Valid Philippine mobile number
        </span>
      ) : null}
    </div>
  )
}
