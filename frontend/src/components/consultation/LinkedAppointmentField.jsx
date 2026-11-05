import { useMemo } from 'react'
import Dropdown from '../Dropdown'
import FieldLabel from './FieldLabel'
import { formatAppointmentDate } from '../../utils/dateUtils'

/**
 * Optional "Link to Appointment" dropdown. Picking one hands the whole appointment to `onSelect`
 * (null when "No appointment" is chosen). `appointments` comes from useLinkableAppointments.
 */
export default function LinkedAppointmentField({ appointments, loading, value, onSelect }) {
  const options = useMemo(() => {
    const list = [
      { value: '', label: 'No appointment (walk-in)' },
      ...appointments.map((a) => ({
        value: String(a.id),
        label: `#${a.id} · ${a.service?.name || 'Appointment'}`,
        badge: formatAppointmentDate(a),
      })),
    ]
    // an appointment passed in from the Appointments page may no longer be "open"; keep it visible
    if (value && !list.some((o) => o.value === String(value))) list.push({ value: String(value), label: `#${value} · linked appointment` })
    return list
  }, [appointments, value])

  return (
    <div className="form-group">
      <FieldLabel optional>Link to Appointment</FieldLabel>
      <Dropdown
        ariaLabel="Link to appointment"
        value={String(value ?? '')}
        onChange={(v) => onSelect(v ? appointments.find((a) => String(a.id) === v) || { id: v } : null)}
        options={options}
        loading={loading}
        placeholder="No appointment (walk-in)"
      />
      <span className="form-hint">Completing the consultation marks the appointment as Completed.</span>
    </div>
  )
}
