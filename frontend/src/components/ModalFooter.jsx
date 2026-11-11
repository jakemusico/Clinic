import PrintableRecord from './PrintableRecord'

/**
 * ModalFooter
 *
 * Reusable footer bar for consultation modals.
 * Displays Print Record and Close buttons, right-aligned.
 *
 * Props:
 *   record       – the consultation/dental record object
 *   patientUser  – the patient's user object (name, email, etc.)
 *   isDental     – whether this is a dental record (passed to PrintableRecord)
 *   onClose      – callback to close the modal
 */
export function ModalFooter({ record, patientUser, isDental = false, onClose }) {
  return (
    <div
      className="modal-footer"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        marginTop: '1.25rem',
      }}
    >
      <PrintableRecord
        record={record}
        isDental={isDental}
        patientUser={patientUser}
        buttonLabel="Print Record"
      />
      <button className="btn-primary" onClick={onClose}>
        Close
      </button>
    </div>
  )
}
