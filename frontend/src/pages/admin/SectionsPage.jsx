import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import api from '../../api/axios'
import { invalidate } from '../../api/referenceCache'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'
import { GRADE_LEVELS, STRANDS } from '../../constants/schoolData'
import { EMPTY } from '../../utils/emptyValue'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

// The Register / Profile / User Management pickers read these lists from a short-lived cache
const forgetSectionLists = () => { invalidate('sections'); invalidate('grade-levels') }

export default function SectionsPage() {
  const [sections, setSections] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [gradeFilter, setGradeFilter] = useState('all')
  const [formData, setFormData] = useState({ id: null, grade_level: '', name: '', strand: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, sec: null, loading: false })

  const fetchSections = () => {
    setLoading(true)
    api.get('/sections')
      .then(res => setSections(Array.isArray(res.data) ? res.data : []))
      .catch(() => toast.error('Failed to load sections.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSections() }, [])

  const handleOpenModal = (sec = null) => {
    if (sec) {
      setFormData({ id: sec.id, grade_level: sec.grade_level, name: sec.name, strand: sec.strand || '' })
      setIsEditing(true)
    } else {
      setFormData({ id: null, grade_level: '', name: '', strand: '' })
      setIsEditing(false)
    }
    setShowModal(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!formData.grade_level.trim() || !formData.name.trim()) {
      return toast.error('Grade level and section name are required.')
    }

    const isSeniorHigh = formData.grade_level === 'Grade 11' || formData.grade_level === 'Grade 12'
    const payload = {
      grade_level: formData.grade_level.trim(),
      name:        formData.name.trim(),
      strand:      isSeniorHigh ? (formData.strand.trim() || null) : null,
    }

    const req = isEditing
      ? api.put(`/admin/sections/${formData.id}`, payload)
      : api.post('/admin/sections', payload)

    req
      .finally(forgetSectionLists)
      .then(() => {
        toast.success(isEditing ? 'Section updated.' : 'Section added.')
        setShowModal(false)
        fetchSections()
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to save section.'))
  }

  const handleDelete = (sec) => {
    setDeleteConfirm({ open: true, sec, loading: false })
  }

  const doDelete = async () => {
    const sec = deleteConfirm.sec
    if (!sec) return
    setDeleteConfirm(prev => ({ ...prev, loading: true }))
    try {
      await api.delete(`/admin/sections/${sec.id}`).finally(forgetSectionLists)
      toast.success('Section deleted.')
      fetchSections()
      setDeleteConfirm({ open: false, sec: null, loading: false })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete section.')
      setDeleteConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  const filtered = sections.filter(s => {
    const q = debouncedSearch.toLowerCase()
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.grade_level.toLowerCase().includes(q) ||
      (s.strand || '').toLowerCase().includes(q)
    const matchGrade = gradeFilter === 'all' || s.grade_level === gradeFilter
    return matchSearch && matchGrade
  })

  const pagination = usePagination({ items: filtered })

  return (
    <DashboardLayout
      title="Sections Management"
      subtitle="Manage grade levels, sections, and academic strands."
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
            placeholder="Search by section name, grade, or strand..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '0.9rem', padding: '2px 6px',
              }}
              title="Clear search"
            >✕</button>
          )}
        </div>

        {/* Grade level filter */}
        <div style={{ minWidth: '170px' }}>
          <Dropdown
            variant="filter"
            value={gradeFilter}
            onChange={setGradeFilter}
            options={[{ value: 'all', label: 'All Grade Levels' }, ...GRADE_LEVELS]}
          />
        </div>

        {/* Add Section — far right */}
        <button
          className="btn-primary"
          style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
          onClick={() => handleOpenModal()}
        >
          + Add Section
        </button>
      </div>

      {/* ── Table card ──────────────────────────────────────────────── */}
      <div className="data-table-wrap">
        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>{search || gradeFilter !== 'all' ? 'No sections match your search or filter.' : 'No sections found. Add your first section above.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Grade Level</th>
                <th>Section Name</th>
                <th>Strand</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.grade_level}</td>
                  <td className="td-name">{s.name}</td>
                  <td style={{ fontSize: '0.85rem', color: s.strand ? 'var(--text)' : 'var(--text-muted)' }}>
                    {s.strand || EMPTY}
                  </td>
                  <td>
                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={() => handleOpenModal(s)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '0.3rem 0.65rem', fontSize: '0.78rem',
                          color: 'var(--red)', borderColor: 'var(--red-border)',
                        }}
                        onClick={() => handleDelete(s)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Section' : 'Add Section'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <div className="form-group">
                  <label>Grade Level *</label>
                  <Dropdown
                    required
                    value={formData.grade_level || ''}
                    onChange={newGrade => {
                      setFormData(prev => ({
                        ...prev,
                        grade_level: newGrade,
                        strand: (newGrade === 'Grade 11' || newGrade === 'Grade 12') ? prev.strand : '',
                      }))
                    }}
                    options={[
                      ...GRADE_LEVELS,
                      ...(formData.grade_level && !GRADE_LEVELS.includes(formData.grade_level) ? [formData.grade_level] : []),
                    ]}
                    placeholder="Select Grade Level"
                  />
                </div>

                <div className="form-group">
                  <label>Section Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {(formData.grade_level === 'Grade 11' || formData.grade_level === 'Grade 12') && (
                  <div className="form-group">
                    <label>Strand <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                    <Dropdown
                      ariaLabel="Strand"
                      value={formData.strand}
                      onChange={v => setFormData({ ...formData, strand: v })}
                      placeholder="Select Strand"
                      options={[
                        { value: '', label: 'Select Strand' },
                        ...STRANDS.map(s => ({ value: s, label: s })),
                        ...(formData.strand && !STRANDS.includes(formData.strand)
                          ? [{ value: formData.strand, label: formData.strand }]
                          : []),
                      ]}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {isEditing ? 'Save Changes' : 'Add Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Section Modal */}
      <ConfirmModal
        open={deleteConfirm.open}
        title="Delete Section"
        message={
          deleteConfirm.sec
            ? `Delete section "${deleteConfirm.sec.name}" (${deleteConfirm.sec.grade_level})? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger={true}
        loading={deleteConfirm.loading}
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm({ open: false, sec: null, loading: false })}
      />
    </DashboardLayout>
  )
}
