// Helpers shared by the Nurse (medical) and Dentist (dental) consultation forms.
import { EMPTY } from './emptyValue'
import { formatDate, toDateKey } from './dateUtils'

// Today in the clinic's time zone; one shared implementation (see dateUtils.js)
export { todayISO } from './dateUtils'

/** The two kinds of care. A service, an appointment and a consultation each belong to one. */
export const CARE = {
  medical: {
    key: 'medical',
    staffRole: 'clinic_staff',
    serviceLabel: 'Clinic Service',
    title: 'Medical Consultation',
    lastVisitKey: 'last_medical_visit',
    lastVisitLabel: 'Last medical visit',
  },
  dental: {
    key: 'dental',
    staffRole: 'dentist',
    serviceLabel: 'Dental Service',
    title: 'Dental Consultation',
    lastVisitKey: 'last_dental_visit',
    lastVisitLabel: 'Last dental visit',
  },
}

/** The API reports vital-sign problems as vitals.<name>; the form fields use shorter names. */
export const VITAL_SERVER_KEY = {
  bp: 'vitals.blood_pressure',
  temperature: 'vitals.temperature',
  pulse_rate: 'vitals.pulse_rate',
  weight: 'vitals.weight',
  height: 'vitals.height',
}

export const COMPLAINT_CATEGORIES = {
  medical: [
    'Fever/Flu', 'Headache', 'Cough/Colds', 'Stomach Pain', 'Injury/Wound', 'Allergy',
    'Dizziness/BP', 'Toothache', 'Dental Cleaning', 'Extraction', 'Other',
  ],
  dental: [
    'Toothache', 'Dental Cleaning', 'Extraction', 'Tooth Filling', 'Cavity/Decay',
    'Gum Problem', 'Fever/Flu', 'Headache', 'Other',
  ],
}

const ROLE_LABELS = {
  student: 'Student',
  faculty_staff: 'Faculty / Staff',
  clinic_staff: 'Nurse',
  dentist: 'Dentist',
  admin: 'Administrator',
}

/** 'faculty_staff' -> 'Faculty / Staff' */
export const roleLabel = (role) => ROLE_LABELS[role] || (role ? String(role).replace(/_/g, ' ') : EMPTY)

/** Grade level and section for a student, the department for faculty / staff. */
export const patientAcademicInfo = (p) => {
  if (!p) return ''
  if (p.role === 'student') return [p.grade_level, p.section].filter(Boolean).join(' · ')
  return p.department || ''
}

/** '2026-10-12' -> 'Oct 12, 2026' ('' when there is no date) */
export const formatShortDate = (value) => (toDateKey(value) ? formatDate(value) : '')

// ── Vital signs ─────────────────────────────────────────────────────────────

const firstNumber = (v) => {
  const m = String(v ?? '').match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : NaN
}

export const calcBMI = (weight, height) => {
  const w = firstNumber(weight)
  const hCm = firstNumber(height)
  if (!(w > 0) || !(hCm > 0)) return null
  const hM = hCm / 100
  return (w / (hM * hM)).toFixed(1)
}

export const getBMICategory = (bmi) => {
  const v = parseFloat(bmi)
  if (!v) return ''
  if (v < 18.5) return 'Underweight'
  if (v < 25) return 'Normal weight'
  if (v < 30) return 'Overweight'
  return 'Obese'
}

const filled = (v) => v !== null && v !== undefined && String(v).trim() !== ''

/**
 * Vital signs are optional: a field is checked only when something is typed in it.
 * Returns { bp?, temperature?, pulse_rate?, weight?, height? } with a message per bad field.
 */
export const validateVitals = ({ bp, temperature, pulse_rate, weight, height }) => {
  const errors = {}

  if (filled(bp)) {
    const m = String(bp).match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})/)
    if (!m) errors.bp = 'Use the format 120/80.'
    else {
      const [sys, dia] = [Number(m[1]), Number(m[2])]
      if (sys < 50 || sys > 260 || dia < 30 || dia > 160 || sys <= dia) errors.bp = 'Blood pressure looks wrong (e.g. 120/80).'
    }
  }

  const range = (key, v, min, max, msg) => {
    if (!filled(v)) return
    const n = firstNumber(v)
    if (Number.isNaN(n) || n < min || n > max) errors[key] = msg
  }
  range('temperature', temperature, 30, 45, 'Enter 30 to 45 °C.')
  range('pulse_rate', pulse_rate, 30, 250, 'Enter 30 to 250 bpm.')
  range('weight', weight, 1, 500, 'Enter 1 to 500 kg.')
  range('height', height, 30, 250, 'Enter 30 to 250 cm.')

  return errors
}

/** The vitals object sent to the API: empty fields left out, units removed, BMI calculated. */
export const buildVitalsPayload = ({ bp, temperature, pulse_rate, weight, height }) => {
  const out = {}
  if (filled(bp)) {
    const m = String(bp).match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})/)
    out.blood_pressure = m ? `${m[1]}/${m[2]}` : String(bp).trim()
  }
  const num = (key, v) => { if (filled(v) && !Number.isNaN(firstNumber(v))) out[key] = String(firstNumber(v)) }
  num('temperature', temperature)
  num('pulse_rate', pulse_rate)
  num('weight', weight)
  num('height', height)
  const bmi = calcBMI(weight, height)
  if (bmi) out.bmi = bmi
  return Object.keys(out).length ? out : null
}

/** True when any vital sign has been typed in. */
export const hasVitals = (f) => ['bp', 'temperature', 'pulse_rate', 'weight', 'height'].some((k) => filled(f?.[k]))

// ── Allergies ───────────────────────────────────────────────────────────────

const IGNORED_WORDS = new Set([
  'allergy', 'allergies', 'allergic', 'known', 'none', 'with', 'from', 'tablet', 'tablets', 'capsule', 'capsules',
  'syrup', 'drops', 'cream', 'ointment', 'solution', 'injection', 'and', 'the', 'for',
])
const NO_ALLERGY = /^\s*(none|n\/?a|no|nil|no known( drug)? allergies?|nka|nkda|-+|\u2014)\s*$/i

const words = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !IGNORED_WORDS.has(w))

/**
 * Which of the added medicines/supplies match what the patient is allergic to?
 * Only meaningful when the patient profile has allergy data; returns [] otherwise.
 * @param {string} allergies  free text from the patient profile, e.g. "Peanuts, Penicillin"
 * @param {{id, name}[]} items  the medicines/supplies added to the consultation
 * @returns {{ item, allergy }[]}
 */
export const findAllergyMatches = (allergies, items) => {
  if (!allergies || NO_ALLERGY.test(allergies) || !items?.length) return []
  const entries = String(allergies).split(/[,;\n/]+/).map((s) => s.trim()).filter(Boolean)
    .filter((s) => !NO_ALLERGY.test(s))
  const out = []
  for (const item of items) {
    const itemWords = words(item.name)
    for (const entry of entries) {
      const entryWords = words(entry)
      const hit = entryWords.some((a) => itemWords.some((w) => w === a || (Math.min(a.length, w.length) >= 5 && (w.startsWith(a) || a.startsWith(w)))))
      if (hit) { out.push({ item, allergy: entry }); break }
    }
  }
  return out
}
