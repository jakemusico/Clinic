import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'
import SearchToolbar from '../../components/SearchToolbar'
import { adminApi } from '../../api/admin'
import { useSectionsAndGradeLevels } from '../../hooks/useReferenceData'
import { DEPARTMENTS, GRADE_LEVELS } from '../../constants/schoolData'
import Avatar from '../../components/Avatar'
import MobileInput, { isMobileValid, validateMobile } from '../../components/MobileInput'
import useSubmitLock from '../../hooks/useSubmitLock'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLE_LABELS = {
  student:       'Student',
  faculty_staff: 'Faculty / Staff',
  clinic_staff:  'Nurse',
  dentist:       'Dentist',
  admin:         'Administrator',
}

const ROLE_COLORS = {
  student:       'role-blue',
  faculty_staff: 'role-teal',
  clinic_staff:  'role-purple',
  dentist:       'role-teal',
  admin:         'role-gold',
}

// Which roles show Title field
const ROLES_WITH_TITLE = ['clinic_staff', 'dentist', 'faculty_staff', 'admin']

// ---------------------------------------------------------------------------
// Password validation helpers
// ---------------------------------------------------------------------------
function pwRules(pw) {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    digit:   /[0-9]/.test(pw),
    special: /[@#$!%*?&]/.test(pw),
  }
}

function allPwValid(pw) {
  const r = pwRules(pw)
  return Object.values(r).every(Boolean)
}

// ---------------------------------------------------------------------------
// Blank form state (all possible fields)
// ---------------------------------------------------------------------------
function blankForm(role = 'student') {
  return {
    title: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role,
    // Student
    student_id: '',
    grade_level: '',
    section: '',
    // Non-student shared
    department: '',
    // Nurse / Dentist
    license_no: '',
    // Dentist only
    specialization: '',
    // Admin
    has_medical_access: false,
    contact_no: '',
  }
}

