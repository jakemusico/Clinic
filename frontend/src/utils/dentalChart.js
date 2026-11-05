// Tooth conditions of the dental chart and the condition a service usually leaves behind.

export const TOOTH_CONDITIONS = [
  { key: 'healthy',   label: 'Healthy',             bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)', dot: '#16A34A' },
  { key: 'cavity',    label: 'Cavity / Caries',      bg: 'var(--red-bg)',   color: 'var(--red)',   border: 'var(--red-border)',   dot: '#DC2626' },
  { key: 'filled',    label: 'Filled / Restoration', bg: 'var(--blue-bg)',  color: 'var(--blue)',  border: 'var(--blue-border)',  dot: '#2563EB' },
  { key: 'extracted', label: 'Extracted',            bg: '#F1F5F9',         color: '#1E293B',      border: '#CBD5E1',             dot: '#1E293B' },
  { key: 'missing',   label: 'Missing',              bg: '#F8FAFC',         color: '#64748B',      border: '#E2E8F0',             dot: '#64748B' },
  { key: 'treated',   label: 'Crown / Root Canal',   bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)', dot: '#D97706' },
]

export const CONDITION_MAP = TOOTH_CONDITIONS.reduce((acc, c) => { acc[c.key] = c; return acc }, {})

/** Chart condition suggested by the service that was picked (the dentist can change it per tooth). */
export const deriveDefaultCondition = (serviceName) => {
  const t = (serviceName || '').toLowerCase()
  if (t.includes('extraction') || t.includes('extract') || t.includes('remove')) return 'extracted'
  if (t.includes('filling') || t.includes('restoration') || t.includes('composite')) return 'filled'
  if (t.includes('crown') || t.includes('root canal') || t.includes('treated')) return 'treated'
  if (t.includes('cavity') || t.includes('caries') || t.includes('decay')) return 'cavity'
  return 'healthy'
}

