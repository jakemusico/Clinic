import React from 'react'
import DateInput from './DateInput'

export { DateInput }

export default function StyledSelect({
  value,
  onChange,
  options,
  children,
  placeholder,
  disabled = false,
  className = '',
  style = {},
  selectStyle = {},
  id,
  name,
  required = false,
  ...props
}) {
  const hasOptions = Array.isArray(options) && options.length > 0
  const hasExplicitEmptyOption = hasOptions && options.some(o => {
    const val = typeof o === 'object' && o !== null ? o.value : o
    return val === '' || val === null
  })

  return (
    <div
      className={`styled-select-wrap ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        boxSizing: 'border-box',
        width: '100%',
        ...style,
      }}
    >
      <select
        id={id}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="styled-select-field"
        style={{
          width: '100%',
          height: '40px',
          padding: '0 2.25rem 0 0.85rem',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: '1.5px solid var(--border, #cbd5e1)',
          borderRadius: 'var(--radius-sm, 6px)',
          color: 'var(--text, #0f172a)',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          boxSizing: 'border-box',
          lineHeight: 'normal',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          ...selectStyle,
        }}
        {...props}
      >
        {placeholder && !hasExplicitEmptyOption && (
          <option value="">{placeholder}</option>
        )}
        {hasOptions
          ? options.map((opt, idx) => {
              const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt
              const optLabel = typeof opt === 'object' && opt !== null ? (opt.label ?? opt.name ?? opt.value) : opt
              return (
                <option key={optVal !== undefined && optVal !== null ? `${optVal}-${idx}` : idx} value={optVal}>
                  {optLabel}
                </option>
              )
            })
          : children}
      </select>

      {/* Light chevron icon with proper spacing from the right edge */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="styled-select-chevron"
        style={{
          position: 'absolute',
          right: '0.85rem',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--text-muted, #64748b)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}
