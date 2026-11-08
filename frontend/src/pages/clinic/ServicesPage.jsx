import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import Dropdown from '../../components/Dropdown'
import { servicesApi } from '../../api/services'
import { EMPTY } from '../../utils/emptyValue'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import useSubmitLock from '../../hooks/useSubmitLock'

const EMPTY_FORM = { name: '', care_type: 'medical', description: '', duration_minutes: 30, fee: '', is_active: true }

// Which kind of care a service belongs to: medical -> nurse, dental -> dentist
const CARE_TYPE_OPTIONS = [
  { value: 'medical', label: 'Medical (Nurse)' },
  { value: 'dental', label: 'Dental (Dentist)' },
]
const CARE_TYPE_LABEL = { medical: 'Medical', dental: 'Dental' }
const CARE_TYPE_BADGE = { medical: 'role-blue', dental: 'role-purple' }

function ServiceModal({ service, onClose, onSaved }) {
  const isEdit = Boolean(service?.id)
  const [form, setForm]       = useState(service ? { ...service, fee: String(service.fee) } : { ...EMPTY_FORM })
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const { lock, unlock } = useSubmitLock()

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!lock()) return   // already saving (double click / second Enter)
    setSaving(true); setErrors({})
    try {
      const payload = { ...form, fee: parseFloat(form.fee) || 0, duration_minutes: parseInt(form.duration_minutes) }
      const { data } = isEdit
        ? await servicesApi.update(service.id, payload)
        : await servicesApi.create(payload)
      toast.success(data.message)
      onSaved(data.service, isEdit)
    } catch (err) {
      const d = err?.response?.data
      if (d?.errors) {
        const flat = {}
        Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
      } else toast.error(d?.message || 'Failed to save service.')
    } finally { setSaving(false); unlock() }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Service' : 'Add New Service'}</h2>
          <button className="modal-close" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Service Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Medical Consultation" className={errors.name ? 'input-error' : ''} required />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label>Care Type</label>
            <Dropdown
              ariaLabel="Care type"
              value={form.care_type || 'medical'}
              onChange={v => set('care_type', v)}
              options={CARE_TYPE_OPTIONS}
              invalid={Boolean(errors.care_type)}
            />
            <span className="form-hint">
              Medical services are used by the Nurse; dental services by the Dentist (consultations and appointment booking).
            </span>
            {errors.care_type && <span className="field-error">{errors.care_type}</span>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Brief description of this service..." rows={3} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input type="number" value={form.duration_minutes} min={5} max={480}
                onChange={e => set('duration_minutes', e.target.value)}
                className={errors.duration_minutes ? 'input-error' : ''} required />
              {errors.duration_minutes && <span className="field-error">{errors.duration_minutes}</span>}
            </div>
            <div className="form-group">
              <label>Fee (₱)</label>
              <input type="number" step="0.01" value={form.fee} min={0}
                onChange={e => set('fee', e.target.value)} placeholder="0.00"
                className={errors.fee ? 'input-error' : ''} required />
              {errors.fee && <span className="field-error">{errors.fee}</span>}
            </div>
          </div>
          <div className="form-group">
            <label className="toggle-label">
              <span>Active Status</span>
              <button type="button" className={`toggle-switch ${form.is_active ? 'on' : 'off'}`}
                onClick={() => set('is_active', !form.is_active)}
                aria-label={form.is_active ? 'Deactivate' : 'Activate'}>
                <span className="toggle-knob" />
              </button>
              <span className={`status-badge ${form.is_active ? 'active' : 'inactive'}`}>
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : (isEdit ? 'Save Changes' : 'Create Service')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDialog({ message, onConfirm, onCancel, danger = false }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card modal-sm">
        <div className="modal-header">
          <h2>{danger ? 'Confirm Delete' : 'Confirm Action'}</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p className="confirm-text">{message}</p>
          <div className="modal-footer">
            <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
              {danger ? 'Delete' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const [services, setServices]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [modalService, setModalService] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toggling, setToggling]       = useState(null)
  const deleteLock = useSubmitLock()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await servicesApi.list()
      setServices(data.services)
    } catch { toast.error('Failed to load services.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setServices(p => p.map(s => s.id === saved.id ? saved : s))
    } else {
      setServices(p => [...p, saved])
    }
    setModalService(null)
  }

  const handleToggle = async (service) => {
    setToggling(service.id)
    try {
      const { data } = await servicesApi.toggle(service.id)
      setServices(p => p.map(s => s.id === data.service.id ? data.service : s))
      toast.success(data.message)
    } catch (err) { toast.error(err?.response?.data?.message || 'Toggle failed.') }
    finally { setToggling(null) }
  }

  const handleDelete = async () => {
    if (!deleteLock.lock()) return   // already deleting (double click)
    try {
      const { data } = await servicesApi.remove(deleteTarget.id)
      setServices(p => p.filter(s => s.id !== deleteTarget.id))
      toast.success(data.message)
    } catch (err) { toast.error(err?.response?.data?.message || 'Delete failed.') }
    finally { setDeleteTarget(null); deleteLock.unlock() }
  }

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(debouncedSearch.toLowerCase())
  )

  const pagination = usePagination({ items: filtered })

  const stats = [
    { value: services.length,                       label: 'Total Services' },
    { value: services.filter(s => s.is_active).length,  label: 'Active' },
    { value: services.filter(s => !s.is_active).length, label: 'Inactive' },
  ]

  return (
    <DashboardLayout title="Clinic Services" subtitle="Manage the services offered at the clinic." stats={stats}>

      {/* Toolbar */}
      <div className="page-toolbar">
        <input className="search-input" placeholder="Search services…" value={search}
          onChange={e => { setSearch(e.target.value); pagination.setPage(1) }} />
        <button id="add-service-btn" className="btn-primary" onClick={() => setModalService({})}>
          + Add Service
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{search ? 'No services match your search.' : 'No services yet. Add the first one!'}</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Care Type</th>
                <th>Description</th>
                <th>Duration</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(s => (
                <tr key={s.id}>
                  <td className="td-name">{s.name}</td>
                  <td><span className={`status-badge ${CARE_TYPE_BADGE[s.care_type] || 'role-blue'}`}>{CARE_TYPE_LABEL[s.care_type] || 'Medical'}</span></td>
                  <td className="td-desc">{s.description || <span className="text-muted">{EMPTY}</span>}</td>
                  <td>{s.duration_minutes} min</td>
                  <td>{s.fee > 0 ? `₱${parseFloat(s.fee).toFixed(2)}` : <span className="text-muted">Free</span>}</td>
                  <td>
                    <button
                      className={`status-badge clickable ${s.is_active ? 'active' : 'inactive'}`}
                      onClick={() => handleToggle(s)}
                      disabled={toggling === s.id}
                      title={s.is_active ? 'Click to deactivate' : 'Click to activate'}>
                      {toggling === s.id ? '…' : s.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-secondary" title="Edit" onClick={() => setModalService(s)}>Edit</button>
                      <button className="btn-danger" title="Delete" onClick={() => setDeleteTarget(s)}>Delete</button>
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
        </div>
      )}

      {/* Modals */}
      {modalService !== null && (
        <ServiceModal
          service={modalService?.id ? modalService : null}
          onClose={() => setModalService(null)}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          danger
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </DashboardLayout>
  )
}
