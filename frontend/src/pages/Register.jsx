import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { ROLE_ROUTES } from '../components/RouteGuards'
import PasswordStrength, { checkPasswordRules } from '../components/PasswordStrength'
import MobileInput, { isMobileValid } from '../components/MobileInput'
import NameFields from '../components/NameFields'
import { DEPARTMENTS, GRADE_LEVELS } from '../constants/schoolData'
import axios from 'axios'

import fsuuBuilding from '../assets/fsuu_building.jpg'
import fsuuLogo from '../assets/fsuu_logo.png'

const PUBLIC_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'faculty_staff', label: 'Faculty / Staff' },
]

const GUARDIAN_RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Other']

// Eye icon components
function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// Terms modal
function TermsModal({ content, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10, 18, 35, 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card, #fff)',
          borderRadius: '14px',
          width: '100%', maxWidth: '640px',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border, #E2E8F0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text, #0F172A)' }}>Terms &amp; Data Privacy Policy</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub, #64748B)', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text, #0F172A)' }}>
            {content}
          </div>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border, #E2E8F0)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="login-btn-primary"
            style={{ minWidth: '120px', padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'student',
    date_of_birth: '',
    sex: '',
    contact_no: '',
    address: '',
    // Student
    student_id: '',
    grade_level: '',
    section: '',
    guardian_name: '',
    guardian_relationship: '',
    guardian_contact: '',
    // Faculty/Staff
    department: '',
    terms_accepted: false,
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [termsText, setTermsText] = useState('')
  const [dbSections, setDbSections] = useState([])
  const [dbGradeLevels, setDbGradeLevels] = useState([])

  // Fetch terms and sections from backend
  useEffect(() => {
    axios.get('/api/settings/terms_and_privacy')
      .then(res => setTermsText(res.data.value || ''))
      .catch(() => { })
      
    axios.get('/api/sections')
      .then(res => setDbSections(res.data))
      .catch(err => console.error('Failed to load sections:', err))

    axios.get('/api/grade-levels')
      .then(res => setDbGradeLevels(res.data))
      .catch(err => console.error('Failed to load grade levels:', err))
  }, [])

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value }
      if (name === 'grade_level') next.section = ''
      return next
    })
    setErrors(prev => ({ ...prev, [name]: '' }))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!form.first_name.trim()) newErrors.first_name = 'First name is required.'
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required.'
    if (!form.date_of_birth) newErrors.date_of_birth = 'Date of birth is required.'
    if (!form.sex) newErrors.sex = 'Sex is required.'

    if (!checkPasswordRules(form.password)) {
      newErrors.password = 'Password does not meet all requirements.'
    }
    if (form.password !== form.password_confirmation) {
      newErrors.password_confirmation = 'Passwords do not match.'
    }
    if (form.contact_no && !isMobileValid(form.contact_no)) {
      newErrors.contact_no = 'Enter a valid 11-digit Philippine mobile number starting with 09.'
    }

    if (form.role === 'student') {
      if (!form.student_id.trim()) newErrors.student_id = 'Student ID is required.'
      if (!form.grade_level) newErrors.grade_level = 'Grade Level is required.'
      if (!form.section) newErrors.section = 'Section is required.'
      if (!form.guardian_name.trim()) newErrors.guardian_name = 'Parent/Guardian Name is required.'
      if (!form.guardian_relationship) newErrors.guardian_relationship = 'Relationship is required.'
      if (!form.guardian_contact.trim()) newErrors.guardian_contact = 'Parent/Guardian Contact is required.'
      else if (!isMobileValid(form.guardian_contact))
        newErrors.guardian_contact = 'Enter a valid 11-digit Philippine mobile number starting with 09.'
      if (!form.contact_no.trim()) newErrors.contact_no = 'Contact Number is required.'
      if (!form.address.trim()) newErrors.address = 'Home Address is required.'
    }

    if (!form.terms_accepted) {
      newErrors.terms_accepted = 'You must agree to the Terms and Data Privacy Policy.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    setErrors({})
    try {
      const payload = { ...form, terms_accepted: form.terms_accepted ? '1' : '0' }
      const user = await register(payload)
      toast.success(`Account created! Welcome, ${user.first_name || user.name}!`)
      navigate(ROLE_ROUTES[user.role] || '/dashboard/student', { replace: true })
    } catch (err) {
      const data = err?.response?.data
      if (data?.errors) {
        const flat = {}
        Object.entries(data.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
      } else {
        toast.error(data?.message || 'Registration failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  const pwAllGood = checkPasswordRules(form.password)
  const canSubmit = pwAllGood && form.terms_accepted && !loading
  const isStudent = form.role === 'student'
  
  const availableSections = dbSections.filter(s => s.grade_level === form.grade_level)

  return (
    <div className="login-page-wrapper">
      <div
        className="login-bg-layer"
        style={{ backgroundImage: `linear-gradient(rgba(15, 24, 42, 0.44), rgba(15, 24, 42, 0.44)), url(${fsuuBuilding})` }}
      />

      {showTerms && <TermsModal content={termsText} onClose={() => setShowTerms(false)} />}

      <div className="login-card-box" style={{ maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', marginTop: '1.5rem', marginBottom: '1.5rem' }}>

        <Link to="/login" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748B', fontSize: '0.82rem', textDecoration: 'none', marginBottom: '0.75rem', fontWeight: 500 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back to Login
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.35rem' }}>
          <img src={fsuuLogo} alt="FSUU Logo" className="login-official-logo" style={{ marginBottom: '0.35rem' }} />
        </div>

        <h2 className="login-title" style={{ marginBottom: '0.15rem' }}>Create your account</h2>
        <p className="login-subtitle" style={{ marginBottom: '1.1rem' }}>Join the FSUU campus clinic portal</p>

        <form onSubmit={handleSubmit} className="auth-form" noValidate style={{ width: '100%' }}>

          {/* 1. Role — full width */}
          <div className="form-group">
            <label htmlFor="reg-role">I am a…</label>
            <select id="reg-role" name="role" value={form.role} onChange={handleChange}
              className={errors.role ? 'input-error' : ''}>
              {PUBLIC_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {errors.role && <span className="field-error">{errors.role}</span>}
          </div>

          {/* 2 & 3. First Name, Middle Name, Last Name, Suffix */}
          <NameFields
            values={form}
            onChange={(field, val) => handleChange({ target: { name: field, value: val, type: 'text' } })}
            errors={errors}
            idPrefix="reg"
          />

          {/* 4. Date of Birth | Sex */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-dob">Date of Birth *</label>
              <input id="reg-dob" type="date" name="date_of_birth"
                value={form.date_of_birth} onChange={handleChange}
                className={errors.date_of_birth ? 'input-error' : ''}
                max={new Date().toISOString().split('T')[0]}
                required />
              {errors.date_of_birth && <span className="field-error">{errors.date_of_birth}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="reg-sex">Sex *</label>
              <select id="reg-sex" name="sex" value={form.sex} onChange={handleChange}
                className={errors.sex ? 'input-error' : ''} required>
                <option value="">Select sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.sex && <span className="field-error">{errors.sex}</span>}
            </div>
          </div>

          {/* 5. Email Address | Personal Contact Number */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-email">Email Address *</label>
              <input id="reg-email" type="email" name="email"
                value={form.email} onChange={handleChange}
                className={errors.email ? 'input-error' : ''} required />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <MobileInput
              id="reg-contact"
              name="contact_no"
              label={isStudent ? 'Personal Contact Number *' : 'Contact Number'}
              value={form.contact_no}
              onChange={handleChange}
              error={errors.contact_no}
            />
          </div>

          {/* 6. Home Address — full width */}
          <div className="form-group">
            <label htmlFor="reg-address">{isStudent ? 'Home Address *' : 'Address'}</label>
            <input id="reg-address" type="text" name="address"
              value={form.address} onChange={handleChange}
              className={errors.address ? 'input-error' : ''} />
            {errors.address && <span className="field-error">{errors.address}</span>}
          </div>

          {/* ── ROLE-SPECIFIC FIELDS ─────────────────────────── */}
          {isStudent ? (
            <>
              {/* 7. Student ID | Grade Level */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reg-student-id">Student ID *</label>
                  <input id="reg-student-id" type="text" name="student_id"
                    value={form.student_id} onChange={handleChange}
                    className={errors.student_id ? 'input-error' : ''} />
                  {errors.student_id && <span className="field-error">{errors.student_id}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-grade-level">Grade Level *</label>
                  <select id="reg-grade-level" name="grade_level" value={form.grade_level} onChange={handleChange}
                    className={errors.grade_level ? 'input-error' : ''}>
                    <option value="">Select grade level</option>
                    {(dbGradeLevels.length > 0 ? dbGradeLevels : GRADE_LEVELS).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  {errors.grade_level && <span className="field-error">{errors.grade_level}</span>}
                </div>
              </div>

              {/* 8. Section */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reg-section">Section *</label>
                  <select id="reg-section" name="section" value={form.section} onChange={handleChange}
                    className={errors.section ? 'input-error' : ''}
                    disabled={!form.grade_level}>
                    <option value="">Select section</option>
                    {availableSections.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.strand ? `(${s.strand})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.section && <span className="field-error">{errors.section}</span>}
                </div>
              </div>

              {/* 9. Guardian Name | Relationship */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reg-guardian-name">Parent / Guardian Name *</label>
                  <input id="reg-guardian-name" type="text" name="guardian_name"
                    value={form.guardian_name} onChange={handleChange}
                    className={errors.guardian_name ? 'input-error' : ''} />
                  {errors.guardian_name && <span className="field-error">{errors.guardian_name}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="reg-guardian-relationship">Relationship *</label>
                  <select id="reg-guardian-relationship" name="guardian_relationship"
                    value={form.guardian_relationship} onChange={handleChange}
                    className={errors.guardian_relationship ? 'input-error' : ''}>
                    <option value="">Select relationship</option>
                    {GUARDIAN_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {errors.guardian_relationship && <span className="field-error">{errors.guardian_relationship}</span>}
                </div>
              </div>

              {/* 10. Guardian Contact — full width */}
              <MobileInput
                id="reg-guardian-contact"
                name="guardian_contact"
                label="Guardian Contact Number *"
                value={form.guardian_contact}
                onChange={handleChange}
                error={errors.guardian_contact}
              />
            </>
          ) : (
            /* Faculty/Staff fields */
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-emp-id">Employee ID</label>
                <input id="reg-emp-id" type="text" name="student_id"
                  value={form.student_id} onChange={handleChange}
                  className={errors.student_id ? 'input-error' : ''} />
                {errors.student_id && <span className="field-error">{errors.student_id}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="reg-department">Department</label>
                <select id="reg-department" name="department" value={form.department} onChange={handleChange}
                  className={errors.department ? 'input-error' : ''}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {errors.department && <span className="field-error">{errors.department}</span>}
              </div>
            </div>
          )}

          {/* 11. Password | Confirm Password */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-password">Password *</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  value={form.password} onChange={handleChange}
                  className={errors.password ? 'input-error' : ''}
                  style={{ paddingRight: '2.5rem' }}
                  required />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}
                  tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
              <PasswordStrength password={form.password} visible={form.password.length > 0} />
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm">Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  name="password_confirmation"
                  value={form.password_confirmation} onChange={handleChange}
                  className={errors.password_confirmation ? 'input-error' : ''}
                  style={{ paddingRight: '2.5rem' }}
                  required />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' }}
                  tabIndex={-1} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {errors.password_confirmation && <span className="field-error">{errors.password_confirmation}</span>}
              {form.password_confirmation && form.password && !errors.password_confirmation && (
                form.password === form.password_confirmation
                  ? <span className="field-success">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    Passwords match
                  </span>
                  : <span className="field-error">Passwords do not match.</span>
              )}
            </div>
          </div>

          {/* 12. Terms checkbox */}
          <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text, #0F172A)', lineHeight: 1.5 }}>
              <input
                id="reg-terms"
                type="checkbox"
                name="terms_accepted"
                checked={form.terms_accepted}
                onChange={handleChange}
                style={{ marginTop: '0.2rem', accentColor: 'var(--primary, #2563EB)', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <span>
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary, #2563EB)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
                >
                  Terms and Data Privacy Policy
                </button>
              </span>
            </label>
            {errors.terms_accepted && <span className="field-error" style={{ display: 'block', marginTop: '0.3rem' }}>{errors.terms_accepted}</span>}
          </div>

          {/* Create Account button */}
          <button
            id="register-submit"
            type="submit"
            className="login-btn-primary"
            style={{
              marginTop: '1rem',
              width: '100%',
              height: '50px',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '10px',
              opacity: canSubmit ? 1 : 0.55,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
            disabled={!canSubmit}
          >
            {loading ? <span className="btn-spinner" /> : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <p className="login-footer-text">
            Already have an account?{' '}
            <Link to="/login" className="login-link">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
