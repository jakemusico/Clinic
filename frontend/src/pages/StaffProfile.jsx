import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import PasswordStrength, { checkPasswordRules } from '../components/PasswordStrength'
import NameFields, { formatFullName } from '../components/NameFields'
import Avatar from '../components/Avatar'
import Dropdown from '../components/Dropdown'
import useProfilePhoto from '../hooks/useProfilePhoto'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'
import './ProfilePage.css'

// ── SVG Icon Helper ──────────────────────────────────────────────────────────
function ProfileIcon({ name, size = 16 }) {
  const icons = {
    user: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
    lock: <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm-2 6V6a2 2 0 1 1 4 0v2z" />,
    camera: <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    check: <path d="M20 6 9 17l-5-5" />,
    eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    eyeOff: <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22" />,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    x: <path d="M18 6 6 18 M6 6l12 12" />,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      {icons[name] || null}
    </svg>
  )
}

// ── Contact validation (Philippine mobile: 09XXXXXXXXX, 11 digits) ───────────
function validateContact(val) {
  if (!val) return true
  const digits = val.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('09')
}

export default function StaffProfile() {
  const { user, updateUser, refreshUser } = useAuth()
  // Profile photo: crop dialog + multipart upload/remove (shared by every role)
  const { pickPhoto, requestRemove, busy: photoBusy, photoUi } = useProfilePhoto()

  const isAdmin   = user?.role === 'admin'
  const isDentist = user?.role === 'dentist'
  const roleName  = isAdmin ? 'Administrator' : (isDentist ? 'Dentist' : 'Nurse')

  // ── Active Tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'account'

  // ── View / Edit Mode ────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const isEditingRef = useRef(false)
  useEffect(() => { isEditingRef.current = isEditing }, [isEditing])
  const [saving, setSaving] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [pendingTab, setPendingTab] = useState(null)
  const [savedData, setSavedData] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)

  // ── Form State ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    first_name:    user?.first_name    || '',
    middle_name:   user?.middle_name   || '',
    last_name:     user?.last_name     || '',
    suffix:        user?.suffix        || '',
    name:          user?.name          || '',
    email:         user?.email         || '',
    student_id:    user?.student_id    || '',
    license_no:    user?.license_no    || '',
    contact_no:    user?.contact_no    || '',
    sex:           user?.sex           || user?.patient?.gender || 'male',
    date_of_birth: user?.date_of_birth || user?.patient?.date_of_birth || '',
  })

  // Email change confirmation state
  const [emailPassword, setEmailPassword] = useState('')
  const [showEmailPw, setShowEmailPw]     = useState(false)
  const [fieldErrors, setFieldErrors]     = useState({})

  // ── Password Form ──────────────────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [changingPassword, setChangingPassword] = useState(false)

  // Build the form from a user object returned by the API
  const buildForm = (u) => {
    const p = u?.patient || {}
    const dob = u?.date_of_birth || p.date_of_birth || ''
    return {
      first_name:  u?.first_name  ?? '',
      middle_name: u?.middle_name ?? '',
      last_name:   u?.last_name   ?? '',
      suffix:      u?.suffix      ?? '',
      name:        u?.name        || '',
      email:       u?.email       || '',
      student_id:  u?.student_id  || '',
      license_no:  u?.license_no  || '',
      contact_no:  u?.contact_no  || '',
      sex:         u?.sex         || p.gender || 'male',
      date_of_birth: dob.includes('T') ? dob.split('T')[0] : dob,
    }
  }

  // Load this profile from the database (via the API) every time the page opens.
  useEffect(() => {
    let alive = true
    authApi.getProfile()
      .then(res => {
        if (!alive) return
        if (res.data?.user) updateUser(res.data.user)
      })
      .catch(err => {
        if (alive) toast.error(getApiErrorMessage(err, 'Could not load your profile. Showing the last saved copy.'))
      })
      .finally(() => { if (alive) setLoadingProfile(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the form in step with the shared user, except while the user is mid-edit
  // (a photo change or background refresh must not wipe unsaved typing).
  useEffect(() => {
    if (!user || isEditingRef.current) return
    const fresh = buildForm(user)
    setFormData(fresh)
    setSavedData(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Display Name calculation
  const displayName = useMemo(() => {
    const formatted = formatFullName(formData.first_name, formData.middle_name, formData.last_name, formData.suffix)
    if (formatted) return formatted
    return formData.name || roleName
  }, [formData.first_name, formData.middle_name, formData.last_name, formData.suffix, formData.name, roleName])

  // ── Password strength ──────────────────────────────────────────────────────
  const passwordStrength = useMemo(() => {
    const p = passwordForm.password
    if (!p) return { score: 0, label: 'None', width: '0%' }
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    if (s <= 1) return { score: 1, label: 'Weak',   width: '25%'  }
    if (s === 2) return { score: 2, label: 'Fair',   width: '50%'  }
    if (s === 3) return { score: 3, label: 'Good',   width: '75%'  }
    return              { score: 4, label: 'Strong', width: '100%' }
  }, [passwordForm.password])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleStartEdit = () => {
    setSavedData({ ...formData })
    setIsEditing(true)
    setFieldErrors({})
  }

  const handleCancelEdit = () => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(savedData)
    if (hasChanges) setShowDiscardModal(true)
    else { setIsEditing(false); setFieldErrors({}) }
  }

  const handleDiscardConfirm = () => {
    setFormData(savedData)
    setIsEditing(false)
    setFieldErrors({})
    setShowDiscardModal(false)
    setShowEmailPw(false)
    setEmailPassword('')
    if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null) }
  }

  const handleTabChange = (tab) => {
    if (isEditing) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(savedData)
      if (hasChanges) { setPendingTab(tab); setShowDiscardModal(true); return }
      setIsEditing(false); setFieldErrors({})
    }
    setActiveTab(tab)
  }

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault()

    const errors = {}
    if (!formData.first_name?.trim()) errors.first_name = 'First name is required.'
    if (!formData.last_name?.trim())  errors.last_name  = 'Last name is required.'

    if (formData.contact_no && !validateContact(formData.contact_no)) {
      toast.error('Contact number must be 11 digits starting with 09.')
      return
    }

    const emailChanged = formData.email && formData.email.toLowerCase() !== user?.email?.toLowerCase()
    if (emailChanged) {
      if (!/^[A-Za-z0-9._%+-]+@urios\.edu\.ph$/i.test(formData.email.trim())) {
        toast.error('Email address must belong to the @urios.edu.ph domain (e.g. name@urios.edu.ph).')
        return
      }
      if (!emailPassword) {
        toast.error('Please enter your current password to confirm the email change.')
        return
      }
    }

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        first_name:  formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || '',
        last_name:   formData.last_name.trim(),
        suffix:      formData.suffix?.trim() || '',
      }

      if (emailChanged) {
        payload.email = formData.email.trim().toLowerCase()
        payload.current_password = emailPassword
      }

      const res = await authApi.updateProfile(payload)
      // Show exactly what the database now holds (server may trim / normalise values).
      const saved = res.data?.user ? buildForm(res.data.user) : { ...formData }
      isEditingRef.current = false
      if (res.data?.user) updateUser(res.data.user)
      if (typeof refreshUser === 'function') await refreshUser()
      setFormData(saved)
      setSavedData(saved)
      setEmailPassword('')
      toast.success('Profile saved successfully.')
      setIsEditing(false)
      setShowEmailPw(false)
    } catch (err) {
      const serverErrors = getFieldErrors(err)
      if (Object.keys(serverErrors).length > 0) setFieldErrors(prev => ({ ...prev, ...serverErrors }))
      toast.error(getApiErrorMessage(err, 'Failed to save profile. Please try again.'))
    } finally { setSaving(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwordForm.current_password) { toast.error('Please enter your current password.'); return }
    if (!checkPasswordRules(passwordForm.password)) { toast.error('New password does not meet all requirements.'); return }
    if (passwordForm.password !== passwordForm.password_confirmation) { toast.error('New passwords do not match.'); return }
    setChangingPassword(true)
    try {
      await authApi.changePassword(passwordForm)
      toast.success('Password updated successfully.')
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
      setShowChangePassword(false)
    } catch (err) {
      const msg =
        err.response?.data?.errors?.current_password?.[0] ||
        err.response?.data?.message ||
        'Failed to update password.'
      toast.error(msg)
    } finally { setChangingPassword(false) }
  }

  const ro = !isEditing
  const inputCls  = 'profile-input'

  const EyeBtn = ({ field }) => (
    <button type="button" onClick={() => setShowPasswords(p => ({ ...p, [field]: !p[field] }))}
      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      aria-label="Toggle password visibility">
      <ProfileIcon name={showPasswords[field] ? 'eyeOff' : 'eye'} size={16} />
    </button>
  )

  return (
    <DashboardLayout title="My Profile" subtitle="Manage your personal profile and account settings.">
      <div className="profile-container profile-container-staff">
        <div className="staff-profile-grid">

          {/* LEFT COLUMN: SUMMARY CARD */}
          <div className="staff-summary-card">
            {/* Avatar */}
            <div
              className="staff-avatar-wrapper"
              onClick={() => isEditing && pickPhoto()}
              title={isEditing ? 'Click to change profile photo' : undefined}
              style={{ cursor: isEditing ? 'pointer' : 'default' }}
            >
              <Avatar src={user?.avatar_url} name={formData.first_name || formData.name}
                className="staff-avatar-img" fallbackClassName="staff-avatar-fallback"
                fallbackText={(formData.first_name || formData.name)?.[0]?.toUpperCase() || 'A'} alt="Profile" />
              {isEditing && (
                <div className="staff-avatar-overlay" title="Upload Photo">
                  <ProfileIcon name="camera" size={13} />
                </div>
              )}
            </div>

            {photoUi}

            {isEditing && (
              <button type="button" className="staff-upload-photo-btn" onClick={pickPhoto} disabled={photoBusy}>
                <ProfileIcon name="camera" size={14} /> Change Photo
              </button>
            )}

            <h3 className="staff-summary-name">{displayName}</h3>
            <span className="staff-summary-badge">{roleName}</span>
            <p className="staff-summary-email">{formData.email || '—'}</p>

            <div className="staff-summary-divider" />

            {/* Quick Metadata list */}
            <div className="staff-summary-meta-list">
              <div className="staff-meta-item">
                <span className="staff-meta-label">Position</span>
                <span className="staff-meta-val">{roleName}</span>
              </div>
              <div className="staff-meta-item">
                <span className="staff-meta-label">Employee ID</span>
                <span className="staff-meta-val">{formData.student_id || '—'}</span>
              </div>
              {!isAdmin && formData.license_no && (
                <div className="staff-meta-item">
                  <span className="staff-meta-label">PRC License</span>
                  <span className="staff-meta-val">{formData.license_no}</span>
                </div>
              )}
              <div className="staff-meta-item">
                <span className="staff-meta-label">Contact</span>
                <span className="staff-meta-val">{formData.contact_no || '—'}</span>
              </div>
              <div className="staff-meta-item">
                <span className="staff-meta-label">Sex</span>
                <span className="staff-meta-val" style={{ textTransform: 'capitalize' }}>{formData.sex || '—'}</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: TABS AND FORM */}
          <div className="staff-main-content">

            {/* Tabs Navigation */}
            <div className="staff-tabs-card">
              <button type="button"
                className={`staff-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => handleTabChange('profile')}>
                <ProfileIcon name="user" size={16} /> Profile
              </button>
              <button type="button"
                className={`staff-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => handleTabChange('account')}>
                <ProfileIcon name="lock" size={16} /> Account &amp; Security
              </button>
            </div>

            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <div className="staff-form-card">
                <div className="staff-card-header">
                  <h3 className="staff-card-title">Profile Information</h3>
                  <p className="staff-card-subtitle">Manage your personal profile and account settings.</p>
                </div>

                <div className="profile-form-grid">

                  {/* Profile Photo Control */}
                  <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Profile Photo {isEditing && <span className="optional">PNG, JPG or WEBP. You can crop it after choosing.</span>}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                      <Avatar src={user?.avatar_url} name={formData.first_name || formData.name} size={48} alt="Avatar"
                        fallbackText={(formData.first_name || formData.name)?.[0]?.toUpperCase() || 'A'}
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#2563EB', fontWeight: 700, fontSize: '1.2rem' }} />
                      {isEditing && (
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <button type="button" className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={pickPhoto} disabled={photoBusy}>
                            {user?.avatar_url ? 'Change Photo' : 'Upload Photo'}
                          </button>
                          {user?.avatar_url && (
                            <button type="button" className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', color: '#64748B' }} onClick={requestRemove} disabled={photoBusy}>Remove Photo</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name Fields */}
                  <NameFields values={formData} onChange={(field, val) => handleChange(field, val)}
                    errors={fieldErrors} inputClassName={inputCls} groupClassName="profile-field-group"
                    rowClassName="" idPrefix="staff" disabled={ro} />

                  {/* Employee ID */}
                  <div className="profile-field-group">
                    <label>Employee ID</label>
                    <input type="text" className={inputCls} value={formData.student_id}
                      onChange={e => handleChange('student_id', e.target.value)} disabled={ro} />
                  </div>

                  {/* Position (always read-only) */}
                  <div className="profile-field-group">
                    <label>Position</label>
                    <input type="text" className={`${inputCls} readonly`} value={roleName} disabled />
                  </div>

                  {/* PRC License Number — nurse & dentist only */}
                  {!isAdmin && (
                    <div className="profile-field-group">
                      <label>PRC License Number</label>
                      <input type="text" className={inputCls} value={formData.license_no} maxLength={100}
                        onChange={e => handleChange('license_no', e.target.value)} disabled={ro} />
                    </div>
                  )}

                  {/* Sex */}
                  <div className="profile-field-group">
                    <label>Sex</label>
                    <Dropdown
                      variant="plain"
                      className={inputCls}
                      ariaLabel="Sex"
                      value={formData.sex}
                      onChange={v => handleChange('sex', v)}
                      disabled={ro}
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                      ]}
                    />
                  </div>

                  {/* Date of Birth */}
                  <div className="profile-field-group">
                    <label>Date of Birth <span className="optional">(Optional)</span></label>
                    <input type="date" className={inputCls} value={formData.date_of_birth}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => handleChange('date_of_birth', e.target.value)} disabled={ro} />
                  </div>

                  {/* Contact Number */}
                  <div className="profile-field-group">
                    <label>Contact Number</label>
                    <input type="text" className={inputCls} value={formData.contact_no} maxLength={11}
                      onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 11); handleChange('contact_no', val) }}
                      disabled={ro} />
                    {formData.contact_no && !validateContact(formData.contact_no) && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--red, #DC2626)', marginTop: '0.2rem' }}>
                        Must be 11 digits starting with 09.
                      </span>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="profile-field-group">
                    <label>Email Address <span style={{ color: '#DC2626' }}>*</span></label>
                    <input type="email" id="staff-email"
                      className={`${inputCls}${fieldErrors.email ? ' error' : ''}`}
                      value={formData.email} onChange={e => handleChange('email', e.target.value)}
                      required disabled={ro} />
                    {fieldErrors.email && (
                      <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.email}</span>
                    )}
                  </div>

                  {/* Current Password confirmation if email changed in edit mode */}
                  {isEditing && formData.email?.trim().toLowerCase() !== user?.email?.trim().toLowerCase() && (
                    <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                      <label>
                        Current Password <span style={{ color: '#DC2626' }}>*</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748B', marginLeft: '0.5rem' }}>
                          (Required to confirm email address change)
                        </span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type={showEmailPw ? 'text' : 'password'} id="staff-email-password"
                          className={`${inputCls}${fieldErrors.emailPassword ? ' error' : ''}`}
                          value={emailPassword} onChange={e => setEmailPassword(e.target.value)}
                          required style={{ paddingRight: '2.5rem' }} />
                        <button type="button" onClick={() => setShowEmailPw(!showEmailPw)}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex', alignItems: 'center' }}
                          tabIndex={-1}>
                          <ProfileIcon name={showEmailPw ? 'eyeOff' : 'eye'} size={16} />
                        </button>
                      </div>
                      {fieldErrors.emailPassword && (
                        <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.2rem', display: 'block' }}>{fieldErrors.emailPassword}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="staff-card-footer">
                  <span className="staff-footer-hint">
                    <ProfileIcon name="check" size={15} />
                    Profile changes will be saved to your account.
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!isEditing ? (
                      <button type="button" className="btn-primary" onClick={handleStartEdit} disabled={loadingProfile}>
                        <ProfileIcon name="edit" size={14} /> Edit Profile
                      </button>
                    ) : (
                      <>
                        <button type="button" className="btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                          <ProfileIcon name="x" size={14} /> Cancel
                        </button>
                        <button type="button" className="btn-primary" onClick={handleSaveProfile} disabled={saving}>
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ACCOUNT & SECURITY */}
            {activeTab === 'account' && (
              <div className="staff-form-card">
                <div className="staff-card-header">
                  <h3 className="staff-card-title">Account Security</h3>
                  <p className="staff-card-subtitle">Update your password to keep your account secure.</p>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm, 8px)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showChangePassword ? '1rem' : 0 }}>
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.15rem' }}>Change Password</h4>
                      {!showChangePassword && <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>Update your account password.</p>}
                    </div>
                    {!showChangePassword ? (
                      <button type="button" className="btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', flexShrink: 0 }}
                        onClick={() => setShowChangePassword(true)}>
                        Change Password
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', flexShrink: 0 }}
                        onClick={() => { setShowChangePassword(false); setPasswordForm({ current_password: '', password: '', password_confirmation: '' }) }}>
                        <ProfileIcon name="x" size={14} /> Cancel
                      </button>
                    )}
                  </div>

                  {showChangePassword && (
                    <form onSubmit={handleChangePassword}>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1rem' }}>
                        Password must be at least 8 characters with uppercase, lowercase, number, and symbol.
                      </p>
                      <div className="profile-form-grid">
                        <div className="profile-field-group">
                          <label>Current Password</label>
                          <div style={{ position: 'relative' }}>
                            <input type={showPasswords.current ? 'text' : 'password'} className={inputCls}
                              value={passwordForm.current_password}
                              onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                              autoComplete="current-password"
                              onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                              required style={{ paddingRight: '2.5rem' }} />
                            <EyeBtn field="current" />
                          </div>
                        </div>
                        <div className="profile-field-group">
                          <label>New Password</label>
                          <div style={{ position: 'relative' }}>
                            <input type={showPasswords.new ? 'text' : 'password'} className={inputCls}
                              value={passwordForm.password}
                              onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })}
                              autoComplete="new-password"
                              onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                              required style={{ paddingRight: '2.5rem' }} />
                            <EyeBtn field="new" />
                          </div>
                        </div>
                        <div className="profile-field-group">
                          <label>Confirm New Password</label>
                          <div style={{ position: 'relative' }}>
                            <input type={showPasswords.confirm ? 'text' : 'password'} className={inputCls}
                              value={passwordForm.password_confirmation}
                              onChange={e => setPasswordForm({ ...passwordForm, password_confirmation: e.target.value })}
                              autoComplete="new-password"
                              onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                              required style={{ paddingRight: '2.5rem' }} />
                            <EyeBtn field="confirm" />
                          </div>
                        </div>
                      </div>

                      {passwordForm.password && (
                        <>
                          <div className="password-strength-wrap" style={{ marginTop: '0.65rem' }}>
                            <span className="strength-text">Strength: {passwordStrength.label}</span>
                            <div className="strength-bar-track">
                              <div className="strength-bar-fill" style={{ width: passwordStrength.width }} />
                            </div>
                          </div>
                          <PasswordStrength password={passwordForm.password} />
                        </>
                      )}

                      <div className="pw-form-actions" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-primary" disabled={changingPassword}>
                          {changingPassword ? 'Updating…' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* DISCARD CHANGES MODAL */}
      {showDiscardModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDiscardModal(false)}>
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Discard Changes?</h2>
              <button className="modal-close" onClick={() => { setShowDiscardModal(false); setPendingTab(null) }}>&#x2715;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                You have unsaved changes. If you leave now, your edits will be lost. Are you sure you want to discard them?
              </p>
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowDiscardModal(false); setPendingTab(null) }}>Keep Editing</button>
                <button type="button" className="btn-primary" style={{ background: '#DC2626' }} onClick={handleDiscardConfirm}>Discard Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
