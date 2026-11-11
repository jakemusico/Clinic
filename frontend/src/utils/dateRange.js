const pad = (n) => String(n).padStart(2, '0')
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function presetRange(label, current) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (label) {
    case 'Today':
      return { from: key(today), to: key(today) }
    case 'This Week': {
      const dow = (today.getDay() + 6) % 7 // Monday = 0
      const start = new Date(today); start.setDate(today.getDate() - dow)
      const end = new Date(start); end.setDate(start.getDate() + 6)
      return { from: key(start), to: key(end) }
    }
    case 'This Month':
      return {
        from: key(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: key(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    case 'This Quarter': {
      const q = Math.floor(now.getMonth() / 3)
      return {
        from: key(new Date(now.getFullYear(), q * 3, 1)),
        to: key(new Date(now.getFullYear(), q * 3 + 3, 0)),
      }
    }
    case 'All Time':
      return { from: '', to: '' }
    case 'Custom':
      return current || { from: '', to: '' }
    default:
      return { from: '', to: '' }
  }
}

export function defaultRange() {
  const r = presetRange('This Month')
  return { preset: 'This Month', from: r.from, to: r.to }
}

function fmt(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function rangeLabel(range) {
  if (!range || (!range.from && !range.to)) return 'all time'
  if (range.from && range.from === range.to) return fmt(range.from)
  return `${fmt(range.from) || '…'} – ${fmt(range.to) || '…'}`
}
