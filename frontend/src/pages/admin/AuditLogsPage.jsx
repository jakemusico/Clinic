import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import StyledSelect, { DateInput } from '../../components/StyledSelect'
import { adminApi } from '../../api/admin'

/* ── Human-readable action labels ──────────────────────────────────────── */
const ACTION_LABELS = {
  // Auth
  login:                            'Login',
  logout:                           'Logout',
  register:                         'Registration',
  password_changed:                 'Password Changed',
  profile_updated:                  'Profile Updated',

  // Users (admin)
  user_created:                     'User Created',
  user_updated:                     'User Updated',
  user_status_toggled:              'User Status Toggled',

  // Medical records
  record_created:                   'Medical Record Created',
  record_updated:                   'Medical Record Updated',
  record_accessed:                  'Medical Record Viewed',
  admin_viewed_medical_records:     'Viewed Medical Records List',
  admin_viewed_medical_record:      'Viewed Medical Record',
  admin_viewed_patient_list:        'Viewed Patient List',
  admin_viewed_patient_record:      'Viewed Patient Record',

  // Dental
  dental_consultation_created:      'Dental Consultation Created',
  dental_consultation_updated:      'Dental Consultation Updated',
  dental_consultation_accessed:     'Dental Consultation Viewed',
  admin_viewed_dental_consultation: 'Viewed Dental Consultation',
  admin_viewed_dental_chart:        'Viewed Dental Chart',
  dental_tooth_updated:             'Tooth Condition Updated',
  dental_tooth_updated_via_consultation: 'Tooth Updated via Consultation',

  // Appointments
  appointment_created:              'Appointment Created',
  appointment_rescheduled:          'Appointment Rescheduled',
  appointment_status_changed:       'Appointment Status Changed',

  // Calendar Events
  calendar_event_created:           'Calendar Event Created',
  calendar_event_updated:           'Calendar Event Updated',
  calendar_event_deleted:           'Calendar Event Deleted',

  // Inventory
  inventory_item_created:           'Inventory Item Created',
  inventory_item_updated:           'Inventory Item Updated',
  inventory_item_toggled:           'Inventory Item Toggled',
  inventory_stock_in:               'Stock In Recorded',
  inventory_stock_out:              'Stock Out Recorded',
  inventory_dispensed:              'Inventory Dispensed',

  // Announcements / Notifications
  announcement_sent:                'Announcement Sent',
}

function formatAction(raw) {
  if (!raw) return '—'
  if (ACTION_LABELS[raw]) return ACTION_LABELS[raw]
  // Fallback: convert snake_case / UPPER_SNAKE to Title Case
  return raw
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/* ── Badge class per action category ───────────────────────────────────── */
function getActionBadgeClass(action) {
  const a = (action || '').toLowerCase()
  if (a.includes('create') || a.includes('register')) return 'status-badge confirmed'
  if (a.includes('update') || a.includes('change'))   return 'status-badge pending'
  if (a.includes('delete') || a.includes('logout'))   return 'status-badge cancelled'
  if (a.includes('view') || a.includes('access') || a.includes('viewed')) return 'status-badge completed'
  if (a.includes('login'))                             return 'status-badge active'
  return 'status-badge inactive'
}

/* ── JSON diff panel shown in expandable row ────────────────────────────── */
function JsonDiffPanel({ oldVal, newVal }) {
  if (!oldVal && !newVal) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No value details recorded.</span>
  }
  const blockStyle = {
    margin: 0, padding: '0.6rem 0.75rem',
    background: '#1e1e2e', borderRadius: 'var(--radius-sm)',
    fontSize: '0.73rem', overflow: 'auto', maxHeight: '200px',
    color: '#cdd6f4', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#f38ba8', fontWeight: 700, marginBottom: '0.3rem' }}>BEFORE</div>
        <pre style={blockStyle}>{oldVal ? JSON.stringify(oldVal, null, 2) : '(empty)'}</pre>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#a6e3a1', fontWeight: 700, marginBottom: '0.3rem' }}>AFTER</div>
        <pre style={blockStyle}>{newVal ? JSON.stringify(newVal, null, 2) : '(empty)'}</pre>
      </div>
    </div>
  )
}

/* ── Shared input/select style for the filter row ───────────────────────── */
const filterFieldStyle = {
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: '#FFFFFF',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  outline: 'none',
  height: '38px',
  boxSizing: 'border-box',
  width: '100%',
}

