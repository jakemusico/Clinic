import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { ConsultationModal } from '../../components/ConsultationModal'
import { DentalConsultationModal } from '../../components/DentalConsultationModal'

export default function PeoplePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [activeTab, setActiveTab] = useState('student') // 'student' or 'faculty_staff'
  const [search, setSearch]       = useState(initialSearch)
  const [loading, setLoading]     = useState(true)
  const [people, setPeople]       = useState([])
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(10)
  const [lastPage, setLastPage]   = useState(1)
  const [total, setTotal]         = useState(0)
  const [selectedPerson, setSelectedPerson] = useState(null)
  
  const isDentist = user?.role === 'dentist'
  const canConsult = user?.role === 'clinic_staff' || user?.role === 'dentist' || (user?.role === 'admin' && Boolean(user?.has_medical_access))

  useEffect(() => {
    fetchPeople(search, 1)
  }, [activeTab, pageSize])

  // Also fetch if user submitted a new search (e.g. from the search bar in the header routing here)
  useEffect(() => {
    if (initialSearch !== search) {
      setSearch(initialSearch)
      setPage(1)
      fetchPeople(initialSearch, 1)
    }
  }, [initialSearch])

  const fetchPeople = async (searchQuery = search, targetPage = page) => {
    setLoading(true)
    try {
      const { data } = await api.get('/clinic/people', {
        params: {
          type: activeTab,
          search: searchQuery,
          page: targetPage,
          per_page: pageSize,
        }
      })
      setPeople(data.data || (Array.isArray(data) ? data : []))
      setLastPage(data.last_page || 1)
      setTotal(data.total ?? (data.data || []).length)
      setPage(targetPage)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearchParams(search ? { search } : {})
    setPage(1)
    fetchPeople(search, 1)
  }

  return (
    <DashboardLayout
      title="People"
      subtitle="Search and view profiles of students and faculty/staff."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Top Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', flex: 1, paddingBottom: '0.5rem' }}>
            <button
              className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', fontWeight: 600, color: activeTab === 'student' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem', borderBottom: activeTab === 'student' ? '2px solid var(--accent)' : '2px solid transparent' }}
              onClick={() => { setActiveTab('student'); setSearchParams({}); setSearch(''); }}
            >
              Students
            </button>
            <button
              className={`tab-btn ${activeTab === 'faculty_staff' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', fontWeight: 600, color: activeTab === 'faculty_staff' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem', borderBottom: activeTab === 'faculty_staff' ? '2px solid var(--accent)' : '2px solid transparent' }}
              onClick={() => { setActiveTab('faculty_staff'); setSearchParams({}); setSearch(''); }}
            >
              Faculty & Staff
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', alignSelf: 'flex-end', paddingBottom: '0.5rem' }}>
            {people.length === 1 ? '1 result' : `${people.length} results`}
          </div>
          
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flex: 1, maxWidth: '400px' }}>
            <div className="global-search-container">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTab === 'student' ? 'students' : 'staff'} by name or ID...`}
                className="global-search-input"
              />
            </div>
          </form>
        </div>

        {/* Data Table */}
        <div className="data-table-wrap">
          {loading ? (
            <div className="table-loading"><div className="loader-ring" /></div>
          ) : people.length === 0 ? (
            <div className="empty-state">
              <p>No {activeTab === 'student' ? 'students' : 'staff'} found.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>{activeTab === 'student' ? 'Student ID' : 'Employee ID'}</th>
                  {activeTab === 'student' ? (
                    <th>Grade & Section</th>
                  ) : (
                    <>
                      <th>Department</th>
                      <th>Position</th>
                    </>
                  )}
                  <th>Last Clinic Visit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {people.map(p => (
                  <tr key={p.id}>
                    <td className="td-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)' }}>
                          {p.avatar ? <img src={p.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" /> : p.name[0]?.toUpperCase()}
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td>{p.student_id || '—'}</td>
                    {activeTab === 'student' ? (
                      <td>{[p.grade_level, p.section].filter(Boolean).join(' - ') || '—'}</td>
                    ) : (
                      <>
                        <td>{p.department || '—'}</td>
                        <td>{p.grade_level || '—'}</td> {/* We use grade_level to store Position for faculty, or if we don't have a specific field, maybe it's in department */}
                      </>
                    )}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {p.last_clinic_visit ? new Date(p.last_clinic_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No visits recorded'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {canConsult && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setSelectedPerson(p)}
                          >
                            Start Consultation
                          </button>
                        )}
                        <Link to={`/clinic/people/${p.role === 'student' ? 'student' : 'staff'}/${p.id}`} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                          View Profile
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={lastPage}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={(p) => fetchPeople(search, p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            fetchPeople(search, 1)
          }}
        />

      </div>

      {selectedPerson && !isDentist && (
        <ConsultationModal
          initialData={{ patient: selectedPerson, patient_id: selectedPerson.patient_id }}
          onClose={() => setSelectedPerson(null)}
          onSaved={() => setSelectedPerson(null)}
        />
      )}
      {selectedPerson && isDentist && (
        <DentalConsultationModal
          initialData={{ patient: selectedPerson, patient_id: selectedPerson.patient_id }}
          onClose={() => setSelectedPerson(null)}
          onSaved={() => setSelectedPerson(null)}
        />
      )}
    </DashboardLayout>
  )
}
