/**
 * Escape a value so it can be placed inside HTML text or a quoted attribute.
 *
 * The print window (PrintableRecord.jsx) and the report export (reportExport.js) build HTML
 * strings from patient and staff data and write them into a same-origin document. Every data
 * value that goes into those strings MUST pass through this function, otherwise a name such as
 * `<img src=x onerror=...>` would run as script in the nurse's or admin's session.
 *
 *   & < > " ' `   become entities.
 *   null / undefined become ''.
 *   anything else is converted with String() first, so numbers and dates are fine.
 *
 * Do NOT pass HTML you built yourself from already-escaped parts (for example the result of
 * another template function); that would be escaped twice.
 */
const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
}

export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"'`]/g, (ch) => ENTITIES[ch])
}
