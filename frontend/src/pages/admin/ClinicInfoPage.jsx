import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import { adminApi } from '../../api/admin'

export default function ClinicInfoPage() {
  const navigate = useNavigate()
  const [savedForm, setSavedForm] = useState(null)
  const [form, setForm]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving]       = useState(false)

  // Unsaved changes confirm dialog state
  const [showConfirmModal, setShowConfirmModal]   = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/settings/clinic_info')
      .then(res => {
        if (res.data?.value) {
          const parsed = JSON.parse(res.data.value)
          setSavedForm(parsed)
          setForm(parsed)
        }
      })
      .catch(() => {
        toast.error('Failed to load clinic information from database.')
      })
      .finally(() => setLoading(false))
  }, [])

  // Check if there are unsaved edits
  const isDirty = Boolean(isEditing && form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm))

  // Intercept navigation if leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return

    // 1. Browser tab close or refresh
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // 2. Intercept internal navigation link clicks
    const handleLinkClick = (e) => {
      const anchor = e.target.closest('a')
      if (anchor && anchor.href) {
        try {
          const targetUrl = new URL(anchor.href, window.location.origin)
          if (targetUrl.origin === window.location.origin && targetUrl.pathname !== window.location.pathname) {
            e.preventDefault()
            e.stopPropagation()
            setPendingNavigation(targetUrl.pathname + targetUrl.search + targetUrl.hash)
            setShowConfirmModal(true)
          }
        } catch {
          // Ignore invalid URL parse
        }
      }
    }
    document.addEventListener('click', handleLinkClick, true)

    // 3. Browser Back / Forward buttons
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href)
      setPendingNavigation('__POPSTATE_BACK__')
      setShowConfirmModal(true)
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleLinkClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isDirty])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleToggleDay = (index) => {
    if (!isEditing) return
    setForm(prev => {
      const updatedSchedule = [...prev.schedule]
      const current = updatedSchedule[index]
      updatedSchedule[index] = {
        ...current,
        is_open: !current.is_open,
      }
      return { ...prev, schedule: updatedSchedule }
    })
  }

  const handleScheduleTimeChange = (index, field, value) => {
    setForm(prev => {
      const updatedSchedule = [...prev.schedule]
      updatedSchedule[index] = {
        ...updatedSchedule[index],
        [field]: value,
      }
      return { ...prev, schedule: updatedSchedule }
    })
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setForm(savedForm)
    setIsEditing(false)
  }

  const handleSubmit = (e) => {
    if (e) e.preventDefault()

    // 1. Validate schedule times (closing time must be later than opening time for open days)
    for (const row of form.schedule) {
      if (row.is_open) {
        if (!row.open_time || !row.close_time) {
          toast.error(`${row.day}: Opening and closing times are required when marked Open.`)
          return
        }
        if (row.close_time <= row.open_time) {
          toast.error(`${row.day}: Closing time must be later than opening time.`)
          return
        }
      }
    }

    // 2. Validate location and contact fields
    const requiredFields = [
      { key: 'location_name', label: 'Building name' },
      { key: 'location_address', label: 'Full address' },
      { key: 'location_landmark', label: 'Landmark / Room location' },
      { key: 'contact_trunkline', label: 'Clinic trunkline' },
      { key: 'contact_mobile', label: 'Mobile hotline' },
      { key: 'contact_email', label: 'Official email' },
    ]

    for (const field of requiredFields) {
      if (!form[field.key] || !form[field.key].trim()) {
        toast.error(`Please provide ${field.label}.`)
        return
      }
    }

    setSaving(true)
    adminApi.updateSetting('clinic_info', JSON.stringify(form))
      .then(() => {
        setSavedForm(form)
        setIsEditing(false)
        toast.success('Clinic information updated successfully.')
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to save clinic information to database.')
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const handleConfirmDiscard = () => {
    const target = pendingNavigation
    setShowConfirmModal(false)
    setIsEditing(false)
    setForm(savedForm)
    setPendingNavigation(null)

    if (target === '__POPSTATE_BACK__') {
      window.history.back()
    } else if (target) {
      navigate(target)
    }
  }

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false)
    setPendingNavigation(null)
  }

  const inputStyle = !isEditing ? {
    background: '#f8fafc',
    color: 'var(--text-sub)',
    cursor: 'not-allowed',
    borderColor: 'var(--border)',
  } : {
    background: '#ffffff',
  }

  return (
    <DashboardLayout
      title="Clinic Info"
      subtitle="Manage operating hours, campus location, and clinic contact lines."
    >
      {/* Page Header Actions */}
      <div className="page-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-sub)' }}>
            {isEditing ? 'Editing clinic information. All fields are required.' : 'Viewing clinic operating information.'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!isEditing ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleEdit}
              disabled={loading || !form}
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading || !form ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Clinic Hours Card - 7-Day Schedule */}
          <div className="data-table-wrap" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.2rem 0' }}>
                  Clinic Operating Hours
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Weekly schedule from Monday to Sunday. Toggle Open/Closed and configure hours.
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Day</th>
                    <th style={{ width: '150px' }}>Status</th>
                    <th style={{ width: '220px' }}>Opening Time</th>
                    <th style={{ width: '220px' }}>Closing Time</th>
                  </tr>
                </thead>
                <tbody>
                  {form.schedule.map((row, index) => {
                    const isOpen = Boolean(row.is_open)
                    const isFieldDisabled = !isEditing || !isOpen
                    return (
                      <tr key={row.day}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {row.day}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <button
                              type="button"
                              className={`toggle-switch ${isOpen ? 'on' : 'off'}`}
                              onClick={() => handleToggleDay(index)}
                              disabled={!isEditing}
                              style={{
                                cursor: isEditing ? 'pointer' : 'not-allowed',
                                opacity: !isEditing ? 0.65 : 1,
                              }}
                              title={isOpen ? 'Click to mark as Closed' : 'Click to mark as Open'}
                              aria-label={`Toggle ${row.day} status`}
                            >
                              <span className="toggle-knob" />
                            </button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isOpen ? 'var(--accent)' : 'var(--text-muted)' }}>
                              {isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <input
                            type="time"
                            value={row.open_time || '08:00'}
                            onChange={e => handleScheduleTimeChange(index, 'open_time', e.target.value)}
                            disabled={isFieldDisabled}
                            style={{
                              background: isFieldDisabled ? '#f8fafc' : '#ffffff',
                              color: isFieldDisabled ? 'var(--text-muted)' : 'var(--text)',
                              cursor: isFieldDisabled ? 'not-allowed' : 'text',
                              borderColor: 'var(--border)',
                              padding: '0.45rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem',
                              borderWidth: '1.5px',
                              borderStyle: 'solid',
                              outline: 'none',
                              width: '160px',
                              fontFamily: 'inherit',
                            }}
                            required={isOpen}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={row.close_time || '17:00'}
                            onChange={e => handleScheduleTimeChange(index, 'close_time', e.target.value)}
                            disabled={isFieldDisabled}
                            style={{
                              background: isFieldDisabled ? '#f8fafc' : '#ffffff',
                              color: isFieldDisabled ? 'var(--text-muted)' : 'var(--text)',
                              cursor: isFieldDisabled ? 'not-allowed' : 'text',
                              borderColor: 'var(--border)',
                              padding: '0.45rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem',
                              borderWidth: '1.5px',
                              borderStyle: 'solid',
                              outline: 'none',
                              width: '160px',
                              fontFamily: 'inherit',
                            }}
                            required={isOpen}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Optional Note field */}
            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label>Schedule Note <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Emergency on-call on weekends"
                value={form.schedule_note || ''}
                onChange={e => handleChange('schedule_note', e.target.value)}
                disabled={!isEditing}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Location Card */}
          <div className="data-table-wrap" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1rem 0' }}>
              Campus Location
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Institution / Building Name</label>
                <input
                  type="text"
                  value={form.location_name}
                  onChange={e => handleChange('location_name', e.target.value)}
                  disabled={!isEditing}
                  style={inputStyle}
                  required
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Full Address</label>
                <input
                  type="text"
                  value={form.location_address}
                  onChange={e => handleChange('location_address', e.target.value)}
                  disabled={!isEditing}
                  style={inputStyle}
                  required
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Landmark / Room Location</label>
                <input
                  type="text"
                  value={form.location_landmark}
                  onChange={e => handleChange('location_landmark', e.target.value)}
                  disabled={!isEditing}
                  style={inputStyle}
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Lines Card */}
          <div className="data-table-wrap" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1rem 0' }}>
              Contact Lines
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Clinic Trunkline</label>
                <input
                  type="text"
                  value={form.contact_trunkline}
                  onChange={e => handleChange('contact_trunkline', e.target.value)}
                  disabled={!isEditing}
                  style={inputStyle}
                  required
                />
              </div>
              <div className="form-group">
                <label>Mobile Hotline</label>
                <input
                  type="text"
                  value={form.contact_mobile}
                  onChange={e => handleChange('contact_mobile', e.target.value)}
                  disabled={!isEditing}
                  style={inputStyle}
                  required
                />
              </div>
              <div className="form-group">
                <label>Official Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => handleChange('contact_email', e.target.value)}
                  disabled={!isEditing}
                  style={inputStyle}
                  required
                />
              </div>
            </div>
          </div>

        </form>
      )}

      {/* Unsaved Changes Confirm Dialog */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={handleCloseConfirmModal}>
          <div className="modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Unsaved Changes</h2>
              <button className="modal-close" onClick={handleCloseConfirmModal} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.885rem', color: 'var(--text-sub)', lineHeight: 1.55 }}>
                You have unsaved changes. Are you sure you want to leave this page? Your unsaved edits will be discarded.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseConfirmModal}
              >
                Stay on Page
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDiscard}
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
