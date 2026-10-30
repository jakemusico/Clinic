import React from 'react'

export default function DateInput({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
  className = '',
  style = {},
  inputStyle = {},
  ...props
}) {
  return (
    <div
      className={`styled-date-wrap ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: '40px',
        background: disabled ? '#f1f5f9' : '#ffffff',
        border: '1.5px solid var(--border, #cbd5e1)',
        borderRadius: 'var(--radius-sm, 6px)',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >
      {label && (
        <span
          className="styled-date-label"
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--text-muted, #64748b)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            paddingLeft: '0.75rem',
            paddingRight: '0.25rem',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
      <input
        type="date"
        value={value || ''}
        onChange={onChange}
        min={min}
        max={max}
        disabled={disabled}
        className="styled-date-field"
        style={{
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: '0.85rem',
          color: 'var(--text, #0f172a)',
          padding: label ? '0 0.65rem 0 0.25rem' : '0 0.75rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
          lineHeight: 'normal',
          ...inputStyle,
        }}
        {...props}
      />
    </div>
  )
}

