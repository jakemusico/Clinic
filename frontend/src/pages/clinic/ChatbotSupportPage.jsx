import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import { chatbotApi } from '../../api/chatbot'
import { adminApi } from '../../api/admin'
import { chatApi } from '../../api/chat'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { EMPTY } from '../../utils/emptyValue'
import '../ProfilePage.css'

/* ─── Constants ──────────────────────────────────────────────────── */

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

const BLANK = {
  question:     '',
  answer:       '',
  category:     'general',
  keywords:     '',
  sort_order:   0,
  is_active:    true,
  show_on_help: true,
}

const TABS = [
  { key: 'faqs',     label: 'FAQs' },
  { key: 'stats',    label: 'Chat Statistics' },
  { key: 'settings', label: 'Settings' },
]

/* ─── Tiny helpers ───────────────────────────────────────────────── */

const fmtMinutes = (mins) => {
  if (mins === null || mins === undefined || mins === '') return EMPTY
  const num = typeof mins === 'number' ? mins : parseFloat(mins)
  if (isNaN(num) || num < 0) return EMPTY
  const rounded = Math.round(num)
  if (rounded === 0) return '< 1 min'
  if (rounded < 60) return `${rounded} min`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  const hrStr = h === 1 ? '1 hr' : `${h} hrs`
  return m === 0 ? hrStr : `${hrStr} ${m} min`
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function ChatbotSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS.find(t => t.key === tabParam) ? tabParam : 'faqs'
  )

  const switchTab = (key) => {
    setActiveTab(key)
    setSearchParams({ tab: key })
  }

  // Sync if URL param changes externally
  useEffect(() => {
    if (tabParam && TABS.find(t => t.key === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  return (
    <DashboardLayout
      title="Chatbot Support"
      subtitle="Manage FAQ database, view chat statistics, and configure live chat settings."
    >
      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* ── Tab Navigation ───────────────────────────────────────── */}
        <div className="profile-nav-tabs-wrap" style={{ width: '100%', marginBottom: '1.5rem' }}>
          <div className="profile-tab-list" style={{ display: 'flex', gap: '0.5rem' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                className={`profile-tab-item ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => switchTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Views ────────────────────────────────────────────── */}
        {activeTab === 'faqs'     && <FaqsTab />}
        {activeTab === 'stats'    && <StatsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </DashboardLayout>
  )
}

/* ══════════════════════════════════════════════════════════════════
   TAB 1: FAQs
══════════════════════════════════════════════════════════════════ */

function FaqsTab() {
  const [faqs,       setFaqs]       = useState([])
  const [placeholders, setPlaceholders] = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)   // 'add' | 'edit' | 'preview'
  const [selected,   setSelected]   = useState(null)
  const [form,       setForm]       = useState(BLANK)
  const [saving,     setSaving]     = useState(false)
  const [filterCat,  setFilterCat]  = useState('all')
  const [filterQ,    setFilterQ]    = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, faq: null, loading: false })

  // raw=1 -> `answer` keeps the editable {placeholders}; `answer_preview` has the real values
  const load = async () => {
    setLoading(true)
    try {
      const { data } = await chatbotApi.list({ raw: 1 })
      setFaqs(data?.faqs || [])
      setPlaceholders(data?.placeholders || [])
      setCategories(data?.categories || [])
    } catch {
      toast.error('Failed to load FAQs from the server.')
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

  const allCategories = Array.from(new Set([...Object.keys(CATEGORY_LABELS), ...categories]))

  const openAdd  = () => { setForm(BLANK); setModal('add') }
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
  const openPreview = (faq) => { setSelected(faq); setModal('preview') }

  const handleToggleHelp = async (faq) => {
    try {
      const { data } = await chatbotApi.toggleHelp(faq.id)
      const nextVal = data?.faq?.show_on_help !== false
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, show_on_help: nextVal } : f))
      toast.success(`FAQ ${nextVal ? 'will now show' : 'hidden from'} Student Help page.`)
    } catch {
      toast.error('Failed to update Help page visibility.')
    }
  }

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) {
      toast.error('Question, Answer and Category are required.')
      return
    }
    setSaving(true)
    try {
      if (modal === 'add') {
        await chatbotApi.create(form)
        toast.success('FAQ added successfully.')
      } else {
        await chatbotApi.update(selected.id, form)
        toast.success('FAQ updated successfully.')
      }
      setModal(null)
      await load()   // re-read from the server so ids and previews are the real ones
    } catch (err) {
      const data = err?.response?.data
      toast.error(data?.errors?.answer?.[0] || data?.message || 'Failed to save FAQ.')
    } finally { setSaving(false) }
  }

  const handleToggle = async (faq) => {
    try {
      await chatbotApi.toggle(faq.id)
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, is_active: !f.is_active } : f))
      toast.success(`FAQ ${faq.is_active ? 'deactivated' : 'activated'}.`)
    } catch {
      toast.error('Failed to update FAQ status.')
    }
  }

  const handleDelete = (faq) => {
    setDeleteConfirm({ open: true, faq, loading: false })
  }

  const doDeleteFaq = async () => {
    const faq = deleteConfirm.faq
    if (!faq) return
    setDeleteConfirm(prev => ({ ...prev, loading: true }))
    try {
      await chatbotApi.delete(faq.id)
      setFaqs(prev => prev.filter(f => f.id !== faq.id))
      toast.success('FAQ deleted successfully.')
      setDeleteConfirm({ open: false, faq: null, loading: false })
    } catch {
      toast.error('Failed to delete FAQ.')
      setDeleteConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <div style={{ width: '100%', paddingBottom: '2.5rem' }}>
      {/* ── Summary Cards ─────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem', width: '100%' }}>
        {[
          { label: 'Total FAQs',  value: faqs.length },
          { label: 'Active',      value: faqs.filter(f => f.is_active).length },
          { label: 'Categories',  value: categories.length },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-info">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="page-toolbar" style={{ width: '100%', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
          <input
            className="search-input"
            placeholder="Search FAQs..."
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
        <button type="button" className="btn-primary" onClick={openAdd}>Add FAQ</button>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : displayed.length === 0 ? (
        <div className="empty-state"><p>No FAQs match the current filter.</p></div>
      ) : (
        <div className="data-table-wrap" style={{ width: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Order</th>
                <th>Category</th>
                <th>Question</th>
                <th>Keywords</th>
                <th style={{ width: '100px' }}>Help Page</th>
                <th>Status</th>
                <th style={{ width: '190px' }}>Actions</th>
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
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{faq.question}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    {faq.keywords || <span className="text-muted">{EMPTY}</span>}
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
                      <button type="button" className="btn-secondary" onClick={() => openPreview(faq)}>Preview</button>
                      <button type="button" className="btn-secondary" onClick={() => openEdit(faq)}>Edit</button>
                      <button
                        type="button"
                        className={`btn-secondary ${faq.is_active ? '' : 'success'}`}
                        onClick={() => handleToggle(faq)}
                      >
                        {faq.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="btn-danger" onClick={() => handleDelete(faq)}>Delete</button>
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

      {/* ── Add / Edit Modal ──────────────────────────────────── */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'add' ? 'Add New FAQ' : 'Edit FAQ'}</h2>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Question</label>
                  <input
                    className="form-input"
                    value={form.question}
                    onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Answer</label>
                  <textarea
                    className="form-input"
                    rows={6}
                    value={form.answer}
                    onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                  {placeholders.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <p className="form-hint" style={{ marginBottom: '0.35rem' }}>
                        Placeholders you can type in the answer (replaced with the current Clinic Info / Staff Schedules when the chatbot replies):
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.25rem 1rem' }}>
                        {placeholders.map(p => (
                          <div key={p.token} style={{ fontSize: '0.78rem', color: 'var(--text-sub)', lineHeight: 1.45 }}>
                            <code style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.token}</code>
                            {' — '}{p.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <Dropdown
                    value={form.category || ''}
                    onChange={v => setForm(f => ({ ...f, category: v }))}
                    options={[
                      ...allCategories.map(c => ({ value: c, label: CATEGORY_LABELS[c] || c })),
                      { value: 'custom', label: 'Custom' },
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
                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Keywords</label>
                  <input
                    className="form-input"
                    value={form.keywords}
                    onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  />
                  <p className="form-hint">Comma-separated terms for rule-based chatbot intent matching.</p>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Student Help Page</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      className={`toggle-switch ${form.show_on_help !== false ? 'on' : 'off'}`}
                      onClick={() => setForm(f => ({ ...f, show_on_help: f.show_on_help === false }))}
                    >
                      <span className="toggle-knob" />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                      {form.show_on_help !== false ? 'Shown on Student Help FAQ accordion' : 'Hidden from Student Help FAQ accordion'}
                    </span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem' }}>
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
              <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add FAQ' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────── */}
      {modal === 'preview' && selected && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>FAQ Preview</h2>
              <button type="button" className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-crust)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.25rem' }}>USER MESSAGE</p>
                <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>"{selected.question}"</p>
              </div>
              <div style={{ background: 'rgba(137,180,250,0.06)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>BOT RESPONSE</p>
                <p style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  <strong>{selected.question}</strong>{'\n\n'}{selected.answer_preview ?? selected.answer}
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
              <button type="button" className="btn-ghost" onClick={() => setModal(null)}>Close</button>
              <button type="button" className="btn-primary" onClick={() => openEdit(selected)}>Edit</button>
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
        onConfirm={doDeleteFaq}
        onCancel={() => setDeleteConfirm({ open: false, faq: null, loading: false })}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   TAB 2: Chat Statistics
══════════════════════════════════════════════════════════════════ */

const PERIOD_OPTIONS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly' },
]

function StatsTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [period,  setPeriod]  = useState('daily')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await chatbotApi.getStatistics({ period })
      setData(d)
    } catch {
      toast.error('Failed to load chat statistics.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const cards = data?.cards || {}
  const chartData = data?.chart_data || []
  const byRole = data?.by_role || {}
  const topFaqs = data?.top_faqs || []

  const maxVal = Math.max(...chartData.map(d => Number(d.conversations) || 0), 0)
  const yAxisMax = maxVal > 0 ? Math.max(maxVal + 1, 4) : 5

  const cardDefs = [
    { label: 'Total Conversations', value: cards.total_conversations   ?? 0, color: 'var(--accent)',  bg: 'var(--accent-light)' },
    { label: 'Open',                value: cards.open_conversations    ?? 0, color: 'var(--amber)',   bg: 'rgba(245,158,11,0.12)' },
    { label: 'Resolved',            value: cards.resolved_conversations ?? 0, color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)' },
    { label: 'Unanswered',          value: cards.unanswered_conversations ?? 0, color: 'var(--red)', bg: 'rgba(239,68,68,0.12)' },
  ]

  if (loading) {
    return <div className="table-loading"><span className="loader-ring" /></div>
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2.5rem' }}>

      {/* ── Summary Cards ─────────────────────────────────────── */}
      <div className="stats-grid" style={{ width: '100%' }}>
        {cardDefs.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon-badge" style={{ color: c.color, background: c.bg }}>
              <ChatIcon />
            </div>
            <div className="stat-info">
              <span className="stat-value">{c.value}</span>
              <span className="stat-label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Avg Response Time ─────────────────────────────────── */}
      <div className="admin-card" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div className="stat-icon-badge" style={{ color: 'var(--blue)', background: 'rgba(59,130,246,0.12)' }}>
          <ClockIcon />
        </div>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {fmtMinutes(cards.avg_response_time_minutes)}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
            Average Staff Response Time
          </div>
        </div>
      </div>

      {/* ── Conversations Over Time ────────────────────────────── */}
      <div className="admin-card" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
              Conversations Over Time
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
              Inbound student support conversation trends.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.key}
                type="button"
                className={period === p.key ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <p>No conversation data for this period.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <XAxis
                  dataKey="short_label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, yAxisMax]}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(v, _n, p) => [v, p.payload.label]}
                  contentStyle={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                  }}
                  cursor={{ fill: 'rgba(37,99,235,0.05)' }}
                />
                <Bar dataKey="conversations" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="var(--accent)" fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── By Staff Role ─────────────────────────────────────── */}
      <div className="admin-card" style={{ width: '100%' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            By Staff Role
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
            Conversation resolution breakdown by role.
          </p>
        </div>
        {(!byRole.nurse && !byRole.dentist) ? (
          <div className="empty-state" style={{ padding: '1.5rem 0' }}>
            <p>No staff role data available yet.</p>
          </div>
        ) : (
          <div className="data-table-wrap" style={{ width: '100%', marginBottom: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Total Conversations</th>
                  <th>Resolved</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { role: 'Nurse',   data: byRole.nurse   || { total: 0, resolved: 0, open: 0 } },
                  { role: 'Dentist', data: byRole.dentist || { total: 0, resolved: 0, open: 0 } },
                ].map(r => (
                  <tr key={r.role}>
                    <td style={{ fontWeight: 600 }}>
                      <span className="status-badge role-blue">{r.role}</span>
                    </td>
                    <td>{r.data.total}</td>
                    <td>
                      <span className={`status-badge ${r.data.resolved > 0 ? 'confirmed' : ''}`}>
                        {r.data.resolved}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${r.data.open > 0 ? 'pending' : ''}`}>
                        {r.data.open}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Top 5 Most Asked FAQs ─────────────────────────────── */}
      <div className="admin-card" style={{ width: '100%' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            Top 5 Most Asked FAQs
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
            Most frequent student queries recorded in the chatbot question log.
          </p>
        </div>
        {topFaqs.length === 0 ? (
          <div className="empty-state" style={{ padding: '1.5rem 0' }}>
            <p>No FAQ question log data yet. Logs are recorded when students use the chatbot.</p>
          </div>
        ) : (
          <div className="data-table-wrap" style={{ width: '100%', marginBottom: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Question</th>
                  <th>Category</th>
                  <th style={{ width: '80px' }}>Hits</th>
                </tr>
              </thead>
              <tbody>
                {topFaqs.map((f, i) => (
                  <tr key={f.faq_id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{f.question}</td>
                    <td>
                      <span className="status-badge role-blue">
                        {CATEGORY_LABELS[f.category] || f.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{f.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   TAB 3: Settings
══════════════════════════════════════════════════════════════════ */

function SettingsTab() {
  const [loading,       setLoading]       = useState(true)
  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)

  // Availability state
  const [nurseStatus,   setNurseStatus]   = useState(null)
  const [dentistStatus, setDentistStatus] = useState(null)
  const [clinicHours,   setClinicHours]   = useState('')
  const [clinicHotline, setClinicHotline] = useState('')

  // Saved (server) values
  const [saved, setSaved] = useState({
    chat_enabled:           '1',
    chat_offline_message:   'Currently offline. Your message will be answered during clinic hours.',
    chat_auto_resolve_days: '7',
  })

  // Draft values while editing
  const [draft, setDraft] = useState({ ...saved })

  const load = async () => {
    setLoading(true)
    try {
      const [r1, r2, r3, nurseRes, dentistRes, infoRes] = await Promise.all([
        adminApi.getSetting('chat_enabled'),
        adminApi.getSetting('chat_offline_message'),
        adminApi.getSetting('chat_auto_resolve_days'),
        chatApi.getStatus('nurse').catch(() => ({ data: null })),
        chatApi.getStatus('dentist').catch(() => ({ data: null })),
        adminApi.getSetting('clinic_info').catch(() => ({ data: null })),
      ])

      const fetched = {
        chat_enabled:           r1.data.value ?? '1',
        chat_offline_message:   r2.data.value ?? 'Currently offline. Your message will be answered during clinic hours.',
        chat_auto_resolve_days: r3.data.value ?? '7',
      }
      setSaved(fetched)
      setDraft(fetched)

      // Chat availability data
      setNurseStatus(nurseRes.data)
      setDentistStatus(dentistRes.data)

      // Clinic hours & hotline
      let hours = nurseRes.data?.clinic_hours || dentistRes.data?.clinic_hours || ''
      let hotline = nurseRes.data?.clinic_hotline || dentistRes.data?.clinic_hotline || ''

      if (infoRes.data?.value) {
        try {
          const info = JSON.parse(infoRes.data.value)
          if (!hotline && info.contact_trunkline) {
            hotline = info.contact_trunkline
          }
          if (info.schedule && Array.isArray(info.schedule)) {
            const openScheds = info.schedule.filter(s => s.is_open)
            if (openScheds.length > 0) {
              const days = openScheds.map(s => s.day?.slice(0, 3)).join(', ')
              const time = `${openScheds[0].open_time} - ${openScheds[0].close_time}`
              hours = `${days}: ${time}`
            }
          }
        } catch {}
      }

      setClinicHours(hours || 'Monday - Friday: 8:00 AM - 5:00 PM')
      setClinicHotline(hotline || '(085) 342-1830 loc. 124')
    } catch {
      toast.error('Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const startEdit  = () => { setDraft({ ...saved }); setEditing(true) }
  const cancelEdit = () => { setDraft({ ...saved }); setEditing(false) }

  const saveSettings = async () => {
    // Validate auto-resolve days (1 to 30)
    const daysNum = parseInt(draft.chat_auto_resolve_days, 10)
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      toast.error('Auto-resolve days must be a whole number between 1 and 30.')
      return
    }

    // Validate offline message
    const msgTrimmed = draft.chat_offline_message.trim()
    if (!msgTrimmed) {
      toast.error('Offline message cannot be empty.')
      return
    }
    if (msgTrimmed.length > 500) {
      toast.error('Offline message must not exceed 500 characters.')
      return
    }

    setSaving(true)
    try {
      await Promise.all([
        adminApi.updateSetting('chat_enabled',           draft.chat_enabled === '0' ? '0' : '1'),
        adminApi.updateSetting('chat_offline_message',   msgTrimmed),
        adminApi.updateSetting('chat_auto_resolve_days', String(daysNum)),
      ])
      const updated = {
        chat_enabled:           draft.chat_enabled === '0' ? '0' : '1',
        chat_offline_message:   msgTrimmed,
        chat_auto_resolve_days: String(daysNum),
      }
      setSaved(updated)
      setDraft(updated)
      setEditing(false)
      toast.success('Live chat settings saved successfully.')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="table-loading"><span className="loader-ring" /></div>
  }

  const vals = editing ? draft : saved

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '2.5rem' }}>

      {/* ── CARD 1: Live Chat Settings ─────────────────────────── */}
      <div className="admin-card" style={{ width: '100%', padding: '1.75rem' }}>
        {/* Card Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border)',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
              Live Chat Settings
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.45 }}>
              Configure real-time student messaging rules, offline messages, and conversation lifecycles.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {!editing ? (
              <button type="button" className="btn-secondary" onClick={startEdit}>
                Edit
              </button>
            ) : (
              <>
                <button type="button" className="btn-ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={saveSettings} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Setting Row 1: Live Chat Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 0',
          borderBottom: '1px solid var(--border)',
          gap: '1.5rem',
          width: '100%',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Live Chat
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Students see the chat button only when chat is enabled. When disabled, live chat is hidden.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <button
              type="button"
              className={`toggle-switch ${vals.chat_enabled !== '0' ? 'on' : 'off'}`}
              disabled={!editing}
              onClick={() => editing && setDraft(d => ({ ...d, chat_enabled: d.chat_enabled === '0' ? '1' : '0' }))}
              title={vals.chat_enabled !== '0' ? 'Live chat enabled' : 'Live chat disabled'}
            >
              <span className="toggle-knob" />
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: vals.chat_enabled !== '0' ? 'var(--green)' : 'var(--text-muted)', minWidth: '60px' }}>
              {vals.chat_enabled !== '0' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Setting Row 2: Offline Message */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '1.25rem 0',
          borderBottom: '1px solid var(--border)',
          gap: '0.75rem',
          width: '100%',
        }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Offline Message
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Shown to students when staff is offline or live chat is disabled.
            </div>
          </div>
          <div style={{ width: '100%' }}>
            <textarea
              className="form-input"
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                background: editing ? '#ffffff' : 'var(--bg-crust)',
                color: 'var(--text)',
                lineHeight: 1.6,
              }}
              value={vals.chat_offline_message}
              disabled={!editing}
              onChange={e => setDraft(d => ({ ...d, chat_offline_message: e.target.value }))}
            />
          </div>
        </div>

        {/* Setting Row 3: Auto-Resolve Days */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '1.25rem',
          gap: '1.5rem',
          width: '100%',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Auto-Resolve Days
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Conversations with no staff reply are automatically resolved after this many days. Default is 7 days.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            {editing ? (
              <>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={30}
                  style={{ width: '85px', textAlign: 'center' }}
                  value={draft.chat_auto_resolve_days}
                  onChange={e => setDraft(d => ({ ...d, chat_auto_resolve_days: e.target.value }))}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>
                  days
                </span>
              </>
            ) : (
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
                {saved.chat_auto_resolve_days} {saved.chat_auto_resolve_days === '1' ? 'day' : 'days'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── CARD 2: Chat Availability ───────────────────────────── */}
      <div className="admin-card" style={{ width: '100%', padding: '1.75rem' }}>
        {/* Card Header */}
        <div style={{
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border)',
          width: '100%',
        }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
            Chat Availability
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.45 }}>
            Current real-time staff connection status and operating schedule from Clinic Information.
          </p>
        </div>

        {/* Availability Row 1: Nurse Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 0',
          borderBottom: '1px solid var(--border)',
          gap: '1.5rem',
          width: '100%',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Nurse Status
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Live presence of clinic nursing staff for triage and health concerns.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span className={`status-badge ${nurseStatus?.is_online ? 'confirmed' : 'cancelled'}`}>
              {nurseStatus?.is_online ? 'Online' : 'Offline'}
            </span>
            {nurseStatus?.staff_name && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)', fontWeight: 500 }}>
                {nurseStatus.staff_name}
              </span>
            )}
          </div>
        </div>

        {/* Availability Row 2: Dentist Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 0',
          borderBottom: '1px solid var(--border)',
          gap: '1.5rem',
          width: '100%',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Dentist Status
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Live presence of dental clinic staff for consultations and dental inquiries.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span className={`status-badge ${dentistStatus?.is_online ? 'confirmed' : 'cancelled'}`}>
              {dentistStatus?.is_online ? 'Online' : 'Offline'}
            </span>
            {dentistStatus?.staff_name && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)', fontWeight: 500 }}>
                {dentistStatus.staff_name}
              </span>
            )}
          </div>
        </div>

        {/* Availability Row 3: Clinic Operating Hours */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 0',
          borderBottom: '1px solid var(--border)',
          gap: '1.5rem',
          width: '100%',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Clinic Hours
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Standard operating hours configured under Admin Clinic Information.
            </div>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', flexShrink: 0, textAlign: 'right' }}>
            {clinicHours}
          </div>
        </div>

        {/* Availability Row 4: Clinic Hotline */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '1.25rem',
          gap: '1.5rem',
          width: '100%',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.92rem' }}>
              Clinic Hotline
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Emergency and contact telephone extension provided to students.
            </div>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', flexShrink: 0, textAlign: 'right' }}>
            {clinicHotline}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Inline SVG Icons (no emojis, no arrows) ───────────────────── */

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
