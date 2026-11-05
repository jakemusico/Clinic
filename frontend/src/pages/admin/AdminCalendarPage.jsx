import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { calendarApi } from '../../api/calendar'
import { toast } from 'react-hot-toast'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'
import { EMPTY } from '../../utils/emptyValue'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const EVENT_TYPES = ['Clinic Closure', 'Health Activity', 'Holiday', 'Announcement']
const AUDIENCES   = ['All', 'Students', 'Faculty/Staff', 'Clinic Staff']

const TYPE_BADGE = {
  'Clinic Closure':  'status-badge cancelled',
  'Health Activity': 'status-badge confirmed',
  'Holiday':         'status-badge active',
  'Announcement':    'status-badge completed',
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const min = parts[1].padStart(2, '0')
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${min} ${ampm}`
}

function formatDate(dateStr, endDateStr = null, allDay = true, startTime = null, endTime = null) {
  if (!dateStr) return EMPTY
  const cleanStart = String(dateStr).split('T')[0]
  const dStart = new Date(cleanStart + 'T00:00:00')
  if (isNaN(dStart.getTime())) return dateStr
  const startFormatted = dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  let endFormatted = ''
  const cleanEnd = endDateStr ? String(endDateStr).split('T')[0] : ''
  if (cleanEnd && cleanEnd !== cleanStart) {
    const dEnd = new Date(cleanEnd + 'T00:00:00')
    if (!isNaN(dEnd.getTime())) {
      endFormatted = dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  if (allDay || !startTime) {
    return endFormatted ? `${startFormatted} – ${endFormatted}` : startFormatted
  }

  const timeFormatted = formatTime(startTime)
  const endTimeFormatted = endTime ? ` - ${formatTime(endTime)}` : ''
  const timePart = `${timeFormatted}${endTimeFormatted}`

  if (endFormatted) {
    return `${startFormatted} – ${endFormatted} (${timePart})`
  }
  return `${startFormatted}, ${timePart}`
}

export default function AdminCalendarPage() {
  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [searchTerm, setSearchTerm]   = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm)
  const [typeFilter, setTypeFilter]   = useState('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentEvent, setCurrentEvent] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, loading: false })

  const emptyForm = {
    title: '', type: 'Announcement',
    start_date: new Date().toISOString().split('T')[0], end_date: '',
    all_day: false, start_time: '', end_time: '',
    description: '', audience: 'All',
  }
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => { fetchEvents() }, [])

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await calendarApi.list()
      setEvents(res.data.events || [])
    } catch {
      toast.error('Failed to load calendar events.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (evt = null) => {
    if (evt) {
      setCurrentEvent(evt)
      setFormData({
        title:       evt.title,
        type:        evt.type,
        start_date:  evt.start_date ? String(evt.start_date).split('T')[0] : '',
        end_date:    evt.end_date   ? String(evt.end_date).split('T')[0]   : '',
        all_day:     Boolean(evt.all_day),
        start_time:  evt.start_time  || '',
        end_time:    evt.end_time    || '',
        description: evt.description || '',
        audience:    evt.audience,
      })
    } else {
      setCurrentEvent(null)
      setFormData({ ...emptyForm, start_date: new Date().toISOString().split('T')[0] })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (currentEvent) {
        await calendarApi.update(currentEvent.id, formData)
        toast.success('Event updated.')
      } else {
        await calendarApi.create(formData)
        toast.success('Event created.')
      }
      setIsModalOpen(false)
      fetchEvents()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving event.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id) => {
    setDeleteConfirm({ open: true, id, loading: false })
  }

  const doDelete = async () => {
    if (!deleteConfirm.id) return
    setDeleteConfirm(prev => ({ ...prev, loading: true }))
    try {
      await calendarApi.delete(deleteConfirm.id)
      toast.success('Event deleted.')
      fetchEvents()
      setDeleteConfirm({ open: false, id: null, loading: false })
    } catch {
      toast.error('Error deleting event.')
      setDeleteConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  const filtered = events.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    const matchType   = typeFilter === 'All' || e.type === typeFilter
    return matchSearch && matchType
  })

  const pagination = usePagination({ items: filtered })

  return (
    <DashboardLayout
      title="Calendar Management"
      subtitle="Manage clinic schedule, closures, and announcements."
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div
        className="page-toolbar"
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        {/* Pill search */}
        <div className="global-search-container" style={{ flex: 1, minWidth: '220px', maxWidth: '380px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="global-search-input"
            placeholder="Search events..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); pagination.setPage(1) }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '0.9rem', padding: '2px 6px',
              }}
              title="Clear search"
            >✕</button>
          )}
        </div>

        {/* Type filter */}
        <div style={{ minWidth: '150px' }}>
          <Dropdown
            variant="filter"
            ariaLabel="Event type"
            value={typeFilter}
            onChange={v => { setTypeFilter(v); pagination.setPage(1) }}
            options={[{ value: 'All', label: 'All Types' }, ...EVENT_TYPES.map(t => ({ value: t, label: t }))]}
          />
        </div>

        {/* Add Event — pushed to far right */}
        <button
          className="btn-primary"
          style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
          onClick={() => handleOpenModal()}
        >
          + Add Event
        </button>
      </div>

      {/* ── Table card ──────────────────────────────────────────────── */}
      <div className="data-table-wrap">
        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>{searchTerm || typeFilter !== 'All' ? 'No events match your search or filter.' : 'No calendar events found.'}</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Audience</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map(e => (
                  <tr key={e.id}>
                    <td className="td-name">{e.title}</td>
                    <td>
                      <span className={TYPE_BADGE[e.type] || 'status-badge inactive'}>
                        {e.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {formatDate(e.start_date, e.end_date, e.all_day, e.start_time, e.end_time)}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{e.audience}</td>
                    <td>
                      <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={() => handleOpenModal(e)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-secondary"
                          style={{
                            padding: '0.3rem 0.65rem', fontSize: '0.78rem',
                            color: 'var(--red)', borderColor: 'var(--red-border)',
                          }}
                          onClick={() => handleDelete(e.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={(s) => { pagination.setPageSize(s); pagination.setPage(1) }}
            />
          </>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false) }}
        >
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{currentEvent ? 'Edit Event' : 'Add Event'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text" required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Type</label>
                    <Dropdown
                      ariaLabel="Type"
                      value={formData.type}
                      onChange={v => setFormData({ ...formData, type: v })}
                      options={EVENT_TYPES}
                    />
                  </div>
                  <div className="form-group">
                    <label>Audience</label>
                    <Dropdown
                      ariaLabel="Audience"
                      value={formData.audience}
                      onChange={v => setFormData({ ...formData, audience: v })}
                      options={AUDIENCES}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date" required
                      value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="cal-allDay"
                    checked={formData.all_day}
                    onChange={e => setFormData({ ...formData, all_day: e.target.checked })}
                  />
                  <label htmlFor="cal-allDay" style={{ margin: 0 }}>All-day event</label>
                </div>

                {!formData.all_day && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Start Time</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Time</label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add additional details about this event..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (currentEvent ? 'Save Changes' : 'Create Event')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Event Modal */}
      <ConfirmModal
        open={deleteConfirm.open}
        title="Delete Event"
        message="Delete this event? This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        loading={deleteConfirm.loading}
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null, loading: false })}
      />
    </DashboardLayout>
  )
}
