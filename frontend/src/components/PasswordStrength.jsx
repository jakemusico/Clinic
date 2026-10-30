/**
 * PasswordStrength — live password rule checklist
 *
 * Props:
 *   password  {string}  — the current password value
 *   visible   {boolean} — only show when user has started typing (optional)
 */

const RULES = [
  { id: 'length',    label: 'At least 8 characters',         test: (p) => p.length >= 8 },
  { id: 'number',    label: 'At least 1 number',             test: (p) => /[0-9]/.test(p) },
  { id: 'lower',     label: 'At least 1 lowercase letter',   test: (p) => /[a-z]/.test(p) },
  { id: 'upper',     label: 'At least 1 uppercase letter',   test: (p) => /[A-Z]/.test(p) },
  { id: 'special',   label: 'At least 1 special character',  test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function checkPasswordRules(password) {
  return RULES.every((r) => r.test(password))
}

export default function PasswordStrength({ password, visible = true }) {
  if (!visible || !password) return null

  const allPassed = RULES.every((r) => r.test(password))

  return (
    <div className="pw-strength-box">
      {RULES.map((rule) => {
        const passed = rule.test(password)
        return (
          <div key={rule.id} className={`pw-rule ${passed ? 'passed' : 'failed'}`}>
            <span className="pw-rule-icon">
              {passed ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <span>{rule.label}</span>
          </div>
        )
      })}
      {allPassed && (
        <div className="pw-strength-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
          </svg>
          Strong password. All criteria met.
        </div>
      )}
    </div>
  )
}
