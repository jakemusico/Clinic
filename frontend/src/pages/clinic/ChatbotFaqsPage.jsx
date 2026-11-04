import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import { chatbotApi } from '../../api/chatbot'
import { getFaqs, saveFaqs } from '../../utils/clinicStorage'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'

const CATEGORY_LABELS = {
  appointments: 'Appointments',
  services:     'Services',
  hours:        'Clinic Hours',
  records:      'Medical Records',
  requirements: 'Requirements',
  general:      'General Info',
  dental:       'Dental',
  emergency:    'Emergency',
}

const BLANK = { question: '', answer: '', category: 'general', keywords: '', sort_order: 0, is_active: true, show_on_help: true }

export default function ChatbotFaqsPage() {
  const [faqs,       setFaqs]       = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)
  const [selected,   setSelected]   = useState(null)
  const [form,       setForm]       = useState(BLANK)
  const [saving,     setSaving]     = useState(false)
  const [filterCat,  setFilterCat]  = useState('all')
  const [filterQ,    setFilterQ]    = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, faq: null, loading: false })

  const load = async () => {
    setLoading(true)
    try {
      const localFaqs = getFaqs()
      const { data } = await chatbotApi.list()
      const serverFaqs = data?.faqs || []
      const merged = serverFaqs.length > 0 ? serverFaqs.map(sf => {
        const match = localFaqs.find(lf => lf.id === sf.id || lf.question === sf.question)
        return {
          ...sf,
          show_on_help: match ? match.show_on_help !== false : true,
        }
      }) : localFaqs
      setFaqs(merged)
      saveFaqs(merged)
      setCategories(data?.categories || [])
    } catch {
      const localFaqs = getFaqs()
      setFaqs(localFaqs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const displayed = faqs.filter(f => {
    const matchCat = filterCat === 'all' || f.category === filterCat
    const matchQ   = !filterQ || f.question.toLowerCase().includes(filterQ.toLowerCase())
    return matchCat && matchQ
  })

  const pagination = usePagination({ items: displayed })

  const openAdd = () => {
    setForm(BLANK)
    setModal('add')
  }

  const openEdit = (faq) => {
    setSelected(faq)
    setForm({
      question:     faq.question,
      answer:       faq.answer,
      category:     faq.category,
      keywords:     faq.keywords || '',
      sort_order:   faq.sort_order,
      is_active:    faq.is_active,
      show_on_help: faq.show_on_help !== false,
    })
    setModal('edit')
  }

  const openPreview = (faq) => {
    setSelected(faq)
    setModal('preview')
  }

  const handleToggleHelp = (faq) => {
    const nextVal = faq.show_on_help === false ? true : false
    const updated = faqs.map(f => f.id === faq.id ? { ...f, show_on_help: nextVal } : f)
    setFaqs(updated)
    saveFaqs(updated)
    toast.success(`FAQ ${nextVal ? 'will now show' : 'hidden from'} Student Help page.`)
  }

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) {
      toast.error('Question, Answer and Category are required.')
      return
    }
    setSaving(true)
    try {
      if (modal === 'add') {
        try { await chatbotApi.create(form) } catch {}
        const newFaq = {
          id: Date.now(),
          ...form,
        }
        const updated = [...faqs, newFaq]
        setFaqs(updated)
        saveFaqs(updated)
        toast.success('FAQ added successfully!')
      } else {
        try { await chatbotApi.update(selected.id, form) } catch {}
        const updated = faqs.map(f => f.id === selected.id ? { ...f, ...form } : f)
        setFaqs(updated)
        saveFaqs(updated)
        toast.success('FAQ updated successfully!')
      }
      setModal(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save FAQ.')
    } finally { setSaving(false) }
  }

  const handleToggle = async (faq) => {
    try { await chatbotApi.toggle(faq.id) } catch {}
    const updated = faqs.map(f => f.id === faq.id ? { ...f, is_active: !f.is_active } : f)
    setFaqs(updated)
    saveFaqs(updated)
    toast.success(`FAQ ${faq.is_active ? 'deactivated' : 'activated'}.`)
  }

  const handleDelete = (faq) => {
    setDeleteConfirm({ open: true, faq, loading: false })
  }

  const doDelete = async () => {
    const faq = deleteConfirm.faq
    if (!faq) return
    setDeleteConfirm(prev => ({ ...prev, loading: true }))
    try {
      await chatbotApi.delete(faq.id)
      const updated = faqs.filter(f => f.id !== faq.id)
      setFaqs(updated)
      saveFaqs(updated)
      toast.success('FAQ deleted successfully.')
      setDeleteConfirm({ open: false, faq: null, loading: false })
    } catch {
      toast.error('Failed to delete FAQ.')
      setDeleteConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  const allCategories = Array.from(new Set([...Object.keys(CATEGORY_LABELS), ...categories]))

  const stats = [
    { value: faqs.length,                            label: 'Total FAQs' },
    { value: faqs.filter(f => f.is_active).length,   label: 'Active' },
    { value: categories.length,                     label: 'Categories' },
  ]

  return (
    <DashboardLayout
      title="Chatbot FAQ Management"
      subtitle="Manage predefined Q&A database for rule-based virtual assistant."
      stats={stats}
    >
      <div className="page-toolbar">
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
          <input
            className="search-input"
            placeholder="Search questions..."
            value={filterQ}
            onChange={e => { setFilterQ(e.target.value); pagination.setPage(1) }}
          />
          <div style={{ minWidth: '175px' }}>
            <Dropdown
              variant="filter"
              value={filterCat}
              onChange={v => { setFilterCat(v); pagination.setPage(1) }}
              options={[{ value: 'all', label: 'All Categories' }, ...allCategories.map(c => ({ value: c, label: CATEGORY_LABELS[c] || c }))]}
            />
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + Add New FAQ
        </button>
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <p>No FAQs match the current filter.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Order</th>
                <th>Category</th>
                <th>Question</th>
                <th>Keywords</th>
                <th style={{ width: '100px' }}>Help Page</th>
                <th>Status</th>
                <th style={{ width: '180px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(faq => (
                <tr key={faq.id}>
                  <td>{faq.sort_order}</td>
                  <td>
                    <span className="status-badge role-blue">
                      {CATEGORY_LABELS[faq.category] || faq.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {faq.question}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    {faq.keywords || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`toggle-switch ${faq.show_on_help !== false ? 'on' : 'off'}`}
                      onClick={() => handleToggleHelp(faq)}
                      title={faq.show_on_help !== false ? 'Shown on Student Help Page' : 'Hidden from Student Help Page'}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </td>
                  <td>
                    <span className={`status-badge ${faq.is_active ? 'confirmed' : 'cancelled'}`}>
                      {faq.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn-secondary" title="Preview" onClick={() => openPreview(faq)}>Preview</button>
                      <button className="btn-secondary" title="Edit" onClick={() => openEdit(faq)}>Edit</button>
                      <button
                        className={`btn-secondary ${faq.is_active ? '' : 'success'}`}
                        title={faq.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggle(faq)}
                      >
                        {faq.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn-danger" title="Delete" onClick={() => handleDelete(faq)}>Delete</button>
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

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Add New FAQ' : 'Edit FAQ'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Question *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. How do I book an appointment?"
                    value={form.question}
                    onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Answer *</label>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="Provide a clear, helpful answer. Use line breaks for steps."
                    value={form.answer}
                    onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <Dropdown
                    value={form.category || ''}
                    onChange={v => setForm(f => ({ ...f, category: v }))}
                    options={[
                      ...allCategories.map(c => ({ value: c, label: CATEGORY_LABELS[c] || c })),
                      { value: 'custom', label: 'Custom…' },
                    ]}
                    placeholder="Select category"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sort Order</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">
                    Keywords <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated, for intent matching)</span>
                  </label>
                  <input
                    className="form-input"
                    placeholder="e.g. book, schedule, appointment, reserve"
                    value={form.keywords}
                    onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  />
                  <p className="form-hint">When a user types any of these words, this FAQ is more likely to be matched.</p>
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Student Help & Contact Page</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      className={`toggle-switch ${form.show_on_help !== false ? 'on' : 'off'}`}
                      onClick={() => setForm(f => ({ ...f, show_on_help: f.show_on_help === false ? true : false }))}
                    >
                      <span className="toggle-knob" />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                      {form.show_on_help !== false ? 'Show on Student Help page FAQ accordion' : 'Hidden from Student Help page'}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {[true, false].map(v => (
                      <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="is_active"
                          checked={form.is_active === v}
                          onChange={() => setForm(f => ({ ...f, is_active: v }))}
                        />
                        <span>{v ? 'Active' : 'Inactive'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add FAQ' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {modal === 'preview' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>FAQ Preview</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-crust)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.25rem' }}>USER MESSAGE</p>
                <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>"{selected.question}"</p>
              </div>
              <div style={{ background: 'rgba(137,180,250,0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>BOT RESPONSE</p>
                <p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  <strong>{selected.question}</strong>{'\n\n'}{selected.answer}
                </p>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>CATEGORY </span>
                  <span className="status-badge role-blue">{CATEGORY_LABELS[selected.category] || selected.category}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>KEYWORDS </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>{selected.keywords || '(none)'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal(null)}>Close</button>
              <button className="btn-primary" onClick={() => openEdit(selected)}>Edit</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete FAQ Modal */}
      <ConfirmModal
        open={deleteConfirm.open}
        title="Delete FAQ"
        message={deleteConfirm.faq ? `Delete FAQ "${deleteConfirm.faq.question}"?` : ''}
        confirmLabel="Delete"
        danger={true}
        loading={deleteConfirm.loading}
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm({ open: false, faq: null, loading: false })}
      />
    </DashboardLayout>
  )
}
