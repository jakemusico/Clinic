import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { formatAppointmentDate } from '../../utils/dateUtils'

export default function PersonProfilePage() {
  const { id } = useParams()
  const { user: authUser } = useAuth()
  
  const [profileUser, setProfileUser] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  const hasMedical = ['clinic_staff', 'admin'].includes(authUser.role)
  const hasDental = ['dentist', 'admin'].includes(authUser.role)

  const [activeTab, setActiveTab] = useState(hasMedical ? 'medical' : 'dental')

  useEffect(() => {
    fetchProfile()
  }, [id])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/clinic/people/${id}`)
      setProfileUser(data.user)
      setAppointments(data.appointments || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Loading Profile..." subtitle="Fetching clinic information...">
        <div className="table-loading"><div className="loader-ring" /></div>
      </DashboardLayout>
    )
  }

  if (!profileUser) {
    return (
      <DashboardLayout title="Not Found" subtitle="Profile not found.">
        <div className="empty-state"><p>We couldn't find this person.</p></div>
      </DashboardLayout>
    )
  }

  const isStudent = profileUser.role === 'student'
  const p = profileUser.patient || {}
  const clinicRecords = p.clinic_records || []
  const dentalConsultations = p.dental_consultations || []

  // Filter appointments based on role
  const filteredAppointments = appointments.filter(a => {
    if (a.appointment_type === 'dental') return hasDental
    return hasMedical
  })

  return (
    <DashboardLayout
      title={`${profileUser.name}'s Clinic Profile`}
      subtitle={`Clinic records and health information for ${isStudent ? 'Student' : 'Faculty/Staff'}.`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start', marginBottom: '1.5rem' }}>
        
        {/* Left Column - Basics & Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ padding: '2rem 1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%', background: 'var(--border)',
                margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', fontWeight: 700, color: 'var(--text-sub)', overflow: 'hidden'
              }}>
                {profileUser.avatar ? (
                  <img src={profileUser.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                ) : (
                  profileUser.name[0]?.toUpperCase()
                )}
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>
                {profileUser.name}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {profileUser.email}
              </div>
              <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: '99px', background: isStudent ? 'rgba(37,99,235,0.1)' : 'rgba(13,148,136,0.1)', color: isStudent ? '#2563EB' : '#0D9488', fontSize: '0.75rem', fontWeight: 600 }}>
                {isStudent ? 'Student' : 'Faculty / Staff'}
              </div>
            </div>

            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Identification
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{isStudent ? 'Student ID' : 'Employee ID'}</span>
                <span style={{ fontWeight: 600 }}>{profileUser.student_id || '—'}</span>
              </div>
              {isStudent ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Grade Level</span>
                    <span style={{ fontWeight: 600 }}>{profileUser.grade_level || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Section</span>
                    <span style={{ fontWeight: 600 }}>{profileUser.section || '—'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Department</span>
                    <span style={{ fontWeight: 600 }}>{profileUser.department || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Position</span>
                    <span style={{ fontWeight: 600 }}>{profileUser.grade_level || '—'}</span>
                  </div>
                </>
              )}
            </div>

            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Personal Info
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Contact No.</span>
                <span style={{ fontWeight: 600 }}>{profileUser.contact_no || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Date of Birth</span>
                <span style={{ fontWeight: 600 }}>{p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Age</span>
                <span style={{ fontWeight: 600 }}>{p.age || profileUser.age || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sex</span>
                <span style={{ fontWeight: 600 }}>{p.gender ? (p.gender.charAt(0).toUpperCase() + p.gender.slice(1)) : '—'}</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Right Column - Health & Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Emergency Contact
              </h3>
              {isStudent && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Parent / Guardian</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.guardian_name || '—'} {p.guardian_relationship ? `(${p.guardian_relationship})` : ''}</div>
                  <div style={{ fontSize: '0.85rem' }}>{p.guardian_contact || '—'}</div>
                  {p.guardian_email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.guardian_email}</div>}
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Emergency Contact</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.emergency_name || p.guardian_name || '—'} {p.emergency_relationship ? `(${p.emergency_relationship})` : ''}</div>
                <div style={{ fontSize: '0.85rem' }}>{p.emergency_contact_no || p.emergency_contact || p.guardian_contact || '—'}</div>
                {p.emergency_alt_contact && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Alt: {p.emergency_alt_contact}</div>}
              </div>
            </div>

            <div className="card" style={{ padding: '1.5rem', background: 'rgba(220, 38, 38, 0.02)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: '#DC2626', borderBottom: '1px solid rgba(220, 38, 38, 0.2)', paddingBottom: '0.5rem' }}>
                Medical Alerts & Health Info
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Blood Type</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.blood_type || '—'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Allergies</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.allergies || 'None recorded'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Medical Conditions</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.medical_conditions || 'None recorded'}</span>
                </div>
                {p.current_medications && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Current Medications</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.current_medications}</span>
                  </div>
                )}
                {p.medical_history && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Medical History</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.medical_history}</span>
                  </div>
                )}
                {p.other_health_notes && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Other Health Notes</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.other_health_notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {hasMedical && (
                <button
                  style={{
                    flex: 1, padding: '1rem', border: 'none', background: activeTab === 'medical' ? '#ffffff' : 'var(--bg-crust)',
                    borderBottom: activeTab === 'medical' ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: 600, color: activeTab === 'medical' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => setActiveTab('medical')}
                >
                  Medical Records
                </button>
              )}
              {hasDental && (
                <button
                  style={{
                    flex: 1, padding: '1rem', border: 'none', background: activeTab === 'dental' ? '#ffffff' : 'var(--bg-crust)',
                    borderBottom: activeTab === 'dental' ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: 600, color: activeTab === 'dental' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => setActiveTab('dental')}
                >
                  Dental Records
                </button>
              )}
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              {activeTab === 'medical' && hasMedical && (
                <div>
                  {clinicRecords.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                      <p>No past medical records found for this patient.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {clinicRecords.map(c => (
                        <div key={c.id} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                              {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="status-badge completed" style={{ fontSize: '0.7rem' }}>
                              Medical Visit
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                            <div><strong>Chief Complaint:</strong> {c.chief_complaint || '—'}</div>
                            <div><strong>Diagnosis:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.diagnosis || c.assessment || 'General Check-up'}</span></div>
                            <div><strong>Treatment:</strong> {c.treatment || c.recommendation || '—'}</div>
                          </div>
                          {c.prescription && (
                            <div style={{ fontSize: '0.8rem', background: '#F8FAFC', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: '0.35rem' }}>
                              <strong>Prescription:</strong> {c.prescription}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'dental' && hasDental && (
                <div>
                  {dentalConsultations.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                      <p>No past dental consultations found for this patient.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {dentalConsultations.map((c) => (
                        <div key={c.id} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)' }}>
                              {c.diagnosis || 'Dental Checkup'}
                            </span>
                            <span className="status-badge completed" style={{ fontSize: '0.7rem' }}>
                              {new Date(c.consultation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          {c.affected_teeth && c.affected_teeth.length > 0 && (
                            <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                              <strong>Affected Teeth:</strong> <span className="status-badge pending" style={{ fontSize: '0.68rem' }}>#{c.affected_teeth.join(', #')}</span>
                            </div>
                          )}
                          {c.treatment_performed && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '0.25rem' }}>
                              <strong>Treatment:</strong> {c.treatment_performed}
                            </div>
                          )}
                          {c.recommendations && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              <strong>Recommendations:</strong> {c.recommendations}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
      
      <div className="card data-table-wrap">
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Recent Appointments</span>
        </div>
        {filteredAppointments.length === 0 ? (
          <div className="empty-state"><p>No appointments found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map(a => (
                <tr key={a.id}>
                  <td style={{ fontSize: '0.8rem' }}>
                    {formatAppointmentDate(a)}
                  </td>
                  <td>{a.service?.name || a.clinic_service?.name || '—'}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: a.appointment_type === 'dental' ? '#E0F2FE' : '#F1F5F9', color: a.appointment_type === 'dental' ? '#0369A1' : '#475569' }}>
                      {a.appointment_type === 'dental' ? 'Dental' : 'Medical'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${a.status}`}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </DashboardLayout>
  )
}
