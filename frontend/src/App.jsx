import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ChatbotProvider } from './context/ChatbotContext'
import { ProtectedRoute, PublicRoute } from './components/RouteGuards'
import { PageFallback } from './components/dashboard/Fallbacks'
import ErrorBoundary from './components/ErrorBoundary'

import Login    from './pages/Login'
const Register = lazy(() => import('./pages/Register'))
const StudentDashboard = lazy(() => import('./pages/dashboards/StudentDashboard'))
const FacultyDashboard = lazy(() => import('./pages/dashboards/FacultyDashboard'))
const ClinicStaffDashboard = lazy(() => import('./pages/dashboards/ClinicStaffDashboard'))
const DentistDashboard = lazy(() => import('./pages/dashboards/DentistDashboard'))
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'))
import DashboardShell       from './components/DashboardShell'

const ServicesPage = lazy(() => import('./pages/clinic/ServicesPage'))
const SchedulePage = lazy(() => import('./pages/clinic/SchedulePage'))
const PatientRecordsPage = lazy(() => import('./pages/clinic/PatientRecordsPage'))
const MyRecordsPage = lazy(() => import('./pages/patient/MyRecordsPage'))
const AppointmentsPage = lazy(() => import('./pages/patient/AppointmentsPage'))
const HelpContactPage = lazy(() => import('./pages/patient/HelpContactPage'))
const AppointmentsManagementPage = lazy(() => import('./pages/clinic/AppointmentsManagementPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ChatbotSupportPage = lazy(() => import('./pages/clinic/ChatbotSupportPage'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'))
const TermsEditorPage = lazy(() => import('./pages/admin/TermsEditorPage'))
const SectionsPage = lazy(() => import('./pages/admin/SectionsPage'))
const AdminCalendarPage = lazy(() => import('./pages/admin/AdminCalendarPage'))
const ClinicInfoPage = lazy(() => import('./pages/admin/ClinicInfoPage'))
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage'))
const InventoryDashboardPage = lazy(() => import('./pages/admin/InventoryDashboardPage'))
const InventoryItemsPage = lazy(() => import('./pages/admin/InventoryItemsPage'))
const StockInPage = lazy(() => import('./pages/admin/StockInPage'))
const StockOutPage = lazy(() => import('./pages/admin/StockOutPage'))
const InventoryTransactionsPage = lazy(() => import('./pages/admin/InventoryTransactionsPage'))
const ReportsPage = lazy(() => import('./pages/clinic/ReportsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ConsultationsPage = lazy(() => import('./pages/clinic/ConsultationsPage'))
const PeoplePage = lazy(() => import('./pages/clinic/PeoplePage'))
const PersonProfilePage = lazy(() => import('./pages/clinic/PersonProfilePage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const StaffMessagesPage = lazy(() => import('./pages/clinic/StaffMessagesPage'))

// Dental pages
const DentalAppointmentsPage = lazy(() => import('./pages/dental/DentalAppointmentsPage'))
const DentalConsultationsPage = lazy(() => import('./pages/dental/DentalConsultationsPage'))
const DentalChartPage = lazy(() => import('./pages/dental/DentalChartPage'))
const DentalPatientRecordsPage = lazy(() => import('./pages/dental/DentalPatientRecordsPage'))

/** /admin/inventory/... -> /clinic/inventory/... (keeps ?search= and #hash) */
function LegacyInventoryRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={pathname.replace(/^\/admin\/inventory/, '/clinic/inventory') + search + hash} replace />
}

/** Catches render errors and failed page-file downloads below it; moving to another page clears the error. */
function RoutesBoundary({ children }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

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

          <Suspense fallback={<PageFallback />}>
          <RoutesBoundary>
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
              <Route path="/dental/records"
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

              {/* Inventory Management — shared by admin, clinic_staff (nurse) and dentist, so it lives under /clinic like the other shared staff pages */}
              <Route path="/clinic/inventory"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <InventoryDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/inventory/items"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <InventoryItemsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/inventory/stock-in"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <StockInPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/inventory/stock-out"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <StockOutPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/clinic/inventory/transactions"
                element={
                  <ProtectedRoute roles={['admin', 'clinic_staff', 'dentist']}>
                    <InventoryTransactionsPage />
                  </ProtectedRoute>
                }
              />
              {/* Old URLs (bookmarks, saved notification links) keep working */}
              <Route path="/admin/inventory/*" element={<LegacyInventoryRedirect />} />

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
          </RoutesBoundary>
          </Suspense>
        </BrowserRouter>
      </ChatbotProvider>
    </AuthProvider>
  )
}
