import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import ConfirmModal from '../../components/ConfirmModal'
import { adminApi } from '../../api/admin'
import axios from 'axios'

export default function TermsEditorPage() {
  const [text, setText]       = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)

  useEffect(() => {
    axios.get('/api/settings/terms_and_privacy')
      .then(res => {
        const val = res.data.value || ''
        setText(val)
        setOriginal(val)
      })
      .catch(() => toast.error('Failed to load terms text.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.updateSetting('terms_and_privacy', text)
      setOriginal(text)
      setIsEditing(false)
      toast.success('Terms & Privacy Policy saved successfully.')
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (text !== original) {
      setDiscardConfirm(true)
      return
    }
    setText(original)
    setIsEditing(false)
  }

  const doDiscard = () => {
    setText(original)
    setIsEditing(false)
    setDiscardConfirm(false)
  }

  const isDirty = text !== original

  return (
    <DashboardLayout
      title="Terms & Data Privacy"
      subtitle="Edit the text shown to new users during registration."
    >
        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : (
          <div className="admin-card">
            {/* Header / Actions inside card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                {isEditing ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {text.length} characters
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    As seen by registering users
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {!isEditing ? (
                  <button className="btn-primary" onClick={() => setIsEditing(true)}>
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-outline"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={saving || !isDirty}
                    >
                      {saving ? <span className="btn-spinner" /> : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content Area */}
            {isEditing ? (
              <textarea
                id="terms-textarea"
                className="form-input"
                value={text}
                onChange={e => setText(e.target.value)}
                rows={25}
                style={{
                  width: '100%',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  background: '#FFFFFF',
                  backgroundColor: '#FFFFFF',
                }}
                placeholder="Enter terms and privacy policy text here..."
              />
            ) : (
              <div
                style={{
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  color: 'var(--text, #0F172A)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {text || <span style={{ color: 'var(--text-muted)' }}>Nothing to preview yet…</span>}
              </div>
            )}
          </div>
        )}
      {/* Discard Changes Modal */}
      <ConfirmModal
        open={discardConfirm}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        danger={true}
        onConfirm={doDiscard}
        onCancel={() => setDiscardConfirm(false)}
      />
    </DashboardLayout>
  )
}
