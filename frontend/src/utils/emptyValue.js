// Shared placeholders for missing values. Import these instead of typing the characters,
// so a table or modal can never show a broken dash again.
//
// The em dash is written as an escape on purpose: this file stays plain ASCII, so an editor
// or script that re-saves it with the wrong encoding cannot damage it.

/** Shown in a table cell or detail row when a value is missing. */
export const EMPTY = '\u2014'

/** Shown in the Service column / field when a consultation has no service recorded. */
export const NO_SERVICE = 'Not specified'

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** value, or `fallback` (the em dash by default) when it is null, undefined or blank. */
export const orEmpty = (v, fallback = EMPTY) => (isBlank(v) ? fallback : v)

/**
 * Service of a consultation record (medical or dental). Every page reads the same field,
 * `service_name`, so the logs, dashboards, details and print view always agree. '' when none
 * was saved (use serviceLabel for display). Old rows without one are filled in by
 * `php artisan consultations:backfill-service`.
 */
export const serviceNameOf = (record) => (record?.service_name || '').toString().trim()

/** Text for the Service column / field; never the bare dash. */
export const serviceLabel = (record) => serviceNameOf(record) || NO_SERVICE
