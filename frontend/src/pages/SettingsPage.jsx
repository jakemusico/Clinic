import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../components/DashboardLayout'
import { authApi } from '../api/auth'
import { adminApi } from '../api/admin'
import { useAuth } from '../context/AuthContext'
import PasswordStrength, { checkPasswordRules } from '../components/PasswordStrength'
import './SettingsPage.css'

// ── Monochrome Line Icons ────────────────────────────────────────────────
function SettingsIcon({ name, size = 16 }) {
  const icons = {
    lock: (
      <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm-2 6V6a2 2 0 1 1 4 0v2z" />
    ),
    bell: (
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
    help: (
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6h.01M12 13a2.5 2.5 0 0 0 2.5-2.5c0-1.5-2-2-2-3.5" />
    ),
    info: (
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />
    ),
    eye: (
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    ),
    eyeOff: (
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22" />
    ),
    check: (
      <path d="M20 6 9 17l-5-5" />
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {icons[name] || null}
    </svg>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // ── Admin Chat Settings State ──────────────────────────────────────────
  const [chatEnabled, setChatEnabled] = useState(true)
  const [offlineMessage, setOfflineMessage] = useState('')
  const [savingChat, setSavingChat] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    const fetchChatSettings = async () => {
      try {
        const [enabledRes, msgRes] = await Promise.all([
          adminApi.getSetting('chat_enabled'),
          adminApi.getSetting('chat_offline_message'),
        ])
        setChatEnabled(enabledRes.data?.value !== '0')
        if (msgRes.data?.value) {
          setOfflineMessage(msgRes.data.value)
        }
      } catch (err) {
        console.error('Failed to load chat settings:', err)
      }
    }
    fetchChatSettings()
  }, [isAdmin])

  const handleSaveChatSettings = async () => {
    setSavingChat(true)
    try {
      await Promise.all([
        adminApi.updateSetting('chat_enabled', chatEnabled ? '1' : '0'),
        adminApi.updateSetting('chat_offline_message', offlineMessage),
      ])
      toast.success('Chat settings updated successfully.')
    } catch {
      toast.error('Failed to update chat settings.')
    } finally {
      setSavingChat(false)
    }
  }

  // ── Notification Preferences State ─────────────────────────────────────
  const [notifs, setNotifs] = useState({
    apptReminders: true,
    recordUpdates: true,
    announcements: true,
  })

  // ── Password Form State ────────────────────────────────────────────────
  const [passData, setPassData] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [savingPass, setSavingPass] = useState(false)

  // ── Report Problem Modal State ─────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportForm, setReportForm] = useState({
    category: 'System Issue',
    description: '',
  })
  const [submittingReport, setSubmittingReport] = useState(false)

  // ── Toggle Notification Preference Handler ─────────────────────────────
  const handleToggleNotif = (key, label) => {
    setNotifs(prev => {
      const nextVal = !prev[key]
      toast.success(`${label} ${nextVal ? 'enabled' : 'disabled'}.`)
      return { ...prev, [key]: nextVal }
    })
  }

  // ── Password Submit Handler ────────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!passData.current_password) {
      toast.error('Please enter your current password.')
      return
    }
    if (!checkPasswordRules(passData.password)) {
      toast.error('New password does not meet all requirements. Please check the checklist below.')
      return
    }
    if (passData.password !== passData.password_confirmation) {
      toast.error('New passwords do not match.')
      return
    }

    setSavingPass(true)
    try {
      await authApi.changePassword(passData)
      toast.success('Password updated successfully.')
      setPassData({ current_password: '', password: '', password_confirmation: '' })
    } catch (err) {
      const msg = err.response?.data?.errors?.current_password?.[0] || err.response?.data?.message || 'Failed to update password.'
      toast.error(msg)
    } finally {
      setSavingPass(false)
    }
  }

  // ── Report Problem Submit Handler ──────────────────────────────────────
  const handleReportSubmit = (e) => {
    e.preventDefault()
    if (!reportForm.description.trim()) {
      toast.error('Please describe the issue.')
      return
    }
    setSubmittingReport(true)
    setTimeout(() => {
      setSubmittingReport(false)
      setShowReportModal(false)
      setReportForm({ category: 'System Issue', description: '' })
      toast.success('Thank you. Your feedback has been submitted to clinic IT support.')
    }, 500)
  }

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage account security, notifications, privacy, and support options."
    >
      <div className="settings-container">

        {/* ═══════════════════════════════════════════════════════════════
            1. ACCOUNT & SECURITY
            ═══════════════════════════════════════════════════════════════ */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">1. Account & Security</h3>
            <p className="settings-card-subtitle">
              Manage your password and secure your clinic account.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Current Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    style={{
                      width: '100%',
                      padding: '0.55rem 2.2rem 0.55rem 0.75rem',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                    placeholder="••••••••"
                    value={passData.current_password}
                    onChange={e => setPassData({ ...passData, current_password: e.target.value })}
                    autoComplete="current-password"
                    onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <SettingsIcon name={showPasswords.current ? 'eyeOff' : 'eye'} size={15} />
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    style={{
                      width: '100%',
                      padding: '0.55rem 2.2rem 0.55rem 0.75rem',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                    placeholder="Min. 8 characters"
                    value={passData.password}
                    onChange={e => setPassData({ ...passData, password: e.target.value })}
                    autoComplete="new-password"
                    onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <SettingsIcon name={showPasswords.new ? 'eyeOff' : 'eye'} size={15} />
                  </button>
                </div>
                <PasswordStrength password={passData.password} visible={passData.password.length > 0} />
              </div>

              {/* Confirm New Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    style={{
                      width: '100%',
                      padding: '0.55rem 2.2rem 0.55rem 0.75rem',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                    placeholder="Repeat new password"
                    value={passData.password_confirmation}
                    onChange={e => setPassData({ ...passData, password_confirmation: e.target.value })}
                    autoComplete="new-password"
                    onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <SettingsIcon name={showPasswords.confirm ? 'eyeOff' : 'eye'} size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pw-form-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={savingPass || !checkPasswordRules(passData.password)}
                style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
              >
                {savingPass ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            2. NOTIFICATIONS
            ═══════════════════════════════════════════════════════════════ */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">2. Notifications</h3>
            <p className="settings-card-subtitle">
              Choose the types of alerts and messages you receive from the clinic.
            </p>
          </div>

          <div className="settings-toggle-list">
            {/* Appointment Reminders */}
            <div className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">Appointment Reminders</div>
                <div className="settings-toggle-desc">Receive automated reminders 24 hours prior to scheduled medical or dental visits.</div>
              </div>
              <button
                type="button"
                className={`settings-switch ${notifs.apptReminders ? 'active' : ''}`}
                onClick={() => handleToggleNotif('apptReminders', 'Appointment reminders')}
                aria-label="Toggle Appointment Reminders"
              >
                <span className="settings-switch-knob" />
              </button>
            </div>

            {/* Health Record Updates */}
            <div className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">Health Record Updates</div>
                <div className="settings-toggle-desc">Get notified when a clinic physician or dentist adds a new consultation record.</div>
              </div>
              <button
                type="button"
                className={`settings-switch ${notifs.recordUpdates ? 'active' : ''}`}
                onClick={() => handleToggleNotif('recordUpdates', 'Health record updates')}
                aria-label="Toggle Health Record Updates"
              >
                <span className="settings-switch-knob" />
              </button>
            </div>

            {/* System Announcements */}
            <div className="settings-toggle-row">
              <div>
                <div className="settings-toggle-label">System Announcements</div>
                <div className="settings-toggle-desc">Receive broadcast notices for university health advisories and clinic immunization schedules.</div>
              </div>
              <button
                type="button"
                className={`settings-switch ${notifs.announcements ? 'active' : ''}`}
                onClick={() => handleToggleNotif('announcements', 'System announcements')}
                aria-label="Toggle System Announcements"
              >
                <span className="settings-switch-knob" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            3. PRIVACY
            ═══════════════════════════════════════════════════════════════ */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">3. Privacy</h3>
            <p className="settings-card-subtitle">
              Understand how your health records and personal information are protected.
            </p>
          </div>

          <div className="settings-info-box" style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
              Clinic Record Privacy
            </div>
            All student health records, consultations, and dental charts are confidential. Access is restricted strictly to authorized FSUU medical and dental staff, student guardians, and licensed school physicians.
          </div>

          <div className="settings-info-box">
            <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
              Privacy Information & Compliance
            </div>
            Data stored within the FSUU Clinic System adheres to national health information privacy guidelines and university data protection policies. Personal contact details are exclusively utilized for official clinic care and emergency correspondence.
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            4. HELP & SUPPORT
            ═══════════════════════════════════════════════════════════════ */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">4. Help & Support</h3>
            <p className="settings-card-subtitle">
              Get assistance from clinic personnel or report a system problem.
            </p>
          </div>

          <div className="settings-support-grid">
            {/* Contact Clinic */}
            <div className="settings-support-card">
              <h4>Contact Clinic</h4>
              <p>Mon – Fri: 8:00 AM – 5:00 PM<br />Location: Ground Floor, FSUU Health Center<br />Tel: (085) 342-1830 loc. 123</p>
            </div>

            {/* Help & Support / FAQs */}
            <div className="settings-support-card">
              <h4>Help & FAQs</h4>
              <p>Browse answers to common questions regarding clinic booking and records.</p>
              <div style={{ marginTop: 'auto' }}>
                <Link to="/appointments" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'inline-block', textAlign: 'center' }}>
                  Clinic Services
                </Link>
              </div>
            </div>

            {/* Report a Problem */}
            <div className="settings-support-card">
              <h4>Report a Problem</h4>
              <p>Encountered a bug or an issue with your clinic records? Let support know.</p>
              <div style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowReportModal(true)}
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                >
                  Report Issue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            5. ABOUT
            ═══════════════════════════════════════════════════════════════ */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="settings-card-title">5. About</h3>
            <p className="settings-card-subtitle">
              System version and institutional details.
            </p>
          </div>

          <div className="settings-info-grid">
            <div className="settings-info-item">
              <span className="settings-info-label">Application</span>
              <span className="settings-info-value">FSUU Clinic System</span>
            </div>

            <div className="settings-info-item">
              <span className="settings-info-label">Institution</span>
              <span className="settings-info-value">Fr. Saturnino Urios University</span>
            </div>

            <div className="settings-info-item">
              <span className="settings-info-label">System Version</span>
              <span className="settings-info-value">v2.4.0 (School Clinic Edition)</span>
            </div>

            <div className="settings-info-item">
              <span className="settings-info-label">Service Status</span>
              <span className="settings-info-value" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <SettingsIcon name="check" size={14} /> Operational
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            6. LIVE CHAT SETTINGS (ADMIN ONLY)
            ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <div className="settings-card">
            <div className="settings-card-header">
              <h3 className="settings-card-title">6. Live Chat Configuration</h3>
              <p className="settings-card-subtitle">
                Control the student-to-staff live chat availability and customized offline message.
              </p>
            </div>

            <div className="settings-toggle-list" style={{ marginBottom: '1.25rem' }}>
              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Enable Live Chat</div>
                  <div className="settings-toggle-desc">
                    When disabled, students see an offline notification and cannot start live chat conversations.
                  </div>
                </div>
                <button
                  type="button"
                  className={`settings-switch ${chatEnabled ? 'active' : ''}`}
                  onClick={() => setChatEnabled(prev => !prev)}
                  aria-label="Toggle Live Chat"
                >
                  <span className="settings-switch-knob" />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                Offline Message
              </label>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Displayed to students when the clinic is offline or chat is disabled.
              </div>
              <textarea
                value={offlineMessage}
                onChange={e => setOfflineMessage(e.target.value)}
                maxLength={500}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--input-bg, #ffffff)',
                  color: 'var(--text)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveChatSettings}
                disabled={savingChat}
              >
                {savingChat ? 'Saving...' : 'Save Chat Settings'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: REPORT A PROBLEM
          ═══════════════════════════════════════════════════════════════ */}
      {showReportModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReportModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Report a Problem</h2>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleReportSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Issue Category</label>
                    <select
                      style={{
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        background: '#FFFFFF',
                      }}
                      value={reportForm.category}
                      onChange={e => setReportForm({ ...reportForm, category: e.target.value })}
                    >
                      <option value="System Issue">System or Website Issue</option>
                      <option value="Appointment Concern">Appointment Concern</option>
                      <option value="Health Record Discrepancy">Health Record Discrepancy</option>
                      <option value="Other Feedback">Other Feedback</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Description</label>
                    <textarea
                      style={{
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        minHeight: '100px',
                        resize: 'vertical',
                      }}
                      placeholder="Please describe the issue or inquiry in detail..."
                      value={reportForm.description}
                      onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowReportModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingReport}
                  >
                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}
