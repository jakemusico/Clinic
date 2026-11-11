import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import { complaintCategoriesApi } from '../../api/complaintCategories'

const TYPES = [
  { value: 'medical', label: 'Medical' },
  { value: 'dental',  label: 'Dental' },
]

/**
 * Admin management of the complaint categories shown in the consultation
 * forms, split into Medical and Dental tabs. Categories are never deleted —
 * they are deactivated instead, so old records keep their label.
 */
export default function ComplaintCategoriesPage() {
  const [type, setType]         = useState('medical')
  const [categories, setCategories] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)   // null = add, object = rename
  const [name, setName]         = useState('')
  const [reordering, setReordering] = useState(false)

  const fetchCategories = useCallback(() => {
    setLoading(true)
    complaintCategoriesApi.list({ type })
      .then(res => setCategories(res.data.categories || []))
      .catch(() => toast.error('Failed to load complaint categories.'))
      .finally(() => setLoading(false))
  }, [type])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const openAdd = () => {
    setEditing(null)
    setName('')
    setShowModal(true)
  }

  const openRename = (cat) => {
    setEditing(cat)
    setName(cat.name)
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return toast.error('Category name is required.')
    if (categories.some(c => c.id !== editing?.id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      return toast.error('A category with this name already exists in this list.')
    }

    setSaving(true)
    try {
      if (editing) {
        await complaintCategoriesApi.update(editing.id, { name: trimmed })
        toast.success('Category renamed.')
      } else {
        await complaintCategoriesApi.create({ name: trimmed, type })
        toast.success('Category added.')
      }
      setShowModal(false)
      fetchCategories()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (cat) => {
    try {
      const { data } = await complaintCategoriesApi.toggle(cat.id)
      setCategories(prev => prev.map(c => c.id === cat.id ? data.category : c))
      toast.success(data.category.is_active ? 'Category enabled.' : 'Category disabled.')
    } catch {
      toast.error('Failed to update category status.')
    }
  }

  // Move a category one slot up/down, then persist the whole order
  const move = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= categories.length || reordering) return

    const next = [...categories]
    ;[next[index], next[target]] = [next[target], next[index]]
    setCategories(next)
    setReordering(true)
    try {
      await complaintCategoriesApi.reorder(next.map(c => c.id))
    } catch {
      toast.error('Failed to save the new order.')
      fetchCategories()
    } finally {
      setReordering(false)
    }
  }

  return (
    <DashboardLayout
      title="Complaint Categories"
      subtitle="Categories shown in the consultation forms, split by care type."
    >
      <div
        className="page-toolbar cat-toolbar"
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        <div className="cat-type-tabs">
          {TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              className={`tab-btn${type === t.value ? ' active' : ''}`}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }} onClick={openAdd}>
          + Add Category
        </button>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <p>No complaint categories found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Order</th>
                <th>Category Name</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, index) => (
                <tr key={cat.id} style={{ opacity: cat.is_active ? 1 : 0.55 }}>
                  <td>
                    <div className="action-btns" style={{ gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        disabled={index === 0 || reordering}
                        onClick={() => move(index, -1)}
                        title="Move up"
                      >↑</button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        disabled={index === categories.length - 1 || reordering}
                        onClick={() => move(index, 1)}
                        title="Move down"
                      >↓</button>
                    </div>
                  </td>
                  <td className="td-name">{cat.name}</td>
                  <td>
                    <span className={`status-badge ${cat.is_active ? 'active' : 'inactive'}`}>
                      {cat.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={() => openRename(cat)}
                      >
                        Rename
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={() => handleToggle(cat)}
                      >
                        {cat.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Rename Modal ─────────────────────────────────────── */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>{editing ? 'Rename Category' : 'Add Category'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Fever/Flu"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
