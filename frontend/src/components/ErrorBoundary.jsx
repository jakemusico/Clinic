import { Component } from 'react'

/**
 * Catches errors thrown while rendering the page below it, so a bug (or a page file that could not
 * be downloaded) shows a message and a Reload button instead of a blank white screen.
 *
 * Chunk-load errors happen right after a deploy: the open tab still asks for page files whose
 * names have changed. For those the page reloads itself ONCE to pick up the new version; if that
 * does not help (or it already happened a moment ago) the message and button are shown.
 *
 * `resetKey` (the current path) clears the error when the user navigates elsewhere.
 */

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk/i
const RELOAD_KEY = 'clinic:chunk-reload-at'
const RELOAD_WINDOW_MS = 30 * 1000   // never reload automatically more than once in this time

const isChunkLoadError = (error) =>
  CHUNK_ERROR.test(`${error?.name || ''} ${error?.message || ''}`)

/** Reload the page once for a chunk error. Returns false when it already did so a moment ago. */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false   // no sessionStorage: cannot guard against a reload loop, so do not reload
  }
  window.location.reload()
  return true
}

export default class ErrorBoundary extends Component {
  state = { error: null, reloading: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  // moving to another page clears the error
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, reloading: false, resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack)
    if (isChunkLoadError(error) && reloadOnce()) {
      this.setState({ reloading: true })
    }
  }

  componentDidMount() {
    // Vite reports a failed preload of a page file with this event
    this.onPreloadError = () => { reloadOnce() }
    window.addEventListener('vite:preloadError', this.onPreloadError)
  }

  componentWillUnmount() {
    window.removeEventListener('vite:preloadError', this.onPreloadError)
  }

  render() {
    const { error, reloading } = this.state
    if (!error) return this.props.children

    if (reloading) {
      return (
        <div className="table-loading" style={{ minHeight: '40vh' }} role="status">
          <div className="loader-ring" />
        </div>
      )
    }

    const chunk = isChunkLoadError(error)

    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '0.75rem', padding: '2rem', textAlign: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text, #0F172A)' }}>
          {chunk ? 'A new version is available' : 'Something went wrong'}
        </h2>
        <p style={{ margin: 0, maxWidth: '420px', fontSize: '0.9rem', color: 'var(--text-sub, #64748B)', lineHeight: 1.6 }}>
          {chunk
            ? 'This page could not be loaded because the app was updated. Reload to get the latest version.'
            : 'This page hit an unexpected problem. Reloading usually fixes it. If it keeps happening, please tell the clinic administrator.'}
        </p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
