import { EMPTY } from './emptyValue'

// Shared "Grade & Section / Department" column for patient/people list pages.
// Students have no department — they show "Grade Level · Section"; faculty/staff show
// their department. One helper keeps every table identical.

export const ORG_COLUMN_LABEL = 'Grade & Section / Department'
export const ORG_SEARCH_PLACEHOLDER = 'Search by name, ID, grade, section, department, or email...'

export function orgLabel(user) {
  if (!user) return EMPTY
  if (user.role === 'student') {
    return [user.grade_level, user.section].filter(Boolean).join(' · ') || EMPTY
  }
  return user.department || EMPTY
}

// Lowercase haystack of the org fields, for client-side search boxes.
export function orgSearchText(user) {
  return [user?.grade_level, user?.section, user?.department]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
