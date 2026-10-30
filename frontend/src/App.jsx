import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ChatbotProvider } from './context/ChatbotContext'
import { ProtectedRoute, PublicRoute } from './components/RouteGuards'

import Login    from './pages/Login'
import Register from './pages/Register'
import StudentDashboard     from './pages/dashboards/StudentDashboard'
import FacultyDashboard     from './pages/dashboards/FacultyDashboard'
import ClinicStaffDashboard from './pages/dashboards/ClinicStaffDashboard'
import DentistDashboard     from './pages/dashboards/DentistDashboard'
import AdminDashboard       from './pages/dashboards/AdminDashboard'
import DashboardShell       from './components/DashboardShell'

import ServicesPage         from './pages/clinic/ServicesPage'
import SchedulePage         from './pages/clinic/SchedulePage'
import PatientRecordsPage   from './pages/clinic/PatientRecordsPage'
import MyRecordsPage        from './pages/patient/MyRecordsPage'
import AppointmentsPage     from './pages/patient/AppointmentsPage'
import HelpContactPage      from './pages/patient/HelpContactPage'
import AppointmentsManagementPage from './pages/clinic/AppointmentsManagementPage'
import NotificationsPage from './pages/NotificationsPage'
import ChatbotSupportPage from './pages/clinic/ChatbotSupportPage'
import UsersPage        from './pages/admin/UsersPage'
import AuditLogsPage    from './pages/admin/AuditLogsPage'
import TermsEditorPage  from './pages/admin/TermsEditorPage'
import SectionsPage     from './pages/admin/SectionsPage'
import AdminCalendarPage from './pages/admin/AdminCalendarPage'
import ClinicInfoPage from './pages/admin/ClinicInfoPage'
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage'
import InventoryDashboardPage from './pages/admin/InventoryDashboardPage'
import InventoryItemsPage from './pages/admin/InventoryItemsPage'
import StockInPage from './pages/admin/StockInPage'
import StockOutPage from './pages/admin/StockOutPage'
import InventoryTransactionsPage from './pages/admin/InventoryTransactionsPage'
import ReportsPage      from './pages/clinic/ReportsPage'
import ProfilePage      from './pages/ProfilePage'
import SettingsPage     from './pages/SettingsPage'
import ConsultationsPage from './pages/clinic/ConsultationsPage'
import PeoplePage         from './pages/clinic/PeoplePage'
import PersonProfilePage  from './pages/clinic/PersonProfilePage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import StaffMessagesPage from './pages/clinic/StaffMessagesPage'

// Dental pages
import DentalAppointmentsPage   from './pages/dental/DentalAppointmentsPage'
import DentalConsultationsPage  from './pages/dental/DentalConsultationsPage'
import DentalChartPage          from './pages/dental/DentalChartPage'
import DentalPatientRecordsPage from './pages/dental/DentalPatientRecordsPage'

export default function App() {
  return (
    <AuthProvider>
      <ChatbotProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                fontSize: '0.88rem',
                fontWeight: 500,
              },
              success: { iconTheme: { primary: '#16a34a', secondary: '#ffffff' } },
              error:   { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
            }}
          />

          <Routes>
            {/* Root */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public */}
            <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            {/* Force change password — accessible while logged in, bypasses ProtectedRoute */}
            <Route path="/change-password" element={<ChangePasswordPage />} />

            {/* Dashboard Shell wrappers */}
            <Route element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
              {/* Role dashboards */}
              <Route path="/dashboard/student"
                element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/faculty"
                element={<ProtectedRoute roles={['faculty_staff']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/clinic-staff"
                element={<ProtectedRoute roles={['clinic_staff']}><ClinicStaffDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/dentist"
                element={<ProtectedRoute roles={['dentist']}><DentistDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin"
                element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />

              {/* Appointments Scheduling & Management */}
              <Route path="/appointments"
                element={
                  <ProtectedRoute roles={['student', 'faculty_staff']}>
                    <AppointmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/appointments"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'admin']}>
                    <AppointmentsManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Dental Module Routes */}
              <Route path="/dental/appointments"
                element={
                  <ProtectedRoute roles={['dentist', 'admin']}>
                    <DentalAppointmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/dental/consultations"
                element={
                  <ProtectedRoute roles={['dentist', 'admin']}>
                    <DentalConsultationsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/dental/chart"
                element={
                  <ProtectedRoute roles={['dentist', 'admin', 'student', 'faculty_staff']}>
                    <DentalChartPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/dental/patients"
                element={
                  <ProtectedRoute roles={['dentist', 'admin']}>
                    <DentalPatientRecordsPage />
                  </ProtectedRoute>
                }
              />

              {/* Clinic Services — clinic_staff + dentist + admin */}
              <Route path="/clinic/services"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist', 'admin']}>
                    <ServicesPage />
                  </ProtectedRoute>
                }
              />

              {/* Staff Schedule — clinic_staff + dentist + admin */}
              <Route path="/clinic/schedule"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist', 'admin']}>
                    <SchedulePage />
                  </ProtectedRoute>
                }
              />

              {/* Patient Records — Medical */}
              <Route path="/my-records"
                element={
                  <ProtectedRoute roles={['student', 'faculty_staff']}>
                    <MyRecordsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/help-contact"
                element={
                  <ProtectedRoute roles={['student', 'faculty_staff']}>
                    <HelpContactPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/records"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'admin']}>
                    <PatientRecordsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/consultations"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'admin']}>
                    <ConsultationsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/people"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist', 'admin']}>
                    <PeoplePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/people/student/:id"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist', 'admin']}>
                    <PersonProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/people/staff/:id"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist', 'admin']}>
                    <PersonProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Staff Messages — Nurse & Dentist */}
              <Route path="/clinic/messages"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist']}>
                    <StaffMessagesPage />
                  </ProtectedRoute>
                }
              />

              {/* Notifications — all roles */}
              <Route path="/notifications"
                element={
                  <ProtectedRoute roles={['student', 'faculty_staff', 'clinic_staff', 'dentist', 'admin']}>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />

              {/* Chatbot Support — admin only */}
              <Route path="/chatbot/support"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <ChatbotSupportPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/chatbot/faqs" element={<Navigate to="/chatbot/support" replace />} />

              {/* Reports — clinic_staff + dentist + admin */}
              <Route path="/clinic/reports"
                element={
                  <ProtectedRoute roles={['clinic_staff', 'dentist', 'admin']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/admin/users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/calendar"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminCalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/audit-logs"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AuditLogsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/terms"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <TermsEditorPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/sections"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <SectionsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/clinic-info"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <ClinicInfoPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/announcements"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminAnnouncementsPage />
                  </ProtectedRoute>
                }
              />

              {/* Inventory Management — admin, clinic_staff, dentist */}
              <Route path="/admin/inventory"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <InventoryDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/inventory/items"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <InventoryItemsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/inventory/stock-in"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <StockInPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/inventory/stock-out"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <StockOutPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/inventory/transactions"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <InventoryTransactionsPage />
                  </ProtectedRoute>
                }
              />

              {/* Profile & Settings — all roles */}
              <Route path="/profile"
                element={
                  <ProtectedRoute roles={['student', 'faculty_staff', 'clinic_staff', 'dentist', 'admin']}>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings"
                element={
                  <ProtectedRoute roles={['student', 'faculty_staff', 'clinic_staff', 'dentist', 'admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>
        </BrowserRouter>
      </ChatbotProvider>
    </AuthProvider>
  )
}
