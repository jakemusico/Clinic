import React from 'react'
import { properCase } from '../utils/textCase'

/**
 * Shared NameFields Component
 * Renders First Name, Middle Name, Last Name, and Suffix
 * in the standard order, labels, and layout matching the Registration page.
 */
export default function NameFields({
  values = {},
  onChange,
  errors = {},
  idPrefix = 'name',
  inputClassName = '',
  groupClassName = 'form-group',
  rowClassName = 'form-row',
  isProfile = false,
  disabled = false,
}) {
  const handleChange = (field, e) => {
    const val = e.target.value
    if (typeof onChange === 'function') {
      onChange(field, val, e)
    }
  }

  // Format the name on blur so the user sees the result before saving
  const handleBlur = (field, e) => {
    const v = properCase(e.target.value)
    if (v !== e.target.value && typeof onChange === 'function') {
      onChange(field, v, e)
    }
  }

  // Row 1: First Name | Middle Name
  // Row 2: Last Name  | Suffix (optional)
  const content = (
    <>
      {rowClassName ? (
        <div className={rowClassName}>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-first-name`}>First Name *</label>
            <input
              id={`${idPrefix}-first-name`}
              type="text"
              name="first_name"
              value={values.first_name || ''}
              onChange={(e) => handleChange('first_name', e)}
              onBlur={(e) => handleBlur('first_name', e)}
              className={`${inputClassName} ${errors.first_name ? 'input-error' : ''}`.trim()}
              required
              disabled={disabled}
            />
            {errors.first_name && <span className="field-error">{errors.first_name}</span>}
          </div>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-middle-name`}>
              Middle Name <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id={`${idPrefix}-middle-name`}
              type="text"
              name="middle_name"
              value={values.middle_name || ''}
              onChange={(e) => handleChange('middle_name', e)}
              onBlur={(e) => handleBlur('middle_name', e)}
              className={`${inputClassName} ${errors.middle_name ? 'input-error' : ''}`.trim()}
              disabled={disabled}
            />
            {errors.middle_name && <span className="field-error">{errors.middle_name}</span>}
          </div>
        </div>
      ) : (
        <>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-first-name`}>First Name *</label>
            <input
              id={`${idPrefix}-first-name`}
              type="text"
              name="first_name"
              value={values.first_name || ''}
              onChange={(e) => handleChange('first_name', e)}
              onBlur={(e) => handleBlur('last_name', e)}
              className={`${inputClassName} ${errors.first_name ? 'input-error' : ''}`.trim()}
              required
              disabled={disabled}
            />
            {errors.first_name && <span className="field-error">{errors.first_name}</span>}
          </div>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-middle-name`}>
              Middle Name <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id={`${idPrefix}-middle-name`}
              type="text"
              name="middle_name"
              value={values.middle_name || ''}
              onChange={(e) => handleChange('middle_name', e)}
              onBlur={(e) => handleBlur('suffix', e)}
              className={`${inputClassName} ${errors.middle_name ? 'input-error' : ''}`.trim()}
              disabled={disabled}
            />
            {errors.middle_name && <span className="field-error">{errors.middle_name}</span>}
          </div>
        </>
      )}

      {rowClassName ? (
        <div className={rowClassName}>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-last-name`}>Last Name *</label>
            <input
              id={`${idPrefix}-last-name`}
              type="text"
              name="last_name"
              value={values.last_name || ''}
              onChange={(e) => handleChange('last_name', e)}
              onBlur={(e) => handleBlur('first_name', e)}
              className={`${inputClassName} ${errors.last_name ? 'input-error' : ''}`.trim()}
              required
              disabled={disabled}
            />
            {errors.last_name && <span className="field-error">{errors.last_name}</span>}
          </div>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-suffix`}>
              Suffix <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id={`${idPrefix}-suffix`}
              type="text"
              name="suffix"
              value={values.suffix || ''}
              onChange={(e) => handleChange('suffix', e)}
              onBlur={(e) => handleBlur('middle_name', e)}
              className={`${inputClassName} ${errors.suffix ? 'input-error' : ''}`.trim()}
              disabled={disabled}
            />
            {errors.suffix && <span className="field-error">{errors.suffix}</span>}
          </div>
        </div>
      ) : (
        <>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-last-name`}>Last Name *</label>
            <input
              id={`${idPrefix}-last-name`}
              type="text"
              name="last_name"
              value={values.last_name || ''}
              onChange={(e) => handleChange('last_name', e)}
              onBlur={(e) => handleBlur('last_name', e)}
              className={`${inputClassName} ${errors.last_name ? 'input-error' : ''}`.trim()}
              required
              disabled={disabled}
            />
            {errors.last_name && <span className="field-error">{errors.last_name}</span>}
          </div>
          <div className={groupClassName}>
            <label htmlFor={`${idPrefix}-suffix`}>
              Suffix <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id={`${idPrefix}-suffix`}
              type="text"
              name="suffix"
              value={values.suffix || ''}
              onChange={(e) => handleChange('suffix', e)}
              onBlur={(e) => handleBlur('suffix', e)}
              className={`${inputClassName} ${errors.suffix ? 'input-error' : ''}`.trim()}
              disabled={disabled}
            />
            {errors.suffix && <span className="field-error">{errors.suffix}</span>}
          </div>
        </>
      )}
    </>
  )

  return content
}

/**
 * Utility to combine name parts into a single string
 */
export function formatFullName(firstName, middleName, lastName, suffix) {
  const parts = [firstName, middleName, lastName, suffix].filter(
    (p) => p && String(p).trim().length > 0
  )
  return parts.join(' ').trim()
}
