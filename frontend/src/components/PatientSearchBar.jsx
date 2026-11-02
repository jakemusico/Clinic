import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import Avatar from './Avatar'

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

export default function PatientSearchBar() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  
  const containerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/search-patients', { params: { query: query.trim() } })
        setResults(data.users || [])
        setIsOpen(true)
        setActiveIndex(-1)
      } catch (err) {
        console.error('Search error', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleKeyDown = (e) => {
    if (!isOpen) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, Math.min(results.length - 1, 4)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex])
      } else {
        handleViewAll()
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleSelect = (patientUser) => {
    setIsOpen(false)
    setQuery('')
    const type = patientUser.role === 'student' ? 'student' : 'staff'
    navigate(`/clinic/people/${type}/${patientUser.id}`)
  }

  const handleViewAll = () => {
    setIsOpen(false)
    navigate(`/clinic/people?search=${encodeURIComponent(query)}`)
    setQuery('')
  }

  if (!user || !['clinic_staff', 'dentist', 'admin'].includes(user.role)) return null

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '320px', marginLeft: 'auto', marginRight: '1rem' }}>
      <div className="global-search-container">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.trim().length >= 2) setIsOpen(true) }}
          placeholder="Search patients by name or ID..."
          className="global-search-input"
        />
        {loading && (
          <div style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)' }}>
            <div className="loader-ring" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
          </div>
        )}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 0.25rem)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 100, overflow: 'hidden'
        }}>
          <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
            Patients
          </div>
          {results.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No patients found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {results.slice(0, 5).map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    background: activeIndex === i ? 'var(--bg-hover)' : 'transparent',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <Avatar src={r.avatar_url} name={r.name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-sub)' }}>{r.student_id || 'No ID'}</span>
                      <span>·</span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.role === 'faculty_staff' ? 'Faculty/Staff' : [r.grade_level, r.section].filter(Boolean).join(' - ') || 'Student'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div
                onClick={handleViewAll}
                style={{
                  padding: '0.5rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  background: activeIndex === -1 ? 'var(--bg-hover)' : 'transparent'
                }}
              >
                View all results
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
