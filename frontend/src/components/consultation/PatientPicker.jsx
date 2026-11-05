import { useMemo } from 'react'
import Dropdown from '../Dropdown'
import FieldLabel from './FieldLabel'
import { CARE, formatShortDate, patientAcademicInfo, roleLabel } from '../../utils/consultation'
import { EMPTY } from '../../utils/emptyValue'

const initials = (name) =>
  String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'

/**
 * Compact card for the selected patient: name, ID, role, grade / section or department, last visit.
 */
export function PatientCard({ patient, careType = 'medical' }) {
  if (!patient) return null
  const care = CARE[careType] || CARE.medical
  const academic = patientAcademicInfo(patient)
  const knowsLastVisit = care.lastVisitKey in patient   // a record's embedded patient does not carry it
  const lastVisit = formatShortDate(patient[care.lastVisitKey])

  return (
    <div className="patient-card">
      <div className="patient-card-avatar" aria-hidden="true">{initials(patient.name)}</div>
      <div className="patient-card-main">
        <div className="patient-card-name">
          <span>{patient.name}</span>
          <span className="patient-card-role">{roleLabel(patient.role)}</span>
        </div>
        <div className="patient-card-meta">
          <span>ID: {patient.student_id || EMPTY}</span>
          {academic && <span>{academic}</span>}
          {knowsLastVisit && <span>{care.lastVisitLabel}: {lastVisit || 'none yet'}</span>}
        </div>
      </div>
    </div>
  )
}

/**
 * Searchable patient selector (type a name or ID) plus the compact patient card.
 *
 * Props
 *   patients   [{ id, name, student_id, role, grade_level, section, department, last_*_visit }]
 *   value      selected patient id
 *   onChange   (patientId) => void
 *   locked     show the patient read-only (editing an existing record)
 *   fallback   patient details to show when the list does not contain `value` (e.g. from the record being edited)
 */
export default function PatientPicker({
  patients, loading = false, value, onChange, locked = false, careType = 'medical', error, fallback,
}) {
  const options = useMemo(() => patients.map((p) => ({
    value: String(p.id),
    label: p.name,
    badge: `${p.student_id || 'No ID'} · ${roleLabel(p.role)}`,
  })), [patients])

  const selected = patients.find((p) => String(p.id) === String(value)) || (value ? fallback : null)

  return (
    <>
      <div className="form-group">
        <FieldLabel required>Patient</FieldLabel>
        {locked ? (
          <input disabled value={selected?.name || ''} aria-label="Patient" />
        ) : (
          <Dropdown
            searchable
            ariaLabel="Patient"
            value={String(value ?? '')}
            onChange={onChange}
            options={options}
            loading={loading}
            invalid={Boolean(error)}
            placeholder="Search by name or ID"
            searchPlaceholder="Search by name or ID…"
            emptyMessage="No patient matches your search"
            noOptionsMessage="No patients available"
          />
        )}
        {error && <span className="field-error">{error}</span>}
      </div>
      <PatientCard patient={selected} careType={careType} />
    </>
  )
}
