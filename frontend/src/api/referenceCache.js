// Small in-memory cache for data that many screens ask for again and again (sections, grade levels,
// settings, the patient and item pick lists). It lives only in this browser tab: a reload starts empty.
//
//   cached(key, ttlMs, load)   same key within the TTL -> the stored value (no request);
//                              callers asking while a request is running share that one request.
//   invalidate(prefix)         forget every key that starts with prefix (call it after a write)
//   clearAll()                 forget everything (sign out, sign in, expired session)
//
// Failed requests are never stored. Nothing here knows about axios, so axios.js can import it.

const entries = new Map()   // key -> { promise } while loading, { at, ttl, value } when stored

export function cached(key, ttlMs, load) {
  const hit = entries.get(key)
  if (hit) {
    if (hit.promise) return hit.promise
    if (Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.value)
  }

  const promise = Promise.resolve().then(load).then(
    (value) => {
      // only keep the answer if this entry was not invalidated while the request was running
      if (entries.get(key)?.promise === promise) entries.set(key, { at: Date.now(), ttl: ttlMs, value })
      return value
    },
    (err) => {
      if (entries.get(key)?.promise === promise) entries.delete(key)
      throw err
    },
  )
  entries.set(key, { promise })
  return promise
}

export function invalidate(prefix) {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) entries.delete(key)
  }
}

export function clearAll() {
  entries.clear()
}

// Lifetimes
export const TTL = {
  REFERENCE: 5 * 60 * 1000,   // sections, grade levels
  SETTING: 60 * 1000,         // clinic info, chat settings, ...
  PICK_LIST: 60 * 1000,       // patients for the consultation forms
  STOCK: 30 * 1000,           // item pick list (shows the stock): also forgotten after every stock change made here
}
