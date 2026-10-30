import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_ROUTES = {
  student:       '/dashboard/student',
  faculty_staff: '/dashboard/faculty',
  clinic_staff:  '/dashboard/clinic-staff',
  nurse:         '/dashboard/clinic-staff',
  dentist:       '/dashboard/dentist',
  admin:         '/dashboard/admin',
}

/**
 * Helper to safely extract role slug from user model / object.
 */
export function getRoleSlug(user) {
  if (!user) return ''
  if (typeof user.role === 'string') return user.role
  if (user.role?.slug) return user.role.slug
  if (user.role_slug) return user.role_slug
  return ''
}

/**
 * ProtectedRoute — requires auth + optional role check.
 * If `roles` is provided, user's role must be in that list.
 */
export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="splash-loader"><span className="loader-ring" /></div>

  if (!user) return <Navigate to="/login" replace />

  // Force password change for admin-created accounts
  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  const userRole = getRoleSlug(user)

  if (roles) {
    const hasRole = roles.some(r => {
      if (r === userRole) return true
      if ((r === 'clinic_staff' || r === 'nurse') && (userRole === 'clinic_staff' || userRole === 'nurse')) return true
      return false
    })

    if (!hasRole) {
      // Redirect to their correct dashboard instead of 403
      return <Navigate to={ROLE_ROUTES[userRole] || '/login'} replace />
    }
  }

  return children
}

/**
 * PublicRoute — redirects logged-in users to their dashboard.
 */
export function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="splash-loader"><span className="loader-ring" /></div>

  if (user) {
    const userRole = getRoleSlug(user)
    const dest = ROLE_ROUTES[userRole] || '/dashboard/student'
    return <Navigate to={dest} replace />
  }

  return children
}

export { ROLE_ROUTES }
