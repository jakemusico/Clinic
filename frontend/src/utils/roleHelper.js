/**
 * Helper to map role values to display labels and build role options from patient data.
 * 
 * Backend role values (from app/Support/Roles.php):
 * - STUDENT = 'student'
 * - FACULTY = 'faculty_staff'
 * - NURSE = 'clinic_staff'
 * - DENTIST = 'dentist'
 * - ADMIN = 'admin'
 */

/**
 * Map backend role value to display label.
 * @param {string} roleValue - The role value from the backend (e.g., 'student', 'faculty_staff')
 * @returns {string} Display label (e.g., 'Student', 'Faculty / Staff')
 */
export const roleToLabel = (roleValue) => {
  if (!roleValue) return 'Unknown'
  
  const labelMap = {
    'student': 'Student',
    'faculty_staff': 'Faculty / Staff',
    'clinic_staff': 'Clinic Staff',
    'dentist': 'Dentist',
    'admin': 'Admin',
  }
  
  return labelMap[roleValue] || roleValue
}

/**
 * Build a list of role filter options from patient data.
 * Deduplicates role values and creates option objects.
 * @param {Array} patients - List of patient objects with user.role field
 * @returns {Array} Array of option objects: [{ value, label }, ...]
 */
export const buildRoleOptions = (patients) => {
  const roleSet = new Set()
  
  patients.forEach(p => {
    const roleValue = p.user?.role || p.role
    if (roleValue) {
      roleSet.add(roleValue)
    }
  })
  
  // Sort for consistent order
  const roles = Array.from(roleSet).sort()
  
  return roles.map(roleValue => ({
    value: roleValue,
    label: roleToLabel(roleValue),
  }))
}

/**
 * Filter patients by role.
 * @param {Array} patients - List of patient objects
 * @param {string} roleFilter - The selected role value to filter by, or 'all' for no filter
 * @returns {Array} Filtered patients
 */
export const filterPatientsByRole = (patients, roleFilter) => {
  if (roleFilter === 'all') {
    return patients
  }
  
  return patients.filter(p => {
    const roleValue = p.user?.role || p.role
    return roleValue === roleFilter
  })
}
