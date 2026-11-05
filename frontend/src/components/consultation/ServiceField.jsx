import { useMemo } from 'react'
import Dropdown from '../Dropdown'
import FieldLabel from './FieldLabel'
import { CARE } from '../../utils/consultation'

/**
 * The Clinic Service / Dental Service field: required, searchable, shows the service name only
 * (no duration), never pre-filled. When the consultation is linked to an appointment the service
 * comes from the appointment and the field is locked.
 *
 * `services` comes from useCareServices(careType), which the API has already filtered by care type.
 */
export default function ServiceField({ careType, services, loading, value, onChange, locked = false, error }) {
  const care = CARE[careType] || CARE.medical

  const options = useMemo(() => {
    const list = services.map((s) => ({ value: s.name, label: s.name }))
    // a locked / saved value that is not in the list (e.g. taken from an appointment) must still be shown
    if (value && !list.some((o) => o.value === value)) list.push({ value, label: value })
    return list
  }, [services, value])

  return (
    <div className="form-group">
      <FieldLabel required>{care.serviceLabel}</FieldLabel>
      <Dropdown
        searchable
        ariaLabel={care.serviceLabel}
        value={value || ''}
        onChange={onChange}
        options={options}
        loading={loading}
        disabled={locked}
        invalid={Boolean(error)}
        placeholder={`Select ${care.serviceLabel.toLowerCase()}`}
        searchPlaceholder="Search services…"
        emptyMessage="No service matches your search"
        noOptionsMessage={`No active ${care.key} services available`}
      />
      {locked && <span className="form-hint">Taken from the linked appointment.</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
