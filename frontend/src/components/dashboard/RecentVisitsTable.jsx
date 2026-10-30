import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'
import Pagination from '../Pagination'

export default function RecentVisitsTable({
  visits = [],
  loading = false,
  viewAllLink = '/clinic/consultations',
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const totalPages = Math.ceil(visits.length / pageSize) || 1
  const paginatedVisits = visits.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="dash-card" style={{ width: '100%' }}>
      <div className="dash-card-header">
        <div>
          <h2 className="dash-card-title">Recent Visits</h2>
          <p className="dash-card-subtitle">
            Latest completed consultation visits and clinical encounters
          </p>
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
        ) : visits.length === 0 ? (
          <EmptyState
            message="No consultation visits recorded yet."
            subtext="Patient consultation visits will appear here once conducted."
          />
        ) : (
          <div className="table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Student / Patient</th>
                  <th>Service</th>
                  <th>Complaint / Diagnosis</th>
                  <th style={{ width: '110px' }}>Status</th>
                  <th>Attending Staff</th>
                  <th style={{ width: '120px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVisits.map((v) => {
                  const patientUrl = v.patient_user_id
                    ? `/clinic/people/${v.role === 'student' ? 'student' : 'staff'}/${v.patient_user_id}`
                    : null

                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="dash-patient-name">
                          {patientUrl ? (
                            <Link to={patientUrl} style={{ color: 'inherit', textDecoration: 'none' }}>
                              {v.student_name}
                            </Link>
                          ) : (
                            v.student_name
                          )}
                        </div>
                        <div className="dash-patient-meta">
                          {v.student_id !== '—' ? `${v.student_id} · ` : ''}
                          {v.role === 'student' ? 'Student' : (v.role === 'faculty_staff' ? 'Faculty/Staff' : 'Patient')}
                        </div>
                      </td>
                      <td className="dash-td-service">{v.service}</td>
                      <td className="dash-td-diagnosis">
                        <span className="dash-diagnosis-text">{v.complaint_diagnosis}</span>
                      </td>
                      <td>
                        <span className="status-badge completed">
                          {v.status || 'Completed'}
                        </span>
                      </td>
                      <td className="dash-td-staff">{v.attending_staff}</td>
                      <td className="dash-td-date">
                        <span className="dash-date-text">{v.date}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={visits.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1)
          }}
          style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}
        />
      </div>
    </div>
  )
}
