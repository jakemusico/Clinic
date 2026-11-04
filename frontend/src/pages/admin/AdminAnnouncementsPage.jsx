import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'
import { announcementsApi } from '../../api/announcements'

const EMPTY_FORM = {
  title: '',
  message: '',
  audience: 'All',
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([])
  const [modal, setModal]                 = useState(null) // 'create' | 'edit'
  const [selected, setSelected]           = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, loading: false })
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [saving, setSaving]               = useState(false)
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(1)
  const [pageSize, setPageSize]           = useState(10)
  const [lastPage, setLastPage]           = useState(1)
  const [total, setTotal]                 = useState(0)
  const [loading, setLoading]             = useState(true)

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await announcementsApi.list({ page, per_page: pageSize, search })
      setAnnouncements(res.data.announcements || res.data.data || [])
      setLastPage(res.data.last_page || 1)
      setTotal(res.data.total ?? (res.data.announcements || []).length)
    } catch (e) {
      console.error('Failed to load announcements', e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  useEffect(() => {
    const handleUpdate = () => fetchAnnouncements()
    window.addEventListener('announcements-updated', handleUpdate)
    return () => window.removeEventListener('announcements-updated', handleUpdate)
  }, [fetchAnnouncements])

  const openCreate = () => {
    setSelected(null)
    setForm(EMPTY_FORM)
    setModal('create')
  }

  const openEdit = (ann) => {
    setSelected(ann)
    setForm({
      title: ann.title,
      message: ann.message,
      audience: ann.audience || 'All',
    })
    setModal('edit')
  }

  const handleDelete = (id) => {
    setDeleteConfirm({ open: true, id, loading: false })
  }

  const doDelete = async () => {
    if (!deleteConfirm.id) return
    setDeleteConfirm(prev => ({ ...prev, loading: true }))
    try {
      await announcementsApi.remove(deleteConfirm.id)
      setAnnouncements(prev => prev.filter(a => a.id !== deleteConfirm.id))
      toast.success('Announcement deleted.')
      window.dispatchEvent(new Event('announcements-updated'))
      setDeleteConfirm({ open: false, id: null, loading: false })
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete announcement.')
      setDeleteConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and Message are required.')
      return
    }

    setSaving(true)
    try {
      if (modal === 'create') {
        const res = await announcementsApi.create({
          title:    form.title.trim(),
          message:  form.message.trim(),
          audience: form.audience,
        })
        setAnnouncements(prev => [res.data.announcement, ...prev])
        toast.success('Announcement published successfully.')
      } else {
        const res = await announcementsApi.update(selected.id, {
          title:    form.title.trim(),
          message:  form.message.trim(),
          audience: form.audience,
        })
        const updated = res.data.announcement
        setAnnouncements(prev => prev.map(a => a.id === updated.id ? updated : a))
        toast.success('Announcement updated.')
      }
      window.dispatchEvent(new Event('announcements-updated'))
      setModal(null)
    } catch (err) {
      console.error(err)
      const msg = err.response?.data?.message || 'Failed to save announcement.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const stats = [
    { value: announcements.length,                                   label: 'Total Announcements' },
    { value: announcements.filter(a => a.audience === 'Students').length, label: 'Students Only' },
    { value: announcements.filter(a => a.audience === 'All').length, label: 'Campus-wide' },
  ]

  return (
    <DashboardLayout
      title="Announcements"
      subtitle="Manage announcements and student broadcasts."
      stats={stats}
    >
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search announcements..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + Create Announcement
        </button>
      </div>

      {/* Announcements Table */}
      {loading ? (
        <div className="table-loading"><div className="loader-ring" /></div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          <p>No announcements found.</p>
        </div>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Title</th>
                  <th>Message</th>
                  <th style={{ width: '130px' }}>Audience</th>
                  <th style={{ width: '140px' }}>Date Published</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {a.title}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: 1.45 }}>
                      {a.message}
                    </td>
                    <td>
                      <span className={`status-badge ${a.audience === 'Students' ? 'role-blue' : a.audience === 'Staff' ? 'role-orange' : 'active'}`}>
                        {a.audience}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.825rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEdit(a)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => handleDelete(a.id)}
                        >
                          Delete
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
          <div className="modal-card" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'create' ? 'Create Announcement' : 'Edit Announcement'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-group">
                <label>Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Flu Vaccination Drive"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Message Content</label>
                <textarea
                  rows={4}
                  placeholder="Provide detailed description of the announcement..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Audience</label>
                <Dropdown
                  ariaLabel="Audience"
                  value={form.audience}
                  onChange={v => setForm(f => ({ ...f, audience: v }))}
                  options={[
                    { value: 'All', label: 'All (Campus-wide)' },
                    { value: 'Students', label: 'Students Only' },
                    { value: 'Staff', label: 'Staff (Nurse & Dentist)' },
                  ]}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Publishing...' : modal === 'create' ? 'Publish Announcement' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Announcement Modal */}
      <ConfirmModal
        open={deleteConfirm.open}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        loading={deleteConfirm.loading}
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm({ open: false, id: null, loading: false })}
      />
    </DashboardLayout>
  )
}
