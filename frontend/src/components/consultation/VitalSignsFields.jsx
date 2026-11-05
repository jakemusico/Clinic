import FieldLabel from './FieldLabel'
import { VITAL_SERVER_KEY as SERVER_KEY, calcBMI, getBMICategory } from '../../utils/consultation'
import { EMPTY } from '../../utils/emptyValue'

/**
 * Vital signs. All optional: a value is checked only when it is typed in. BMI is calculated.
 *
 * Props: values (the form), errors (form errors, client or server), onChange(key, value)
 */
export default function VitalSignsFields({ values, errors = {}, onChange }) {
  const bmi = calcBMI(values.weight, values.height)
  const err = (key) => errors[key] || errors[SERVER_KEY[key]]

  const field = (key, label, placeholder) => (
    <div className="form-group">
      <FieldLabel htmlFor={`vital-${key}`}>{label}</FieldLabel>
      <input
        id={`vital-${key}`}
        type="text"
        inputMode={key === 'bp' ? 'text' : 'decimal'}
        autoComplete="off"
        placeholder={placeholder}
        value={values[key] ?? ''}
        className={err(key) ? 'input-error' : ''}
        onChange={(e) => onChange(key, e.target.value)}
      />
      {err(key) && <span className="field-error">{err(key)}</span>}
    </div>
  )

  return (
    <div className="vitals-grid">
      {field('bp', 'Blood Pressure (mmHg)', 'e.g. 120/80')}
      {field('temperature', 'Temperature (°C)', 'e.g. 36.6')}
      {field('pulse_rate', 'Pulse Rate (bpm)', 'e.g. 75')}
      {field('weight', 'Weight (kg)', 'e.g. 62')}
      {field('height', 'Height (cm)', 'e.g. 168')}
      <div className="form-group">
        <FieldLabel htmlFor="vital-bmi">Body Mass Index (auto)</FieldLabel>
        <input
          id="vital-bmi"
          type="text"
          readOnly
          tabIndex={-1}
          value={bmi ? `${bmi} (${getBMICategory(bmi)})` : EMPTY}
          style={{
            background: 'var(--bg-crust)',
            fontWeight: 600,
            color: bmi ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'not-allowed',
          }}
        />
      </div>
    </div>
  )
}
