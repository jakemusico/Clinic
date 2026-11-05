import React from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'
import { EMPTY } from '../../utils/emptyValue'

const STATUS_MAP = {
  pending:   { label: 'Pending',   cls: 'pending' },
  confirmed: { label: 'Confirmed', cls: 'confirmed' },
  completed: { label: 'Completed', cls: 'completed' },
  cancelled: { label: 'Cancelled', cls: 'cancelled' },
}

export default function QueueTable({
  title = "Today's Queue",
  subtitle,
  viewAllLink,
  items = [],
  role = 'nurse', // 'admin' | 'nurse' | 'dentist'
  loading = false,
}) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h2 className="dash-card-title">{title}</h2>
          {subtitle && <p className="dash-card-subtitle">{subtitle}</p>}
        </div>
        {viewAllLink && (
          <Link to={viewAllLink} className="dash-card-header-link">
            View All
          </Link>
        )}
      </div>

      <div className="dash-card-body-table">
        {loading ? (
          <div className="dash-loading-wrap">
            <div className="loader-ring" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            message={
              role === 'admin'
                ? 'No appointments scheduled for today.'
                : role === 'dentist'
                ? 'No dental patients in today\'s queue.'
                : 'No medical patients in today\'s queue.'
            }
            subtext="New bookings and walk-ins will appear here automatically."
          />
        ) : (
          <div className="table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Time</th>
                  <th>Patient</th>
                  <th>Service</th>
                  {role === 'admin' && <th>Staff / Provider</th>}
                  <th style={{ width: '100px' }}>Status</th>
                  <th style={{ width: role === 'dentist' ? '240px' : '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const s = STATUS_MAP[row.status] || { label: row.status, cls: 'pending' }
                  const patientUrl = row.patient_user_id
                    ? `/clinic/people/${row.patient_type === 'Student' ? 'student' : 'staff'}/${row.patient_user_id}`
                    : null

                  return (
                    <tr key={row.id}>
                      <td className="dash-td-time">
                        <span className="dash-time-badge">{row.time || EMPTY}</span>
                      </td>
                      <td>
                        <div className="dash-patient-name">{row.patient_name}</div>
                        <div className="dash-patient-meta">
                          {row.student_id ? `${row.student_id} · ` : ''}
                          {row.patient_type || 'Patient'}
                        </div>
                      </td>
                      <td className="dash-td-service">{row.service_name}</td>
                      {role === 'admin' && (
                        <td className="dash-td-staff">{row.staff_name || 'Assigned Staff'}</td>
                      )}
                      <td>
                        <span className={`status-badge ${s.cls}`}>{s.label}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="dash-actions-group">
                          {patientUrl && (
                            <Link to={patientUrl} className="dash-btn-link" title="View Patient Profile">
                              View
                            </Link>
                          )}

                          {/* Start Consultation button */}
                          {role === 'nurse' && (
                            <Link
                              to={`/clinic/consultations?appointment_id=${row.id}&patient_id=${row.patient_id}`}
                              className="dash-btn-action"
                            >
                              Start Consultation
                            </Link>
                          )}

                          {role === 'dentist' && (
                            <>
                              <Link
                                to={`/dental/consultations?appointment_id=${row.id}&patient_id=${row.patient_id}`}
                                className="dash-btn-action"
                              >
                                Start Consultation
                              </Link>
                              <Link
                                to={`/dental/chart/${row.patient_id}`}
                                className="dash-btn-secondary"
                                title="Open Dental Odontogram & Chart"
                              >
                                Charting
                              </Link>
                            </>
                          )}

                          {role === 'admin' && (
                            <Link
                              to="/clinic/appointments"
                              className="dash-btn-link"
                            >
                              Manage
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
