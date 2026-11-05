import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import api from '../api/axios'
import StaffProfile from './StaffProfile'
import PasswordStrength, { checkPasswordRules } from '../components/PasswordStrength'
import { validateMobile } from '../components/MobileInput'
import NameFields, { formatFullName } from '../components/NameFields'
import Avatar from '../components/Avatar'
import useProfilePhoto from '../hooks/useProfilePhoto'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'
import { SCHOOL_YEARS } from '../constants/schoolData'
import Dropdown from '../components/Dropdown'
import './ProfilePage.css'
import { EMPTY } from '../utils/emptyValue'

const BLOOD_TYPES = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const RELATIONSHIPS = [
  'Mother', 'Father', 'Legal Guardian', 'Grandmother', 'Grandfather',
  'Aunt', 'Uncle', 'Sibling', 'Other',
]

const COMMON_ALLERGIES = [
  'Peanuts', 'Tree Nuts', "Cow's Milk / Dairy", 'Eggs', 'Shellfish / Seafood',
  'Wheat / Gluten', 'Soy', 'Penicillin', 'Amoxicillin', 'Aspirin / NSAIDs',
  'Dust Mites', 'Pollen', 'Insect Stings', 'None Known',
]

function ProfileIcon({ name, size = 16 }) {
  const icons = {
    user: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
    parent: <path d="M17 21v-2a4 4 0 0 0-3-3.87 M9 21v-2a4 4 0 0 1 3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 3.13a4 4 0 0 0 0 7.75 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    phoneCall: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    health: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z M12 5v14" />,
    lock: <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm-2 6V6a2 2 0 1 1 4 0v2z" />,
    camera: <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    check: <path d="M20 6 9 17l-5-5" />,
    print: <path d="M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z" />,
    grid: <path d="M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z" />,
    eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    eyeOff: <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22" />,
    copy: <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />,
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

function buildFormData(user) {
  const p = user?.patient || {}
  return {
    first_name: user?.first_name || '',
    middle_name: user?.middle_name || '',
    last_name: user?.last_name || '',
    suffix: user?.suffix || '',
    name: user?.name || '',
    email: user?.email || '',
    emailPassword: '',
    student_id: user?.student_id || '',
    grade_level: user?.grade_level || '',
    section: user?.section || '',
    school_year: user?.school_year || '',
    date_of_birth: p.date_of_birth
      ? (p.date_of_birth.includes('T') ? p.date_of_birth.split('T')[0] : p.date_of_birth)
      : (user?.date_of_birth ? (user.date_of_birth.includes('T') ? user.date_of_birth.split('T')[0] : user.date_of_birth) : ''),
    age: p.age !== undefined && p.age !== null ? String(p.age)
      : (user?.age !== undefined && user?.age !== null ? String(user.age) : ''),
    sex: user?.sex || p.gender || '',
    gender: p.gender || user?.sex || '',
    address: user?.address || '',
    contact_no: user?.contact_no || '',
    guardian_name: p.guardian_name || '',
    guardian_relationship: p.guardian_relationship || user?.guardian_relationship || '',
    guardian_contact: p.guardian_contact || '',
    guardian_email: p.guardian_email || '',
    emergency_name: p.emergency_name || '',
    emergency_relationship: p.emergency_relationship || '',
    emergency_contact_no: p.emergency_contact_no || p.emergency_contact || '',
    emergency_alt_contact: p.emergency_alt_contact || '',
    blood_type: p.blood_type || '',
    allergies: p.allergies || '',
    current_medications: p.current_medications || '',
    medical_conditions: p.medical_conditions || '',
    medical_history: p.medical_history || '',
    other_health_notes: p.other_health_notes || '',
  }
}

// Nurse / Dentist / Admin get the staff profile; students and faculty get this one.
export default function ProfilePage() {
  const { user } = useAuth()

  if (user?.role === 'clinic_staff' || user?.role === 'dentist' || user?.role === 'admin') {
    return <StaffProfile />
  }

  return <PatientProfilePage />
}

function PatientProfilePage() {
  const { user, updateUser, refreshUser } = useAuth()

  // Profile photo: crop dialog + multipart upload/remove (shared by every role)
  const { pickPhoto, requestRemove, busy: photoBusy, photoUi } = useProfilePhoto()

  const [activeTab, setActiveTab] = useState('student')
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [showEmailPassword, setShowEmailPassword] = useState(false)

  // View / Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [pendingTab, setPendingTab] = useState(null)
  const [savedData, setSavedData] = useState(() => (user ? buildFormData(user) : null))
  const [showChangePassword, setShowChangePassword] = useState(false)

  const [dbSections, setDbSections] = useState([])
  const [dbGradeLevels, setDbGradeLevels] = useState([])

  useEffect(() => {
    api.get('/sections').then(res => setDbSections(res.data)).catch(() => {})
    api.get('/grade-levels').then(res => setDbGradeLevels(res.data)).catch(() => {})
  }, [])

  const [formData, setFormData] = useState(() => buildFormData(user))
  const [passwordForm, setPasswordForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [changingPassword, setChangingPassword] = useState(false)

  // Fetch fresh profile directly from the API on mount (source of truth)
  useEffect(() => {
    let isMounted = true
    const fetchProfileFromApi = async () => {
      try {
        setLoadingProfile(true)
        const res = await authApi.getProfile()
        if (!isMounted) return
        const freshUser = res.data?.user || res.data
        const freshData = buildFormData(freshUser)
        setFormData(freshData)
        setSavedData(freshData)
        if (res.data?.user) {
          updateUser(res.data.user)
        }
      } catch (err) {
        console.error('Failed to load profile from API:', err)
        if (user && isMounted) {
          const fresh = buildFormData(user)
          setFormData(fresh)
          setSavedData(fresh)
        }
      } finally {
        if (isMounted) setLoadingProfile(false)
      }
    }
    fetchProfileFromApi()
    return () => { isMounted = false }
  }, [])

  // Clinic Record Readiness: compute strictly from saved database values, not local form state
  const completeness = useMemo(() => {
    const source = savedData || formData
    if (!source) return 0
    const fields = [
      source.first_name, source.last_name, source.student_id, source.grade_level,
      source.section, source.date_of_birth, source.sex, source.contact_no,
      source.address, source.guardian_name, source.guardian_contact,
      source.emergency_name, source.emergency_contact_no, source.blood_type,
      source.allergies, source.medical_history,
    ]
    const filled = fields.filter(f => f && String(f).trim().length > 0).length
    return Math.round((filled / fields.length) * 100)
  }, [savedData, formData])

  const passwordStrength = useMemo(() => {
    const p = passwordForm.password
    if (!p) return { score: 0, label: 'None', width: '0%' }
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    if (s <= 1) return { score: 1, label: 'Weak', width: '25%' }
    if (s === 2) return { score: 2, label: 'Fair', width: '50%' }
    if (s === 3) return { score: 3, label: 'Good', width: '75%' }
    return { score: 4, label: 'Strong', width: '100%' }
  }, [passwordForm.password])

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const handleCopyParentToEmergency = () => {
    setFormData(prev => ({
      ...prev,
      emergency_name: prev.guardian_name,
      emergency_relationship: prev.guardian_relationship,
      emergency_contact_no: prev.guardian_contact,
      emergency_alt_contact: prev.contact_no,
    }))
    toast.success('Copied parent/guardian details into emergency contact.')
  }

  const handleToggleAllergyTag = (tag) => {
    let current = formData.allergies ? formData.allergies.split(',').map(s => s.trim()).filter(Boolean) : []
    if (tag === 'None Known') { handleChange('allergies', 'None Known'); return }
    current = current.filter(item => item !== 'None Known')
    if (current.includes(tag)) current = current.filter(item => item !== tag)
    else current.push(tag)
    handleChange('allergies', current.join(', '))
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
    setShowEmailPassword(false)
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
    if (!formData.last_name?.trim()) errors.last_name = 'Last name is required.'
    const emailChanged = formData.email?.trim().toLowerCase() !== user?.email?.trim().toLowerCase()
    if (emailChanged) {
      if (!formData.email?.trim()) errors.email = 'Email address is required.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.email = 'Please enter a valid email address.'
      else if (!/@urios\.edu\.ph$/i.test(formData.email.trim())) errors.email = 'Email must end with @urios.edu.ph.'
      if (!formData.emailPassword) errors.emailPassword = 'Enter your current password to confirm email change.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors); toast.error(Object.values(errors)[0]); return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      const fullName = formatFullName(formData.first_name, formData.middle_name, formData.last_name, formData.suffix)
      const payload = {
        ...formData, name: fullName,
        first_name: formData.first_name?.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name?.trim(),
        suffix: formData.suffix?.trim() || null,
        email: formData.email?.trim(),
        current_password: emailChanged ? formData.emailPassword : undefined,
      }
      const res = await authApi.updateProfile(payload)
      const freshUser = res.data?.user || res.data
      const updated = buildFormData(freshUser)
      setFormData(updated)
      setSavedData(updated)
      if (res.data?.user) updateUser(res.data.user)
      if (typeof refreshUser === 'function') await refreshUser()
      toast.success('Profile saved successfully.')
      setIsEditing(false)
      setShowEmailPassword(false)
    } catch (err) {
      const backendErrors = getFieldErrors(err)
      if (Object.keys(backendErrors).length > 0) setFieldErrors(backendErrors)
      toast.error(getApiErrorMessage(err, 'Failed to save profile. Please check your inputs and try again.'))
    } finally { setSaving(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwordForm.current_password) { toast.error('Please enter your current password.'); return }
    if (!checkPasswordRules(passwordForm.password)) { toast.error('New password does not meet all requirements. Check the checklist below.'); return }
    if (passwordForm.password !== passwordForm.password_confirmation) { toast.error('New passwords do not match.'); return }
    setChangingPassword(true)
    try {
      await authApi.changePassword(passwordForm)
      toast.success('Password updated successfully.')
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
      setShowChangePassword(false)
    } catch (err) {
      const msg = err.response?.data?.errors?.current_password?.[0] || err.response?.data?.message || 'Failed to update password.'
      toast.error(msg)
    } finally { setChangingPassword(false) }
  }

  const ro = !isEditing
  const displayData = isEditing ? formData : (savedData || formData)

  return (
    <DashboardLayout title="My Profile" subtitle="View and manage your student profile and clinic records.">
      <div className="profile-container">

        {/* HERO HEADER */}
        <div className="profile-hero-card">
          <div className="profile-hero-left">
            <div
              className="profile-avatar-wrapper"
              onClick={() => isEditing && pickPhoto()}
              title={isEditing ? 'Click to change profile photo' : undefined}
              style={{ cursor: isEditing ? 'pointer' : 'default' }}
            >
              <Avatar src={user?.avatar_url} name={displayData.name} className="profile-avatar-img" fallbackText={displayData.name?.[0]?.toUpperCase() || 'S'} alt="Profile" />
              {isEditing && (
                <div className="profile-avatar-overlay" title="Upload Photo">
                  <ProfileIcon name="camera" size={13} />
                </div>
              )}
            </div>
            <div className="profile-hero-details">
              <h2>{formatFullName(displayData.first_name, displayData.middle_name, displayData.last_name, displayData.suffix) || displayData.name || 'Student Name'}</h2>
              <div className="profile-hero-meta-primary">
                ID: {displayData.student_id || 'Not set'} · Email: {displayData.email}
              </div>
              <div className="profile-hero-meta-academic">
                {[displayData.grade_level, displayData.section ? `Sec. ${displayData.section}` : null, displayData.school_year ? `S.Y. ${displayData.school_year}` : null].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div className="profile-hero-actions">
            <div className="profile-completeness-box">
              <div className="completeness-header">
                <span>Clinic Record Readiness</span>
                <span style={{ fontWeight: 700 }}>{completeness}%</span>
              </div>
              <div className="completeness-bar">
                <div className="completeness-fill" style={{ width: `${completeness}%` }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowPrintModal(true)}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}>
                <ProfileIcon name="print" size={14} /> Print Health Card
              </button>
              {!isEditing ? (
                <button type="button" className="btn-primary" onClick={handleStartEdit} disabled={loadingProfile}
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
                  <ProfileIcon name="edit" size={14} /> Edit Profile
                </button>
              ) : (
                <>
                  <button type="button" className="btn-secondary" onClick={handleCancelEdit} disabled={saving}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}>
                    <ProfileIcon name="x" size={14} /> Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={handleSaveProfile} disabled={saving}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {photoUi}

        {/* TABS */}
        <div className="profile-nav-tabs-wrap">
          <div className="profile-tab-list">
            {[
              { key: 'student', icon: 'user', label: 'Student Profile' },
              { key: 'parent', icon: 'parent', label: 'Parent / Guardian' },
              { key: 'emergency', icon: 'phoneCall', label: 'Emergency Contact' },
              { key: 'health', icon: 'health', label: 'Health Information' },
              { key: 'account', icon: 'lock', label: 'Account & Security' },
              { key: 'all', icon: 'grid', label: 'Overview (All Sections)' },
            ].map(tab => (
              <button key={tab.key}
                className={`profile-tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.key)}>
                <ProfileIcon name={tab.icon} size={15} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 1: STUDENT PROFILE */}
        {(activeTab === 'student' || activeTab === 'all') && (
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-group">
                <div className="profile-card-icon-wrap"><ProfileIcon name="user" size={18} /></div>
                <div>
                  <h3 className="profile-card-title">Student Profile</h3>
                  <p className="profile-card-subtitle">Basic identification, grade level, section, and contact information.</p>
                </div>
              </div>
            </div>
            <div className="profile-form-grid">
              {/* Photo */}
              <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Profile Photo {isEditing && <span className="optional">PNG, JPG or WEBP. You can crop it after choosing.</span>}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <Avatar src={user?.avatar_url} name={formData.name} size={48} alt="Avatar"
                    fallbackText={formData.name?.[0]?.toUpperCase() || 'S'}
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

              <div className="profile-field-group">
                <label>Student ID Number</label>
                <input type="text" className="profile-input" value={formData.student_id}
                  onChange={e => handleChange('student_id', e.target.value)} disabled={ro} />
              </div>

              <NameFields values={formData} onChange={(field, val) => handleChange(field, val)}
                errors={fieldErrors} inputClassName="profile-input" groupClassName="profile-field-group"
                rowClassName="" idPrefix="student" disabled={ro} />

              <div className="profile-field-group">
                <label>Date of Birth</label>
                <input type="date" className="profile-input" value={formData.date_of_birth}
                  onChange={e => {
                    const dob = e.target.value
                    handleChange('date_of_birth', dob)
                    if (dob) {
                      const today = new Date(), birth = new Date(dob)
                      let age = today.getFullYear() - birth.getFullYear()
                      const m = today.getMonth() - birth.getMonth()
                      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
                      handleChange('age', age)
                    }
                  }}
                  max={new Date().toISOString().split('T')[0]} disabled={ro} />
              </div>

              <div className="profile-field-group">
                <label>Age <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: '0.78rem' }}>(auto-computed)</span></label>
                <input type="text" className="profile-input readonly" value={formData.age ? `${formData.age} years old` : EMPTY} readOnly disabled />
              </div>

              <div className="profile-field-group">
                <label>Sex</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  ariaLabel="Sex"
                  value={formData.sex}
                  onChange={v => { handleChange('sex', v); handleChange('gender', v) }} disabled={ro}
                  options={[
                    { value: '', label: 'Select sex' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                  ]}
                  placeholder="Select sex" />
              </div>

              <div className="profile-field-group">
                <label>Grade Level</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  value={formData.grade_level || ''}
                  onChange={v => handleChange('grade_level', v)} disabled={ro}
                  options={[{ value: '', label: 'Select grade level' }, ...dbGradeLevels]}
                  placeholder="Select grade level" />
              </div>

              <div className="profile-field-group">
                <label>Section</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  value={formData.section || ''}
                  onChange={v => handleChange('section', v)} disabled={ro}
                  options={[
                    { value: '', label: 'Select section' },
                    ...dbSections.filter(s => s.grade_level === formData.grade_level).map(sec => ({
                      value: sec.name,
                      label: `${sec.name}${sec.strand ? ` (${sec.strand})` : ''}`,
                    })),
                  ]}
                  placeholder="Select section" />
              </div>

              <div className="profile-field-group">
                <label>School Year</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  ariaLabel="School year"
                  value={formData.school_year}
                  onChange={v => handleChange('school_year', v)} disabled={ro}
                  options={[{ value: '', label: 'Select school year' }, ...SCHOOL_YEARS.map(sy => ({ value: sy, label: sy }))]}
                  placeholder="Select school year" />
              </div>

              <div className="profile-field-group">
                <label>Contact Number</label>
                <input type="tel"
                  className={`profile-input ${formData.contact_no && validateMobile(formData.contact_no) ? 'input-error' : ''}`}
                  value={formData.contact_no} onChange={e => handleChange('contact_no', e.target.value)}
                  inputMode="numeric" maxLength={11} disabled={ro} />
                {(() => {
                  const err = formData.contact_no ? validateMobile(formData.contact_no) : null
                  const digits = formData.contact_no?.replace(/\D/g, '') || ''
                  const valid = digits.length === 11 && digits.startsWith('09')
                  if (err) return <span className="field-error" style={{ fontSize: '0.75rem' }}>{err}</span>
                  if (valid) return <span className="field-success" style={{ fontSize: '0.75rem' }}>Valid Philippine mobile number</span>
                  return null
                })()}
              </div>

              <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Complete Address</label>
                <textarea className="profile-textarea" value={formData.address}
                  onChange={e => handleChange('address', e.target.value)} rows={2} disabled={ro} />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: PARENT / GUARDIAN */}
        {(activeTab === 'parent' || activeTab === 'all') && (
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-group">
                <div className="profile-card-icon-wrap"><ProfileIcon name="parent" size={18} /></div>
                <div>
                  <h3 className="profile-card-title">Parent / Guardian Profile</h3>
                  <p className="profile-card-subtitle">Primary parent or legal guardian details for school clinic communications.</p>
                </div>
              </div>
            </div>
            <div className="profile-form-grid">
              <div className="profile-field-group">
                <label>Parent / Guardian Name</label>
                <input type="text" className="profile-input" value={formData.guardian_name}
                  onChange={e => handleChange('guardian_name', e.target.value)} disabled={ro} />
              </div>
              <div className="profile-field-group">
                <label>Relationship to Student</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  value={formData.guardian_relationship || ''}
                  onChange={v => handleChange('guardian_relationship', v)} disabled={ro}
                  options={[{ value: '', label: 'Select relationship' }, ...RELATIONSHIPS]}
                  placeholder="Select relationship" />
              </div>
              <div className="profile-field-group">
                <label>Contact Number</label>
                <input type="text" className="profile-input" value={formData.guardian_contact}
                  onChange={e => handleChange('guardian_contact', e.target.value)} disabled={ro} />
              </div>
              <div className="profile-field-group">
                <label>Email Address</label>
                <input type="email" className="profile-input" value={formData.guardian_email}
                  onChange={e => handleChange('guardian_email', e.target.value)} disabled={ro} />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: EMERGENCY CONTACT */}
        {(activeTab === 'emergency' || activeTab === 'all') && (
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-group">
                <div className="profile-card-icon-wrap"><ProfileIcon name="phoneCall" size={18} /></div>
                <div>
                  <h3 className="profile-card-title">Emergency Contact</h3>
                  <p className="profile-card-subtitle">Designated contact person for urgent medical situations.</p>
                </div>
              </div>
              {isEditing && (
                <button type="button" className="btn-secondary" onClick={handleCopyParentToEmergency}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                  <ProfileIcon name="copy" size={13} /> Copy from Parent/Guardian
                </button>
              )}
            </div>
            <div className="profile-form-grid">
              <div className="profile-field-group">
                <label>Emergency Contact Name</label>
                <input type="text" className="profile-input" value={formData.emergency_name}
                  onChange={e => handleChange('emergency_name', e.target.value)} disabled={ro} />
              </div>
              <div className="profile-field-group">
                <label>Relationship to Student</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  value={formData.emergency_relationship || ''}
                  onChange={v => handleChange('emergency_relationship', v)} disabled={ro}
                  options={[{ value: '', label: 'Select relationship' }, ...RELATIONSHIPS]}
                  placeholder="Select relationship" />
              </div>
              <div className="profile-field-group">
                <label>Contact Number</label>
                <input type="tel"
                  className={`profile-input ${formData.emergency_contact_no && validateMobile(formData.emergency_contact_no) ? 'input-error' : ''}`}
                  value={formData.emergency_contact_no}
                  onChange={e => handleChange('emergency_contact_no', e.target.value)}
                  inputMode="numeric" maxLength={11} disabled={ro} />
                {(() => {
                  const err = formData.emergency_contact_no ? validateMobile(formData.emergency_contact_no) : null
                  const digits = formData.emergency_contact_no?.replace(/\D/g, '') || ''
                  const valid = digits.length === 11 && digits.startsWith('09')
                  if (err) return <span className="field-error" style={{ fontSize: '0.75rem' }}>{err}</span>
                  if (valid) return <span className="field-success" style={{ fontSize: '0.75rem' }}>Valid Philippine mobile number</span>
                  return null
                })()}
              </div>
              <div className="profile-field-group">
                <label>Alternative Contact Number</label>
                <input type="text" className="profile-input" value={formData.emergency_alt_contact}
                  onChange={e => handleChange('emergency_alt_contact', e.target.value)} disabled={ro} />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: HEALTH INFORMATION */}
        {(activeTab === 'health' || activeTab === 'all') && (
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-group">
                <div className="profile-card-icon-wrap"><ProfileIcon name="health" size={18} /></div>
                <div>
                  <h3 className="profile-card-title">Health Information</h3>
                  <p className="profile-card-subtitle">Medical history, allergies, blood type, and current medications.</p>
                </div>
              </div>
            </div>
            <div className="profile-form-grid">
              <div className="profile-field-group">
                <label>Blood Type</label>
                <Dropdown variant="plain" className={`profile-input${ro ? ' readonly' : ''}`}
                  value={formData.blood_type || ''}
                  onChange={v => handleChange('blood_type', v)} disabled={ro}
                  options={[{ value: '', label: 'Select blood type' }, ...BLOOD_TYPES]}
                  placeholder="Select blood type" />
              </div>
              <div className="profile-field-group">
                <label>Medical Conditions</label>
                <input type="text" className="profile-input" value={formData.medical_conditions}
                  onChange={e => handleChange('medical_conditions', e.target.value)} disabled={ro} />
              </div>
              <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Allergies {isEditing && <span className="optional">Select from common items or type manually</span>}</label>
                <input type="text" className="profile-input" value={formData.allergies}
                  onChange={e => handleChange('allergies', e.target.value)} disabled={ro} />
                {isEditing && (
                  <div className="quick-tag-wrap">
                    {COMMON_ALLERGIES.map(tag => {
                      const isSelected = formData.allergies?.toLowerCase().includes(tag.toLowerCase())
                      return (
                        <button key={tag} type="button"
                          className={`quick-tag-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleAllergyTag(tag)}>
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Current Medications</label>
                <textarea className="profile-textarea" value={formData.current_medications}
                  onChange={e => handleChange('current_medications', e.target.value)} rows={2} disabled={ro} />
              </div>
              <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Medical History</label>
                <textarea className="profile-textarea" value={formData.medical_history}
                  onChange={e => handleChange('medical_history', e.target.value)} rows={2} disabled={ro} />
              </div>
              <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Other Health Notes</label>
                <textarea className="profile-textarea" value={formData.other_health_notes}
                  onChange={e => handleChange('other_health_notes', e.target.value)} rows={2} disabled={ro} />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: ACCOUNT & SECURITY */}
        {(activeTab === 'account' || activeTab === 'all') && (
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="profile-card-title-group">
                <div className="profile-card-icon-wrap"><ProfileIcon name="lock" size={18} /></div>
                <div>
                  <h3 className="profile-card-title">Account Information</h3>
                  <p className="profile-card-subtitle">Email address and password settings.</p>
                </div>
              </div>
            </div>

            <div className="profile-form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="profile-field-group">
                <label>Email Address <span style={{ color: '#DC2626' }}>*</span></label>
                <input type="email" id="student-email"
                  className={`profile-input${fieldErrors.email ? ' error' : ''}`}
                  value={formData.email} onChange={e => handleChange('email', e.target.value)}
                  required disabled={ro} />
                {fieldErrors.email && (
                  <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.2rem', display: 'block' }}>
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              {isEditing && formData.email?.trim().toLowerCase() !== user?.email?.trim().toLowerCase() && (
                <div className="profile-field-group" style={{ gridColumn: '1 / -1' }}>
                  <label>
                    Current Password <span style={{ color: '#DC2626' }}>*</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748B', marginLeft: '0.5rem' }}>
                      (Required to confirm email address change)
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type={showEmailPassword ? 'text' : 'password'} id="student-email-password"
                      className={`profile-input${fieldErrors.emailPassword ? ' error' : ''}`}
                      value={formData.emailPassword} onChange={e => handleChange('emailPassword', e.target.value)}
                      required style={{ paddingRight: '2.5rem' }} />
                    <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex', alignItems: 'center' }}
                      tabIndex={-1}>
                      <ProfileIcon name={showEmailPassword ? 'eyeOff' : 'eye'} size={15} />
                    </button>
                  </div>
                  {fieldErrors.emailPassword && (
                    <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.2rem', display: 'block' }}>
                      {fieldErrors.emailPassword}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Change Password Sub-Section */}
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
                    Password must be at least 8 characters long.
                  </p>
                  <div className="profile-form-grid">
                    <div className="profile-field-group">
                      <label>Current Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPasswords.current ? 'text' : 'password'} className="profile-input"
                          value={passwordForm.current_password}
                          onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                          autoComplete="current-password"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                          required style={{ paddingRight: '2.5rem' }} />
                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', padding: 0, cursor: 'pointer' }}>
                          <ProfileIcon name={showPasswords.current ? 'eyeOff' : 'eye'} size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="profile-field-group">
                      <label>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPasswords.new ? 'text' : 'password'} className="profile-input"
                          value={passwordForm.password}
                          onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })}
                          autoComplete="new-password"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                          required style={{ paddingRight: '2.5rem' }} />
                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', padding: 0, cursor: 'pointer' }}>
                          <ProfileIcon name={showPasswords.new ? 'eyeOff' : 'eye'} size={15} />
                        </button>
                      </div>
                      <PasswordStrength password={passwordForm.password} visible={passwordForm.password.length > 0} />
                    </div>
                    <div className="profile-field-group">
                      <label>Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPasswords.confirm ? 'text' : 'password'} className="profile-input"
                          value={passwordForm.password_confirmation}
                          onChange={e => setPasswordForm({ ...passwordForm, password_confirmation: e.target.value })}
                          autoComplete="new-password"
                          onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                          required style={{ paddingRight: '2.5rem' }} />
                        <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', padding: 0, cursor: 'pointer' }}>
                          <ProfileIcon name={showPasswords.confirm ? 'eyeOff' : 'eye'} size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {passwordForm.password && (
                    <div className="password-strength-wrap" style={{ marginTop: '0.65rem' }}>
                      <span className="strength-text">Strength: {passwordStrength.label}</span>
                      <div className="strength-bar-track">
                        <div className="strength-bar-fill" style={{ width: passwordStrength.width }} />
                      </div>
                    </div>
                  )}

                  <div className="pw-form-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn-primary" disabled={changingPassword}
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}>
                      {changingPassword ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

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
                <button type="button" className="btn-secondary"
                  onClick={() => { setShowDiscardModal(false); setPendingTab(null) }}>Keep Editing</button>
                <button type="button" className="btn-primary" style={{ background: '#DC2626' }}
                  onClick={handleDiscardConfirm}>Discard Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT HEALTH CARD MODAL */}
      {showPrintModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPrintModal(false)}>
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2>Student Health Profile Summary</h2>
              <button className="modal-close" onClick={() => setShowPrintModal(false)}>&#x2715;</button>
            </div>
            <div className="modal-body">
              <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '1.25rem', background: '#FFFFFF' }}>
                <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.85rem', marginBottom: '0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: '#2563EB', textTransform: 'uppercase' }}>
                    Fr. Saturnino Urios University · School Clinic
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0.2rem 0' }}>
                    {formatFullName(formData.first_name, formData.middle_name, formData.last_name, formData.suffix) || formData.name || 'Student Name'}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    ID: {formData.student_id} · {formData.grade_level} · Sec. {formData.section} · S.Y. {formData.school_year}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.82rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>Student &amp; Guardian Details</div>
                    <p style={{ margin: '0.15rem 0' }}><strong>DOB:</strong> {formData.date_of_birth || EMPTY}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Age:</strong> {formData.age ? `${formData.age} years old` : EMPTY}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Sex:</strong> {formData.gender === 'female' ? 'Female' : 'Male'}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Parent/Guardian:</strong> {formData.guardian_name} ({formData.guardian_relationship})</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Parent Phone:</strong> {formData.guardian_contact}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Emergency Contact:</strong> {formData.emergency_name} ({formData.emergency_contact_no})</p>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>Health &amp; Medical Info</div>
                    <p style={{ margin: '0.15rem 0' }}><strong>Blood Type:</strong> {formData.blood_type || EMPTY}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Allergies:</strong> {formData.allergies || 'None Reported'}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Conditions:</strong> {formData.medical_conditions || 'None'}</p>
                    <p style={{ margin: '0.15rem 0' }}><strong>Medications:</strong> {formData.current_medications || 'None'}</p>
                  </div>
                  <div style={{ gridColumn: '1 / -1', marginTop: '0.35rem', background: '#F8FAFC', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <strong>Clinic Notes:</strong> {formData.other_health_notes || 'No special dietary or physical activity restrictions.'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPrintModal(false)}>Close</button>
                <button type="button" className="btn-primary" onClick={() => window.print()}>Print Health Card</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