// ---------------------------------------------------------------------------
// Inline validation
// ---------------------------------------------------------------------------
function validateForm(form, mode) {
  const errs = {}
  if (!form.first_name.trim()) errs.first_name = 'Required.'
  if (!form.last_name.trim())  errs.last_name  = 'Required.'
  if (!form.email.trim())      errs.email      = 'Required.'
  else if (!/^[^\s@]+@urios\.edu\.ph$/i.test(form.email.trim()))
    errs.email = 'Must be a @urios.edu.ph address.'

  if (mode === 'add') {
    if (!form.password) {
      errs.password = 'Password is required.'
    } else if (!allPwValid(form.password)) {
      errs.password = 'Password does not meet requirements.'
    }
    if (!form.password_confirmation) {
      errs.password_confirmation = 'Please confirm the password.'
    } else if (form.password !== form.password_confirmation) {
      errs.password_confirmation = 'Passwords do not match.'
    }
  } else if (form.password) {
    if (!allPwValid(form.password)) {
      errs.password = 'Password does not meet requirements.'
    }
    if (form.password !== form.password_confirmation) {
      errs.password_confirmation = 'Passwords do not match.'
    }
  }

  if (!isMobileValid(form.contact_no)) errs.contact_no = validateMobile(form.contact_no)

  if (form.role === 'student') {
    if (!form.student_id.trim()) errs.student_id  = 'Student ID is required.'
    if (!form.grade_level)       errs.grade_level = 'Required.'
    if (!form.section)           errs.section     = 'Required.'
  } else {
    if (!form.student_id.trim()) errs.student_id = 'Employee ID is required.'
  }

  return errs
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Password & Confirm Password section with eye toggle & checklist
// ---------------------------------------------------------------------------
function PasswordSection({ password, confirmPassword, onPasswordChange, onConfirmChange, mode, errors }) {
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const rules = pwRules(password || '')

  const RuleLine = ({ ok, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: ok ? 'var(--success, #22c55e)' : 'var(--text-muted)' }}>
      {ok
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
      }
      <span style={{ fontSize: '0.72rem' }}>{label}</span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {/* Password field */}
      <div className="form-group">
        <label className="form-label">
          {mode === 'add' ? 'Password *' : 'Reset Password (leave blank to keep)'}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="form-password"
            type={showPw ? 'text' : 'password'}
            className={`form-input${errors.password ? ' input-error' : ''}`}
            style={{ paddingRight: '2.4rem' }}
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            required={mode === 'add'}
            autoComplete="new-password"
          />
          <button
            type="button"
            title={showPw ? 'Hide password' : 'Show password'}
            onClick={() => setShowPw(s => !s)}
            style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}
          >
            <EyeIcon open={showPw} />
          </button>
        </div>
        {errors.password && <span className="field-error">{errors.password}</span>}

        {password && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem', marginTop: '0.4rem' }}>
            <RuleLine ok={rules.length}  label="8+ characters" />
            <RuleLine ok={rules.upper}   label="Uppercase" />
            <RuleLine ok={rules.lower}   label="Lowercase" />
            <RuleLine ok={rules.digit}   label="Number" />
            <RuleLine ok={rules.special} label="Special character" />
          </div>
        )}

        {mode === 'add' && (
          <p style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            The user will be required to change this password on first login.
          </p>
        )}
      </div>

      {/* Confirm Password field */}
      <div className="form-group">
        <label className="form-label">
          {mode === 'add' ? 'Confirm Password *' : 'Confirm New Password'}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="form-password-confirmation"
            type={showConfirm ? 'text' : 'password'}
            className={`form-input${errors.password_confirmation ? ' input-error' : ''}`}
            style={{ paddingRight: '2.4rem' }}
            value={confirmPassword}
            onChange={e => onConfirmChange(e.target.value)}
            required={mode === 'add' || !!password}
            autoComplete="new-password"
          />
          <button
            type="button"
            title={showConfirm ? 'Hide password' : 'Show password'}
            onClick={() => setShowConfirm(s => !s)}
            style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}
          >
            <EyeIcon open={showConfirm} />
          </button>
        </div>
        {errors.password_confirmation && <span className="field-error">{errors.password_confirmation}</span>}
        {confirmPassword && password && !errors.password_confirmation && (
          password === confirmPassword ? (
            <span className="field-success" style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              Passwords match
            </span>
          ) : (
            <span className="field-error" style={{ marginTop: '0.35rem' }}>
              Passwords do not match.
            </span>
          )
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function UsersPage() {
  const { user: authUser } = useAuth()
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)   // null | 'add' | 'edit'
  const [selected,   setSelected]   = useState(null)
  const [statusConfirm, setStatusConfirm] = useState({ open: false, user: null, loading: false })
  const [form,       setForm]       = useState(blankForm())
  const [errors,     setErrors]     = useState({})
  const [saving,     setSaving]     = useState(false)
  const saveLock   = useSubmitLock()
  const statusLock = useSubmitLock()
  const [search,     setSearch]     = useState(initialSearch)
  const [filterRole, setFilterRole] = useState('all')
  const [filterStat, setFilterStat] = useState('all')
  const [page,       setPage]       = useState(1)
  const [pageSize,   setPageSize]   = useState(10)
  const [lastPage,   setLastPage]   = useState(1)
  const [total,      setTotal]      = useState(0)

  useEffect(() => {
    const q = searchParams.get('search')
    if (q !== null) {
      setSearch(q)
      setPage(1)
    }
  }, [searchParams])

  // Sections / grade-levels fetched from DB (same source as Register page)
  const { sections: dbSections, gradeLevels: dbGradeLevels } = useSectionsAndGradeLevels()

  // Sections filtered by selected grade level
  const sectionsForLevel = form.grade_level
    ? dbSections.filter(s => s.grade_level === form.grade_level || !s.grade_level)
    : dbSections

  // ---------------------------------------------------------------------------
  // Load users
  // ---------------------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.listUsers({ page, per_page: pageSize, search, role: filterRole, status: filterStat })
      setUsers(data.data || [])
      setLastPage(data.last_page || 1)
      setTotal(data.total || 0)
    } catch {
      toast.error('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filterRole, filterStat])

  useEffect(() => { load() }, [page, pageSize, search, filterRole, filterStat])

  // ---------------------------------------------------------------------------
  // Open modals
  // ---------------------------------------------------------------------------
  const openAdd = () => {
    setForm(blankForm('student'))
    setErrors({})
    setModal('add')
  }

  const openEdit = (user) => {
    setSelected(user)
    setForm({
      title:                 user.title || '',
      first_name:            user.first_name || '',
      middle_name:           user.middle_name || '',
      last_name:             user.last_name || '',
      email:                 user.email || '',
      password:              '',
      password_confirmation: '',
      role:                  user.role || 'student',
      student_id:            user.student_id || '',
      grade_level:           user.grade_level || '',
      section:               user.section || '',
      department:            user.department || '',
      license_no:            user.license_no || '',
      specialization:        user.specialization || '',
      has_medical_access:    !!user.has_medical_access,
      contact_no:            user.contact_no || '',
    })
    setErrors({})
    setModal('edit')
  }

  // ---------------------------------------------------------------------------
  // Field change — clear role-specific fields when role changes
  // ---------------------------------------------------------------------------
  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }

      if (field === 'role') {
        // Clear role-specific fields
        next.title          = ''
        next.student_id     = ''
        next.grade_level    = ''
        next.section        = ''
        next.department     = ''
        next.license_no     = ''
        next.specialization = ''
        next.has_medical_access = false
      }

      if (field === 'grade_level') {
        next.section = ''
      }

      return next
    })
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault()
    const errs = validateForm(form, modal)
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('Please fix the highlighted fields.')
      return
    }
    if (!saveLock.lock()) return   // already saving (double click / second Enter)
    setSaving(true)
    try {
      const payload = { ...form }
      delete payload.password_confirmation
      if (modal === 'edit' && !payload.password) delete payload.password
      if (modal === 'add') {
        await adminApi.createUser(payload)
        toast.success('Account created successfully!')
      } else {
        await adminApi.updateUser(selected.id, payload)
        toast.success('Account updated successfully!')
      }
      setModal(null)
      load()
    } catch (err) {
      const d = err?.response?.data
      if (d?.errors) {
        const flat = {}
        Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
        toast.error('Please fix the highlighted fields.')
      } else {
        toast.error(d?.message || 'Failed to save user account.')
      }
    } finally {
      setSaving(false)
      saveLock.unlock()
    }
  }

  const handleToggleStatus = (user) => {
    if (authUser && user.id === authUser.id && user.is_active) {
      toast.error('You cannot deactivate your own account.')
      return
    }
    setStatusConfirm({ open: true, user, loading: false })
  }

  const doToggleStatus = async () => {
    const targetUser = statusConfirm.user
    if (!targetUser) return
    const action = targetUser.is_active ? 'deactivate' : 'activate'
    if (!statusLock.lock()) return   // already running (double click)
    setStatusConfirm(prev => ({ ...prev, loading: true }))
    try {
      const { data } = await adminApi.toggleUserStatus(targetUser.id)
      toast.success(data?.message || `Account ${action}d successfully.`)
      if (data?.user) {
        setUsers(prev => prev.map(u => u.id === data.user.id ? { ...u, ...data.user } : u))
      } else {
        load()
      }
      setStatusConfirm({ open: false, user: null, loading: false })
    } catch (err) {
      toast.error(err?.response?.data?.message || `Failed to ${action} account.`)
      setStatusConfirm(prev => ({ ...prev, loading: false }))
    } finally {
      statusLock.unlock()
    }
  }

  // ---------------------------------------------------------------------------
  // Role-based field configuration
  // ---------------------------------------------------------------------------
  const role = form.role
  const isStudent    = role === 'student'
  const isNurse      = role === 'clinic_staff'
  const isDentist    = role === 'dentist'
  const isStaff      = role === 'faculty_staff'
  const isAdmin      = role === 'admin'
  const showTitle    = ROLES_WITH_TITLE.includes(role)
  const showDept     = !isStudent
  const showLicense  = isNurse || isDentist
  const showSpec     = isDentist
  const idLabel      = isStudent ? 'Student ID *' : 'Employee ID *'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <DashboardLayout title="User Management" subtitle="Manage accounts, system roles, and access permissions.">

      {/* Toolbar */}
      <div className="page-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
        <SearchToolbar
          value={search}
          onChange={(val) => { setSearch(val); setPage(1) }}
          placeholder="Search by name, email, ID..."
        />

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: '150px' }}>
            <Dropdown
              id="user-filter-role"
              variant="filter"
              value={filterRole}
              onChange={v => { setFilterRole(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Roles' },
                { value: 'student', label: 'Students' },
                { value: 'faculty_staff', label: 'Faculty / Staff' },
                { value: 'clinic_staff', label: 'Nurse' },
                { value: 'dentist', label: 'Dentist' },
                { value: 'admin', label: 'Administrators' },
              ]}
            />
          </div>
          <div style={{ minWidth: '130px' }}>
            <Dropdown
              id="user-filter-status"
              variant="filter"
              ariaLabel="Status"
              value={filterStat}
              onChange={v => { setFilterStat(v); setPage(1) }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
          <button id="btn-create-user" className="btn-primary" onClick={openAdd}>
            + Create Account
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>No user accounts match the selected criteria.</p>
        </div>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.55 }}>
                    <td data-label="Name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <Avatar src={user.avatar_url} name={user.name} size={32} />
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
                      </div>
                    </td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Role">
                      <span className={`status-badge ${ROLE_COLORS[user.role] || 'role-blue'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td data-label="Details" style={{ fontSize: '0.81rem', color: 'var(--text-sub)' }}>
                      {user.student_id  && <div>ID: {user.student_id}</div>}
                      {user.department  && <div>Dept: {user.department}</div>}
                      {user.grade_level && <div>Grade: {user.grade_level} — {user.section}</div>}
                      {user.specialization && <div>Spec: {user.specialization}</div>}
                      {user.license_no  && <div>Lic: {user.license_no}</div>}
                    </td>
                    <td data-label="Status">
                      <span className={`status-badge ${user.is_active ? 'confirmed' : 'cancelled'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-secondary" onClick={() => openEdit(user)}>Edit</button>
                        <button
                          className={`btn-secondary${user.is_active ? '' : ' success'}`}
                          onClick={() => handleToggleStatus(user)}
                          disabled={user.id === authUser?.id && user.is_active}
                          title={user.id === authUser?.id && user.is_active ? 'You cannot deactivate your own account' : ''}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={lastPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setPage(1)
            }}
          />
        </>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Create User Account' : 'Edit User Account'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} noValidate>
              <div className="modal-body">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                  {/* ---- Account Role (always first, drives everything) ---- */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Account Role *</label>
                    <Dropdown
                      id="form-role"
                      ariaLabel="Account role"
                      value={form.role}
                      onChange={v => handleChange('role', v)}
                      options={[
                        { value: 'student', label: 'Student' },
                        { value: 'faculty_staff', label: 'Faculty / Staff' },
                        { value: 'clinic_staff', label: 'Nurse (Clinic Staff)' },
                        { value: 'dentist', label: 'Dentist' },
                        { value: 'admin', label: 'Administrator' },
                      ]}
                    />
                  </div>

                  {/* ---- Name row ---- */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: showTitle ? '90px 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '0.75rem' }}>
                      {showTitle && (
                        <div>
                          <label className="form-label">Title</label>
                          <input
                            className="form-input"
                            value={form.title}
                            onChange={e => handleChange('title', e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <label className="form-label">First Name *</label>
                        <input
                          id="form-first-name"
                          className={`form-input${errors.first_name ? ' input-error' : ''}`}
                          value={form.first_name}
                          onChange={e => handleChange('first_name', e.target.value)}
                        />
                        {errors.first_name && <span className="field-error">{errors.first_name}</span>}
                      </div>
                      <div>
                        <label className="form-label">Middle Name</label>
                        <input
                          className="form-input"
                          value={form.middle_name}
                          onChange={e => handleChange('middle_name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Last Name *</label>
                        <input
                          id="form-last-name"
                          className={`form-input${errors.last_name ? ' input-error' : ''}`}
                          value={form.last_name}
                          onChange={e => handleChange('last_name', e.target.value)}
                        />
                        {errors.last_name && <span className="field-error">{errors.last_name}</span>}
                      </div>
                    </div>
                  </div>

                  {/* ---- Email ---- */}
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                      id="form-email"
                      type="email"
                      className={`form-input${errors.email ? ' input-error' : ''}`}
                      value={form.email}
                      onChange={e => handleChange('email', e.target.value)}
                    />
                    {errors.email && <span className="field-error">{errors.email}</span>}
                  </div>

                  {/* ---- Contact Number ---- */}
                  <MobileInput
                    id="form-contact-no"
                    name="contact_no"
                    label="Contact Number"
                    labelClassName="form-label"
                    className="form-input"
                    value={form.contact_no}
                    onChange={e => handleChange('contact_no', e.target.value)}
                    error={errors.contact_no}
                  />

                  {/* ---- ID field (Student ID or Employee ID) ---- */}
                  <div className="form-group">
                    <label className="form-label">{idLabel}</label>
                    <input
                      id="form-student-id"
                      className={`form-input${errors.student_id ? ' input-error' : ''}`}
                      value={form.student_id}
                      onChange={e => handleChange('student_id', e.target.value)}
                    />
                    {errors.student_id && <span className="field-error">{errors.student_id}</span>}
                  </div>

                  {/* ---- Student: Grade Level ---- */}
                  {isStudent && (
                    <div className="form-group">
                      <label className="form-label">Grade Level *</label>
                      <Dropdown
                        id="form-grade-level"
                        invalid={Boolean(errors.grade_level)}
                        value={form.grade_level || ''}
                        onChange={v => handleChange('grade_level', v)}
                        options={[
                          { value: '', label: '— Select —' },
                          ...(dbGradeLevels.length > 0 ? dbGradeLevels : GRADE_LEVELS).map(gl => ({ value: gl.name || gl, label: gl.name || gl })),
                        ]}
                        placeholder="— Select —"
                      />
                      {errors.grade_level && <span className="field-error">{errors.grade_level}</span>}
                    </div>
                  )}

                  {/* ---- Student: Section ---- */}
                  {isStudent && (
                    <div className="form-group">
                      <label className="form-label">Section *</label>
                      <Dropdown
                        id="form-section"
                        invalid={Boolean(errors.section)}
                        value={form.section || ''}
                        onChange={v => handleChange('section', v)}
                        options={[
                          { value: '', label: '— Select —' },
                          ...sectionsForLevel.map(s => ({ value: s.name || s, label: s.name || s })),
                        ]}
                        placeholder="— Select —"
                        disabled={!form.grade_level}
                      />
                      {errors.section && <span className="field-error">{errors.section}</span>}
                    </div>
                  )}

                  {/* ---- Non-student: Department ---- */}
                  {showDept && (
                    <div className="form-group">
                      <label className="form-label">Department / Office</label>
                      <Dropdown
                        id="form-department"
                        value={form.department || ''}
                        onChange={v => handleChange('department', v)}
                        options={[{ value: '', label: '— Select —' }, ...DEPARTMENTS]}
                        placeholder="— Select —"
                      />
                    </div>
                  )}

                  {/* ---- Dentist: Specialization ---- */}
                  {showSpec && (
                    <div className="form-group">
                      <label className="form-label">Specialization</label>
                      <input
                        id="form-specialization"
                        className="form-input"
                        value={form.specialization}
                        onChange={e => handleChange('specialization', e.target.value)}
                      />
                    </div>
                  )}

                  {/* ---- Nurse / Dentist: License No ---- */}
                  {showLicense && (
                    <div className="form-group">
                      <label className="form-label">License No.</label>
                      <input
                        id="form-license-no"
                        className="form-input"
                        value={form.license_no}
                        onChange={e => handleChange('license_no', e.target.value)}
                      />
                    </div>
                  )}

                  {/* ---- Admin: Medical Access ---- */}
                  {isAdmin && (
                    <div
                      className="form-group"
                      style={{
                        gridColumn: '1 / -1',
                        border: '1px solid rgba(249,226,175,0.2)',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(249,226,175,0.04)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.has_medical_access}
                          onChange={e => handleChange('has_medical_access', e.target.checked)}
                          style={{ marginTop: '0.15rem', flexShrink: 0 }}
                        />
                        <span>
                          <span style={{ fontWeight: 600, color: '#f9e2af' }}>Grant Medical Record Access</span>
                          <br />
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Warning: This administrator will be able to view, read, and trace medical and dental history files.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  {/* ---- Password & Confirm Password ---- */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <PasswordSection
                      password={form.password}
                      confirmPassword={form.password_confirmation}
                      onPasswordChange={v => handleChange('password', v)}
                      onConfirmChange={v => handleChange('password_confirmation', v)}
                      mode={modal}
                      errors={errors}
                    />
                  </div>

                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button
                  type="submit"
                  id="btn-save-user"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : modal === 'add' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Deactivate / Activate Account Confirmation Modal */}
      <ConfirmModal
        open={statusConfirm.open}
        title={statusConfirm.user?.is_active ? 'Deactivate Account' : 'Activate Account'}
        message={
          statusConfirm.user
            ? `Are you sure you want to ${statusConfirm.user.is_active ? 'deactivate' : 'activate'} ${statusConfirm.user.name}'s account?`
            : ''
        }
        confirmLabel={statusConfirm.user?.is_active ? 'Deactivate' : 'Activate'}
        danger={!!statusConfirm.user?.is_active}
        loading={statusConfirm.loading}
        onConfirm={doToggleStatus}
        onCancel={() => setStatusConfirm({ open: false, user: null, loading: false })}
      />
    </DashboardLayout>
  )
}
