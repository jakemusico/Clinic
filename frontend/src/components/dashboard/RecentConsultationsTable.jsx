import React from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'
import { EMPTY } from '../../utils/emptyValue'
import { formatDate } from '../../utils/dateUtils'

export default function RecentConsultationsTable({
  title = "Recent Consultations",
  items = [],
  viewAllLink = "/clinic/consultations",
  role = 'nurse', // 'nurse' | 'dentist'
  loading = false,
}) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">{title}</h2>
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
            message="No recent consultations found."
            subtext="Completed patient check-ups and treatments will appear here."
          />
        ) : (
          <div className="table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Date</th>
                  <th>Patient</th>
                  <th>{role === 'dentist' ? 'Procedure / Findings' : 'Chief Complaint / Diagnosis'}</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const patientUrl = row.patient_user_id
                    ? `/clinic/people/${row.patient_type === 'Student' ? 'student' : 'staff'}/${row.patient_user_id}`
                    : null

                  return (
                    <tr key={row.id}>
                      <td className="dash-td-date">
                        <span className="dash-date-text">{formatDate(row.visit_date || row.consultation_date)}</span>
                      </td>
                      <td>
                        <div className="dash-patient-name">{row.patient_name}</div>
                        <div className="dash-patient-meta">
                          {row.student_id ? `${row.student_id} · ` : ''}
                          {row.patient_type || 'Patient'}
                        </div>
                      </td>
                      <td className="dash-td-diagnosis">
                        <div className="dash-diagnosis-text">
                          {row.diagnosis || row.treatment_performed || EMPTY}
                        </div>
                        {role === 'dentist' && row.treatment_performed && (
                          <div className="dash-treatment-text">{row.treatment_performed}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {patientUrl ? (
                          <Link to={patientUrl} className="dash-btn-link">
                            View
                          </Link>
                        ) : (
                          EMPTY
                        )}
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
