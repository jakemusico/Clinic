import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import ConfirmModal from '../../components/ConfirmModal'
import { schedulesApi } from '../../api/schedules'
import { useAuth } from '../../context/AuthContext'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
const DAY_FULL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }

function ScheduleModal({ entry, staffList, currentUser, isAdmin, onClose, onSaved, onDeleted }) {
  const isEdit = Boolean(entry?.id)
  
  const defaultUserId = entry?.user_id 
    || entry?.user?.id 
    || (isAdmin ? (staffList[0]?.id || '') : currentUser?.id)

  const [form, setForm] = useState({
    user_id:      defaultUserId,
    day_of_week:  entry?.day_of_week  || 'monday',
    start_time:   entry?.start_time?.slice(0, 5) || '08:00',
    end_time:     entry?.end_time?.slice(0, 5)   || '17:00',
    is_available: entry?.is_available ?? true,
    notes:        entry?.notes || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    if (isAdmin && !form.user_id) {
      setErrors({ user_id: 'Please select a staff member.' })
      setSaving(false)
      return
    }

    if (form.end_time <= form.start_time) {
      setErrors({ end_time: 'End time must be after start time.' })
      setSaving(false)
      return
    }

    const payload = {
      ...form,
      user_id: parseInt(form.user_id),
    }

    try {
      const { data } = isEdit
        ? await schedulesApi.update(entry.id, payload)
        : await schedulesApi.create(payload)
      toast.success(data.message)
      onSaved(data.schedule, isEdit)
    } catch (err) {
      const d = err?.response?.data
      if (d?.errors) {
        const flat = {}
        Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
      } else if (d?.conflict) {
        setErrors({ start_time: `Overlaps with existing ${d.conflict.start_time?.slice(0,5)}–${d.conflict.end_time?.slice(0,5)} schedule` })
        toast.error('Schedule overlaps with an existing entry for this staff member!')
      } else {
        toast.error(d?.message || 'Failed to save schedule.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    setConfirmDelete(true)
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      const { data } = await schedulesApi.remove(entry.id)
      toast.success(data.message)
      setConfirmDelete(false)
      onDeleted(entry.id)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Schedule Entry' : 'Add Schedule'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {/* ── 1. Staff Member Field (Above Day of Week) ── */}
          <div className="form-group">
            <label>Staff Member</label>
            {isAdmin ? (
              <select
                value={form.user_id}
                onChange={e => set('user_id', e.target.value)}
                className={errors.user_id ? 'input-error' : ''}
                required
              >
                <option value="" disabled>Select staff member</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role === 'dentist' ? 'Dentist' : 'Nurse'} ({s.email})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={`${currentUser?.name || 'Staff Member'} — ${currentUser?.role === 'dentist' ? 'Dentist' : 'Nurse'}`}
                style={{ background: 'var(--bg-crust)', cursor: 'not-allowed', color: 'var(--text)' }}
              />
            )}
            {errors.user_id && <span className="field-error">{errors.user_id}</span>}
          </div>

          {/* ── 2. Day of Week ── */}
          <div className="form-group">
            <label>Day of Week</label>
            <select value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)}>
              {DAYS.map(d => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
            </select>
          </div>

          {/* ── 3. Start & End Time ── */}
          <div className="form-row">
            <div className="form-group">
              <label>Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => set('start_time', e.target.value)}
                className={errors.start_time ? 'input-error' : ''}
                required
              />
              {errors.start_time && <span className="field-error">{errors.start_time}</span>}
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
                className={errors.end_time ? 'input-error' : ''}
                required
              />
              {errors.end_time && <span className="field-error">{errors.end_time}</span>}
            </div>
          </div>

          {/* ── 4. Availability Toggle ── */}
          <div className="form-group">
            <label className="toggle-label">
              <span>Availability</span>
              <button
                type="button"
                className={`toggle-switch ${form.is_available ? 'on' : 'off'}`}
                onClick={() => set('is_available', !form.is_available)}
              >
                <span className="toggle-knob" />
              </button>
              <span className={`status-badge ${form.is_available ? 'active' : 'inactive'}`}>
                {form.is_available ? 'Available' : 'Blocked'}
              </span>
            </label>
          </div>

          {/* ── 5. Notes ── */}
          <div className="form-group">
            <label>Notes (optional)</label>
            <input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="e.g. Morning clinic duty, Oral checkups"
            />
          </div>

          <div className="modal-footer">
            {isEdit && (
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? '…' : 'Delete'}
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : (isEdit ? 'Save Changes' : 'Add Schedule')}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete Schedule Entry"
        message="Are you sure you want to delete this schedule entry? This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function UnavailabilityModal({ staffList, currentUser, isAdmin, onClose, onAdded }) {
  const [userId, setUserId] = useState(() => (
    isAdmin ? (staffList[0]?.id || '') : currentUser?.id
  ))
  const [date, setDate]     = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        unavailable_date: date,
        reason,
        user_id: isAdmin ? parseInt(userId) : currentUser.id,
      }
      const { data } = await schedulesApi.addUnavailability(payload)
      toast.success(data.message)
      onAdded(data.unavailability)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to block date.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-sm">
        <div className="modal-header">
          <h2>Block a Date</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {isAdmin && (
            <div className="form-group">
              <label>Staff Member</label>
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                required
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role === 'dentist' ? 'Dentist' : 'Nurse'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Date to Block</label>
            <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Sick leave, Seminar, Holiday" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !date}>
              {saving ? <span className="btn-spinner" /> : 'Block Date'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SlotPreview({ staffList, currentUser, isAdmin }) {
  const [selectedStaffId, setSelectedStaffId] = useState(() => (
    isAdmin ? (staffList[0]?.id || '') : currentUser?.id
  ))
  const [date, setDate]   = useState(new Date().toISOString().split('T')[0])
  const [slots, setSlots] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const loadSlots = useCallback(async () => {
    if (!date || !selectedStaffId) return
    setLoading(true)
    setSlots(null)
    setMessage('')
    try {
      const { data } = await schedulesApi.slots({ date, staff_id: selectedStaffId, duration: 30 })
      setSlots(data.slots || [])
      if (data.message) setMessage(data.message)
    } catch {
      toast.error('Failed to load slots.')
    } finally {
      setLoading(false)
    }
  }, [date, selectedStaffId])

  useEffect(() => { loadSlots() }, [loadSlots])

  const available = slots?.filter(s => !s.is_booked) || []
  const booked    = slots?.filter(s =>  s.is_booked) || []

  return (
    <div className="slot-panel">
      <div className="slot-panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Slot Preview</h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Preview time slots and booking availability for specific dates
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isAdmin && staffList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sub)' }}>Staff:</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(parseInt(e.target.value))}
                className="filter-popover-select"
                style={{ minWidth: '180px' }}
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role === 'dentist' ? 'Dentist' : 'Nurse'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sub)' }}>Date:</label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={e => setDate(e.target.value)}
              className="filter-popover-select"
            />
          </div>
        </div>
      </div>

      {loading && <div className="slot-loading"><span className="loader-ring" /></div>}

      {!loading && message && (
        <div className="slot-message">{message}</div>
      )}

      {!loading && slots && slots.length === 0 && !message && (
        <div className="slot-message">No slots available for this day.</div>
      )}

      {!loading && slots && slots.length > 0 && (
        <>
          <div className="slot-stats" style={{ marginTop: '1rem' }}>
            <span className="slot-stat available">{available.length} Available</span>
            <span className="slot-stat booked">{booked.length} Booked</span>
          </div>
          <div className="slot-grid">
            {slots.map(slot => (
              <div
                key={slot.datetime}
                className={`slot-chip ${slot.is_booked ? 'booked' : 'available'}`}
                title={slot.is_booked ? `Booked — Provider: ${slot.provider || 'Staff'}` : `Available — Provider: ${slot.provider || 'Staff'}`}
              >
                {slot.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function SchedulePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [schedules, setSchedules]           = useState([])
  const [unavailability, setUnavail]        = useState([])
  const [staffList, setStaffList]           = useState([])
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('all') // 'all' | staff_id
  const [loading, setLoading]               = useState(true)
  const [activeTab, setActiveTab]           = useState('schedule')
  const [modal, setModal]                   = useState(null)
  const [unavailModal, setUnavailModal]     = useState(false)
  const [unavailConfirm, setUnavailConfirm] = useState({ open: false, id: null, loading: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [schRes, unavRes] = await Promise.all([
        schedulesApi.list(),
        schedulesApi.listUnavailability(),
      ])
      setSchedules(schRes.data.schedules || [])
      setStaffList(schRes.data.staff_list || [])
      setUnavail(unavRes.data.unavailability || [])
    } catch {
      toast.error('Failed to load schedule data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filter schedules by staff member if Admin has selected one
  const filteredSchedules = schedules.filter(s => {
    if (!isAdmin || selectedStaffFilter === 'all') return true
    return String(s.user_id) === String(selectedStaffFilter)
  })

  // Filter unavailabilities by staff member if Admin has selected one
  const filteredUnavail = unavailability.filter(u => {
    if (!isAdmin || selectedStaffFilter === 'all') return true
    return String(u.user_id) === String(selectedStaffFilter)
  })

  const byDay = DAYS.reduce((acc, d) => {
    acc[d] = filteredSchedules.filter(s => s.day_of_week === d)
    return acc
  }, {})

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setSchedules(p => p.map(s => s.id === saved.id ? saved : s))
    } else {
      setSchedules(p => [...p, saved])
    }
    setModal(null)
  }

  const handleDeleted = (id) => {
    setSchedules(p => p.filter(s => s.id !== id))
    setModal(null)
  }

  const handleUnavailAdded = (entry) => {
    setUnavail(p => [...p.filter(u => u.id !== entry.id), entry]
      .sort((a, b) => a.unavailable_date > b.unavailable_date ? 1 : -1))
    setUnavailModal(false)
  }

  const handleRemoveUnavail = (id) => {
    setUnavailConfirm({ open: true, id, loading: false })
  }

  const doRemoveUnavail = async () => {
    if (!unavailConfirm.id) return
    setUnavailConfirm(prev => ({ ...prev, loading: true }))
    try {
      const { data } = await schedulesApi.removeUnavailability(unavailConfirm.id)
      setUnavail(p => p.filter(u => u.id !== unavailConfirm.id))
      toast.success(data.message)
      setUnavailConfirm({ open: false, id: null, loading: false })
    } catch {
      toast.error('Failed to remove date.')
      setUnavailConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  const scheduledDaysCount = DAYS.filter(d => byDay[d].length > 0).length

  const stats = [
    { value: scheduledDaysCount,        label: 'Days Scheduled' },
    { value: filteredSchedules.length,  label: 'Schedule Entries' },
    { value: filteredUnavail.length,    label: 'Blocked Dates' },
  ]

  const pageTitle = isAdmin ? 'Staff Schedules' : 'My Schedule'
  const pageSubtitle = isAdmin
    ? 'Manage working hours and availability for clinic staff and dentists.'
    : 'Define your working hours and availability.'

  const handleOpenAddModal = (day = 'monday') => {
    const defaultStaffId = selectedStaffFilter !== 'all' 
      ? parseInt(selectedStaffFilter) 
      : (staffList[0]?.id || '')
    setModal({ day_of_week: day, user_id: defaultStaffId })
  }

  return (
    <DashboardLayout title={pageTitle} subtitle={pageSubtitle} stats={stats}>

      {/* Tab Bar */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Weekly Schedule
        </button>
        <button
          className={`tab-btn ${activeTab === 'unavailability' ? 'active' : ''}`}
          onClick={() => setActiveTab('unavailability')}
        >
          Blocked Dates {filteredUnavail.length > 0 && <span className="tab-count">{filteredUnavail.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'slots' ? 'active' : ''}`}
          onClick={() => setActiveTab('slots')}
        >
          Slot Preview
        </button>
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : (
        <>
          {/* Admin Staff Filter Bar */}
          {isAdmin && staffList.length > 0 && (
            <div className="staff-filter-bar">
              <span className="staff-filter-label">Filter Staff:</span>
              <button
                type="button"
                className={`staff-filter-pill ${selectedStaffFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedStaffFilter('all')}
              >
                <span>All Staff</span>
                <span className="staff-role-pill-badge">{schedules.length}</span>
              </button>
              {staffList.map(s => {
                const count = schedules.filter(sch => sch.user_id === s.id).length
                const isDentist = s.role === 'dentist'
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`staff-filter-pill ${String(selectedStaffFilter) === String(s.id) ? 'active' : ''}`}
                    onClick={() => setSelectedStaffFilter(String(s.id))}
                  >
                    <span>{s.name}</span>
                    <span className="staff-role-pill-badge">{isDentist ? 'Dentist' : 'Nurse'} · {count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
             1. Weekly Schedule Tab
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'schedule' && (
            <div>
              <div className="page-toolbar">
                <p className="text-muted">
                  {isAdmin
                    ? 'Click "+ Add Entry" or a day card to assign a schedule. Click any entry to edit.'
                    : 'Click a day card to add your working hours. Click an entry to edit.'}
                </p>
                <button className="btn-primary" onClick={() => handleOpenAddModal('monday')}>
                  + Add Entry
                </button>
              </div>

              <div className="week-grid">
                {DAYS.map(day => (
                  <div key={day} className={`week-col ${byDay[day].length > 0 ? 'has-entries' : ''}`}>
                    <div className="week-col-header">
                      <span className="day-label">{DAY_LABELS[day]}</span>
                      <span className="day-full">{DAY_FULL[day]}</span>
                    </div>
                    <div className="week-col-body">
                      {byDay[day].length === 0 ? (
                        <button className="week-add-btn" onClick={() => handleOpenAddModal(day)} title="Add entry for this day">
                          +
                        </button>
                      ) : (
                        byDay[day].map(entry => {
                          const staffUser = entry.user || staffList.find(s => s.id === entry.user_id)
                          const isDentist = staffUser?.role === 'dentist'
                          return (
                            <button
                              key={entry.id}
                              className={`schedule-entry ${entry.is_available ? '' : 'blocked'}`}
                              onClick={() => setModal(entry)}
                            >
                              {/* Staff badge when Admin or when viewing multiple staff */}
                              {isAdmin && (
                                <span className={`schedule-staff-tag ${isDentist ? 'dentist' : 'clinic_staff'}`}>
                                  {staffUser?.name || 'Staff'} ({isDentist ? 'Dentist' : 'Nurse'})
                                </span>
                              )}

                              <span className="entry-time">
                                {entry.start_time?.slice(0, 5)} – {entry.end_time?.slice(0, 5)}
                              </span>

                              {entry.notes && <span className="entry-note" title={entry.notes}>{entry.notes}</span>}

                              <span className={`entry-badge ${entry.is_available ? 'active' : 'inactive'}`}>
                                {entry.is_available ? 'Open' : 'Blocked'}
                              </span>
                            </button>
                          )
                        })
                      )}
                      {byDay[day].length > 0 && (
                        <button className="week-add-btn small" onClick={() => handleOpenAddModal(day)} title="Add another entry">+</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
             2. Blocked Dates Tab
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'unavailability' && (
            <div>
              <div className="page-toolbar">
                <p className="text-muted">
                  Blocked dates will prevent patients from booking appointments on these dates.
                </p>
                <button className="btn-primary" onClick={() => setUnavailModal(true)}>
                  + Block a Date
                </button>
              </div>

              {filteredUnavail.length === 0 ? (
                <div className="empty-state">
                  <p>
                    {selectedStaffFilter !== 'all'
                      ? 'No dates blocked for this staff member.'
                      : 'No dates blocked. Clinic staff are fully available on their regular schedules!'}
                  </p>
                </div>
              ) : (
                <div className="unavail-list">
                  {filteredUnavail.map(u => {
                    const staffUser = u.user || staffList.find(s => s.id === u.user_id)
                    const isDentist = staffUser?.role === 'dentist'
                    return (
                      <div key={u.id} className="unavail-card">
                        <div className="unavail-info">
                          {isAdmin && staffUser && (
                            <span className={`schedule-staff-tag ${isDentist ? 'dentist' : 'clinic_staff'}`} style={{ marginBottom: '0.25rem' }}>
                              {staffUser.name} ({isDentist ? 'Dentist' : 'Nurse'})
                            </span>
                          )}
                          <span className="unavail-date">
                            {new Date(u.unavailable_date + 'T00:00:00').toLocaleDateString('en-PH', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          {u.reason && <span className="unavail-reason">{u.reason}</span>}
                        </div>
                        <button className="btn-danger" title="Remove block" onClick={() => handleRemoveUnavail(u.id)}>
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
             3. Slot Preview Tab
             ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'slots' && (
            <SlotPreview staffList={staffList} currentUser={user} isAdmin={isAdmin} />
          )}
        </>
      )}

      {/* Modals */}
      {modal !== null && (
        <ScheduleModal
          entry={modal === 'add' ? null : modal}
          staffList={staffList}
          currentUser={user}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {unavailModal && (
        <UnavailabilityModal
          staffList={staffList}
          currentUser={user}
          isAdmin={isAdmin}
          onClose={() => setUnavailModal(false)}
          onAdded={handleUnavailAdded}
        />
      )}
      {/* Unblock Date Modal */}
      <ConfirmModal
        open={unavailConfirm.open}
        title="Unblock Date"
        message="Are you sure you want to unblock this date?"
        confirmLabel="Unblock"
        danger={false}
        loading={unavailConfirm.loading}
        onConfirm={doRemoveUnavail}
        onCancel={() => setUnavailConfirm({ open: false, id: null, loading: false })}
      />
    </DashboardLayout>
  )
}

