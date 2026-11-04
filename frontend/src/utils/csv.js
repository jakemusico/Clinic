/**
 * Download rows as a CSV file (UTF-8 with BOM so Excel shows accents correctly).
 * Free-text cells that start with = + - @ would be run as formulas by Excel, so they get a leading '.
 */
const cell = (v) => {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename, headers, rows) {
  const content = [
    headers.map(cell).join(','),
    ...rows.map(r => r.map(cell).join(',')),
  ].join('\r\n')

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