export default function AuditLogsPage() {
  const [logs,      setLogs]      = useState([])
  const [actions,   setActions]   = useState([])
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)

  const [search,     setSearch]     = useState('')
  const [filterAct,  setFilterAct]  = useState('all')
  const [filterUser, setFilterUser] = useState('all')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')

  const [expandedId, setExpandedId] = useState(null)
  const [page,       setPage]       = useState(1)
  const [pageSize,   setPageSize]   = useState(10)
  const [lastPage,   setLastPage]   = useState(1)
  const [total,      setTotal]      = useState(0)

  const load = useCallback(async (overrides = {}) => {
    setLoading(true)
    try {
      const params = {
        page:      overrides.page      ?? page,
        per_page:  overrides.per_page  ?? pageSize,
        search:    overrides.search    ?? search,
        action:    overrides.action    ?? filterAct,
        user_id:   overrides.user_id   ?? filterUser,
        date_from: overrides.date_from ?? dateFrom,
        date_to:   overrides.date_to   ?? dateTo,
      }
      const { data } = await adminApi.listAuditLogs(params)
      setLogs(data.logs?.data || data.data || [])
      setLastPage(data.logs?.last_page || data.last_page || 1)
      setTotal(data.logs?.total ?? data.total ?? 0)
      setActions(data.actions || [])
      setUsers(data.users   || [])
    } catch {
      toast.error('Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filterAct, filterUser, dateFrom, dateTo])

  // Re-fetch when page, pageSize, action filter, or user filter change immediately
  useEffect(() => { load() }, [page, pageSize, filterAct, filterUser]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    load({ page: 1 })
  }

  const handleClearFilters = () => {
    setSearch(''); setFilterAct('all'); setFilterUser('all')
    setDateFrom(''); setDateTo(''); setPage(1)
    load({ page: 1, search: '', action: 'all', user_id: 'all', date_from: '', date_to: '' })
  }

  const hasActiveFilters = search || filterAct !== 'all' || filterUser !== 'all' || dateFrom || dateTo

  const stats = [{ value: total, label: 'Total Logs' }]

  return (
    <DashboardLayout
      title="Security Audit Logs"
      subtitle="Review detailed security audit trails, record accesses, and system updates."
      stats={stats}
    >

      {/* ── Filter toolbar ────────────────────────────────────────────── */}
      <form
        onSubmit={handleFilterSubmit}
        style={{ marginBottom: '1rem' }}
      >
        {/* Row 1: search + action + user + dates */}
        <div style={{
          display: 'flex', gap: '0.6rem', alignItems: 'center',
          flexWrap: 'wrap', marginBottom: '0.6rem',
        }}>
          {/* Pill search */}
          <div className="global-search-container" style={{ flex: '2 1 220px', maxWidth: '340px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="global-search-input"
              placeholder="Search action, user, or IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: '0.9rem', padding: '2px 6px',
              }} title="Clear">✕</button>
            )}
          </div>

          {/* Action filter */}
          <div style={{ flex: '1 1 170px' }}>
            <StyledSelect
              value={filterAct}
              onChange={e => { setFilterAct(e.target.value); setPage(1) }}
            >
              <option value="all">All Actions</option>
              {actions.map(act => (
                <option key={act} value={act}>{formatAction(act)}</option>
              ))}
            </StyledSelect>
          </div>

          {/* User filter */}
          <div style={{ flex: '1 1 170px' }}>
            <StyledSelect
              value={filterUser}
              onChange={e => { setFilterUser(e.target.value); setPage(1) }}
            >
              <option value="all">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </StyledSelect>
          </div>

          {/* Date from */}
          <div style={{ flex: '1 1 150px' }}>
            <DateInput
              label="From"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From date"
              max={dateTo || undefined}
              style={{ width: '100%' }}
            />
          </div>

          {/* Date to */}
          <div style={{ flex: '1 1 150px' }}>
            <DateInput
              label="To"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To date"
              min={dateFrom || undefined}
              style={{ width: '100%' }}
            />
          </div>

          {/* Buttons — same height as inputs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ height: '40px', padding: '0 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              Apply
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-ghost"
                style={{ height: '40px', padding: '0 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                onClick={handleClearFilters}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ── Main Table ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p>{hasActiveFilters ? 'No audit logs match the current filters.' : 'No audit logs recorded yet.'}</p>
        </div>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User / Actor</th>
                  <th>Action</th>
                  <th>Affected Record</th>
                  <th>IP Address</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id
                  return (
                    <React.Fragment key={log.id}>
                      <tr style={{ borderBottom: isExpanded ? 'none' : undefined }}>
                        {/* Actor */}
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                            {log.user ? log.user.name : <span style={{ color: 'var(--text-muted)' }}>System</span>}
                          </div>
                          {log.user && (
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              {log.user.email}
                            </div>
                          )}
                        </td>

                        {/* Action */}
                        <td>
                          <span className={getActionBadgeClass(log.action)}>
                            {formatAction(log.action)}
                          </span>
                        </td>

                        {/* Affected record */}
                        <td>
                          {log.model_type ? (
                            <div>
                              <div style={{ fontSize: '0.83rem', color: 'var(--text-sub)', fontWeight: 500 }}>
                                {log.model_type.split('\\').pop()}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {log.model_id ? `ID: ${log.model_id}` : '—'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* IP */}
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {log.ip_address || '—'}
                        </td>

                        {/* Timestamp */}
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>

                        {/* Details toggle */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-ghost"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr style={{ background: 'var(--bg-crust, #f8fafc)' }}>
                          <td
                            colSpan={6}
                            style={{
                              padding: '0.85rem 1.25rem 1rem',
                              borderTop: 'none',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div>
                                <span style={{ fontWeight: 600, color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                                  USER AGENT:{' '}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {log.user_agent || 'Unknown'}
                                </span>
                              </div>
                              <JsonDiffPanel oldVal={log.old_values} newVal={log.new_values} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
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
    </DashboardLayout>
  )
}
