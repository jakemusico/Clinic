import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import { getFaqs, groupScheduleDays } from '../../utils/clinicStorage'

export default function HelpContactPage() {
  const [clinicInfo, setClinicInfo] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [faqs, setFaqs]             = useState([])
  const [openFaq, setOpenFaq]       = useState(0)

  const fetchClinicInfo = async () => {
    setLoading(true)
    try {
      const res = await api.get('/settings/clinic_info')
      if (res.data?.value) {
        const parsed = JSON.parse(res.data.value)
        setClinicInfo(parsed)
      }
    } catch (err) {
      console.error('Failed to load clinic info from database:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClinicInfo()

    const allFaqs = getFaqs()
    const helpFaqs = allFaqs.filter(f => f.is_active !== false && f.show_on_help !== false)
    setFaqs(helpFaqs)
  }, [])

  const groupedSchedule = clinicInfo?.schedule ? groupScheduleDays(clinicInfo.schedule) : []

  return (
    <DashboardLayout
      title="Help & Contact Clinic"
      subtitle="Operating hours, campus location, hotlines, and frequently asked questions."
    >
      {loading || !clinicInfo ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Info Grid: Hours, Location, Contact */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          
          {/* Card 1: Operating Hours */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Clinic Hours</h3>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              {groupedSchedule.map((group, idx) => (
                <div
                  key={group.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingBottom: idx !== groupedSchedule.length - 1 ? '0.5rem' : '0',
                    borderBottom: idx !== groupedSchedule.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{ color: group.is_open ? 'var(--text-sub)' : 'var(--text-muted)' }}>
                    {group.label}:
                  </span>
                  <strong style={{ color: group.is_open ? 'var(--text)' : 'var(--text-muted)' }}>
                    {group.hours}
                  </strong>
                </div>
              ))}
              {clinicInfo.schedule_note && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  <em>Note: {clinicInfo.schedule_note}</em>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Campus Location */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Location</h3>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>
                <strong>{clinicInfo.location_name}</strong><br />
                {clinicInfo.location_address}<br />
                {clinicInfo.location_landmark}
              </p>
            </div>
          </div>

          {/* Card 3: Contact Lines */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Contact Lines</h3>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-sub)' }}>Clinic Trunkline:</span>
                <strong style={{ color: 'var(--text)' }}>{clinicInfo.contact_trunkline}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-sub)' }}>Mobile Hotline:</span>
                <strong style={{ color: 'var(--accent)' }}>{clinicInfo.contact_mobile}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-sub)' }}>Email:</span>
                <a href={`mailto:${clinicInfo.contact_email}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                  {clinicInfo.contact_email}
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Section: Frequently Asked Questions (FAQ) - Full Width */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem 0' }}>
            Frequently Asked Questions (FAQ)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
            Quick answers about clinic services, scheduling, and clearances.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={faq.id || idx}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    transition: 'all var(--transition)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.85rem 1rem',
                      background: isOpen ? '#f8fafc' : '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--text)' }}>
                      {faq.question}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color: 'var(--text-muted)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0.85rem 1rem', fontSize: '0.835rem', color: 'var(--text-sub)', lineHeight: 1.55, background: '#ffffff', borderTop: '1px solid var(--border)', whiteSpace: 'pre-line' }}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
      )}
    </DashboardLayout>
  )
}
