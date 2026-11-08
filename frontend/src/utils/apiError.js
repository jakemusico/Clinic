// Turns an axios error into a short, readable message for a toast.
// Never returns raw SQL / server internals, even if one slips through.

const TECHNICAL = /SQLSTATE|Integrity constraint|PDOException|QueryException|Stack trace|vendor[\\/]laravel|\.php\b|Connection:\s*mysql/i

export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  // No response at all: server down, offline, CORS, timeout.
  if (!err?.response) {
    return 'Cannot reach the server. Please check your connection and try again.'
  }

  const data = err.response.data

  // Validation errors: show the first field message.
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat().find(Boolean)
    if (first && !TECHNICAL.test(first)) return String(first)
  }

  const message = typeof data?.message === 'string' ? data.message : ''
  if (message && !TECHNICAL.test(message)) return message

  if (err.response.status === 413) return 'The file is too large. Please choose a smaller one.'
  return fallback
}

// For errors that did not come from the API (reading a picked file, ...): their own message,
// unless it looks technical.
export function getLocalErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const message = typeof err?.message === 'string' ? err.message : ''
  return message && !TECHNICAL.test(message) ? message : fallback
}

// Field-level errors from a 422 response as { field: 'message' }.
export function getFieldErrors(err) {
  const errors = err?.response?.data?.errors
  if (!errors || typeof errors !== 'object') return {}
  const out = {}
  Object.entries(errors).forEach(([field, msgs]) => {
    const msg = Array.isArray(msgs) ? msgs[0] : msgs
    if (msg && !TECHNICAL.test(String(msg))) out[field] = String(msg)
  })
  return out
}
