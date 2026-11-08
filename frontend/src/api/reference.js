import api from './axios'
import { cached, TTL } from './referenceCache'

// Reference data through the shared axios instance and the in-memory cache (see referenceCache.js).
// Every function resolves to `{ data }` like a normal axios response, so callers keep using `res.data`.
// The values are shared between callers: read them, never change them in place.
const get = (path, config) => api.get(path, config).then((res) => ({ data: res.data }))

export const referenceApi = {
  sections:    () => cached('sections', TTL.REFERENCE, () => get('/sections')),
  gradeLevels: () => cached('grade-levels', TTL.REFERENCE, () => get('/grade-levels')),

  /** A system setting. Missing keys (404) are not stored, so they are asked again next time. */
  setting: (key) => cached(`setting:${key}`, TTL.SETTING, () => get(`/settings/${key}`)),

  /** Everybody who can be a patient (consultation forms). */
  patients: () => cached('patients', TTL.PICK_LIST, () => get('/clinic/patients')),

  /** Active items with their stock, for the Stock In / Stock Out lists. */
  itemOptions: (params) =>
    cached(`inventory:item-options:${JSON.stringify(params || {})}`, TTL.STOCK, () => get('/inventory/item-options', { params })),
}
