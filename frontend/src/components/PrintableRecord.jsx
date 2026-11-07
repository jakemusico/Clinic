/**
 * PrintableRecord.jsx
 *
 * Reusable component for printing clinic records.
 * Opens a new browser window with a formatted, printable document.
 *
 * Supported service types:
 *   Medical Consultation    → Consultation Record
 *   Physical Examination    → Physical Examination Record
 *   Issuance of Medical Certificate → Medical Certificate
 *   First Aid Treatment     → Treatment Record
 *   Blood Pressure Monitoring → Vital Signs Record
 *   Dental (any)            → Dental Treatment Record
 */

import { useRef } from 'react'
import { toast } from 'react-hot-toast'
import { EMPTY, NO_SERVICE, serviceNameOf } from '../utils/emptyValue'
import { formatDateLong } from '../utils/dateUtils'
import { escapeHtml } from '../utils/escapeHtml'

/* ── Helpers ────────────────────────────────────────────────── */
const fmtDate = (value) => formatDateLong(value, { weekday: 'long', month: 'long' })

const calcBMI = (weight, height) => {
  const w = parseFloat(weight)
  const h = parseFloat(height) / 100
  if (!w || !h || h === 0) return null
  return (w / (h * h)).toFixed(1)
}

const bmiCategory = (bmi) => {
  const v = parseFloat(bmi)
  if (!v) return ''
  if (v < 18.5) return 'Underweight'
  if (v < 25)   return 'Normal weight'
  if (v < 30)   return 'Overweight'
  return 'Obese'
}

/* ── Print CSS injected into popup window ────────────────────── */
const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;font-size:11pt;color:#0F172A;background:#fff}
.doc-page{width:100%;max-width:210mm;margin:0 auto;padding:18mm 18mm 16mm 18mm;background:#fff}
.doc-header{text-align:center;border-bottom:2.5px solid #2563EB;padding-bottom:10px;margin-bottom:16px}
.doc-header .school{font-size:13pt;font-weight:700;color:#1E40AF;letter-spacing:.3px}
.doc-header .clinic{font-size:10pt;color:#374151;margin-top:1px}
.doc-header .doc-title{font-size:15pt;font-weight:700;color:#2563EB;margin-top:10px;text-transform:uppercase;letter-spacing:.5px}
.doc-header .doc-num{font-size:8.5pt;color:#64748B;margin-top:3px}
.doc-section{margin-bottom:14px}
.sec-title{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#2563EB;border-bottom:1px solid #BFDBFE;padding-bottom:3px;margin-bottom:8px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:5px 16px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px 12px}
.field{display:flex;flex-direction:column;gap:1px}
.flabel{font-size:7.5pt;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.4px}
.fval{font-size:10pt;font-weight:500;color:#0F172A;border-bottom:1px solid #E2E8F0;padding-bottom:2px;min-height:18px}
.fval.accent{color:#2563EB;font-weight:600}
.fval.highlight{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:3px;padding:3px 6px;font-weight:600;color:#1E40AF}
.vbox{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:10px 14px}
.tblock{margin-bottom:10px}
.tlabel{font-size:8pt;font-weight:700;color:#374151;margin-bottom:3px}
.tval{font-size:10pt;color:#0F172A;border:1px solid #E2E8F0;border-radius:4px;padding:6px 8px;background:#F8FAFC;min-height:30px;white-space:pre-wrap;word-break:break-word}
.tval.empty{color:#94A3B8;font-style:italic}
.cert-box{background:#EFF6FF;border:1.5px solid #2563EB;border-radius:6px;padding:14px 16px;margin:12px 0;font-size:10.5pt;line-height:1.7;color:#1E40AF;text-align:center;font-weight:500}
.sig-row{display:flex;gap:40px;margin-top:28px}
.sig-block{flex:1;text-align:center}
.sig-line{border-top:1.5px solid #1E293B;margin-bottom:4px;margin-top:40px}
.sig-name{font-size:9.5pt;font-weight:700;color:#0F172A}
.sig-title{font-size:8pt;color:#64748B}
.teeth-list{font-size:9pt;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:4px;padding:5px 8px;display:flex;flex-wrap:wrap;gap:4px}
.tooth-tag{background:#2563EB;color:#fff;border-radius:3px;padding:1px 6px;font-size:8pt;font-weight:600}
.doc-footer{border-top:1px solid #E2E8F0;margin-top:20px;padding-top:8px;display:flex;justify-content:space-between;font-size:7.5pt;color:#94A3B8}
@page{size:A4;margin:15mm}
`

/* ── Document builders (return HTML strings) ─────────────── */

function patientRows(pu) {
  return `
    <div class="grid2">
      <div class="field"><div class="flabel">Full Name</div><div class="fval accent">${escapeHtml(pu.name || EMPTY)}</div></div>
      <div class="field"><div class="flabel">Student / Employee ID</div><div class="fval">${escapeHtml(pu.student_id || EMPTY)}</div></div>
      <div class="field"><div class="flabel">Email</div><div class="fval">${escapeHtml(pu.email || EMPTY)}</div></div>
      <div class="field"><div class="flabel">Department / Course</div><div class="fval">${escapeHtml(pu.department || EMPTY)}</div></div>
    </div>`
}

function vitalsRows(v, showBMI = true) {
  const bmiVal = v.bmi || calcBMI(v.weight, v.height)
  const cat = bmiVal ? bmiCategory(bmiVal) : ''
  const bmiDisplay = bmiVal ? `${bmiVal} kg/m² ${cat ? `(${cat})` : ''}` : EMPTY

  return `
    <div class="vbox">
      <div class="grid3">
        <div class="field"><div class="flabel">Blood Pressure</div><div class="fval">${escapeHtml(v.blood_pressure || v.bp || EMPTY)}</div></div>
        <div class="field"><div class="flabel">Temperature</div><div class="fval">${escapeHtml(v.temperature ? v.temperature + ' °C' : EMPTY)}</div></div>
        <div class="field"><div class="flabel">Pulse Rate</div><div class="fval">${escapeHtml(v.pulse_rate ? v.pulse_rate + ' bpm' : EMPTY)}</div></div>
        <div class="field"><div class="flabel">Weight</div><div class="fval">${escapeHtml(v.weight ? v.weight + ' kg' : EMPTY)}</div></div>
        <div class="field"><div class="flabel">Height</div><div class="fval">${escapeHtml(v.height ? v.height + ' cm' : EMPTY)}</div></div>
        <div class="field"><div class="flabel">BMI</div><div class="fval accent">${escapeHtml(bmiDisplay)}</div></div>
      </div>
      ${v.respiratory_rate ? `<div class="field" style="margin-top:6px"><div class="flabel">Respiratory Rate</div><div class="fval">${escapeHtml(v.respiratory_rate)} breaths/min</div></div>` : ''}
    </div>`
}

function textBlock(label, value) {
  const empty = !value || String(value).trim() === ''
  return `<div class="tblock">
    <div class="tlabel">${escapeHtml(label)}</div>
    <div class="tval${empty ? ' empty' : ''}">${escapeHtml(empty ? EMPTY : value)}</div>
  </div>`
}

function sigRow(staffName, staffTitle, showStudent, studentName) {
  return `<div class="sig-row">
    ${showStudent ? `<div class="sig-block"><div class="sig-line"></div><div class="sig-name">${escapeHtml(studentName || 'Patient')}</div><div class="sig-title">Patient Signature</div></div>` : ''}
    <div class="sig-block"><div class="sig-line"></div><div class="sig-name">${escapeHtml(staffName || 'Clinic Staff')}</div><div class="sig-title">${escapeHtml(staffTitle || 'Clinic Nurse / Medical Staff')}</div></div>
  </div>`
}

function buildConsultation(record, vitals, pu) {
  return `
    <div class="doc-section"><div class="sec-title">Patient Information</div>${patientRows(pu)}</div>
    <div class="doc-section"><div class="sec-title">Consultation Overview</div>
      <div class="grid2">
        <div class="field"><div class="flabel">Date</div><div class="fval">${escapeHtml(fmtDate(record.visit_date))}</div></div>
        <div class="field"><div class="flabel">Clinic Service</div><div class="fval">${escapeHtml(serviceNameOf(record) || NO_SERVICE)}</div></div>
        <div class="field"><div class="flabel">Attending Staff</div><div class="fval">${escapeHtml(record.created_by?.name || 'Clinic Staff')}</div></div>
        <div class="field"><div class="flabel">Status</div><div class="fval">Completed</div></div>
      </div>
    </div>
    <div class="doc-section"><div class="sec-title">Vital Signs</div>${vitalsRows(vitals, true)}</div>
    <div class="doc-section"><div class="sec-title">Clinical Findings</div>
      ${textBlock('Reason for Visit / Chief Complaint', record.chief_complaint)}
      ${textBlock('Complaint Category', record.complaint_category)}
      ${textBlock('Symptoms', record.symptoms)}
      ${textBlock('Assessment / Clinical Findings', record.assessment)}
      ${textBlock('Diagnosis', record.diagnosis)}
      ${textBlock('Treatment & Recommendations', record.treatment || record.recommendation)}
      ${textBlock('Prescription / Medicines', record.prescription)}
      ${textBlock('Additional Notes', record.notes || record.remarks)}
    </div>
    ${sigRow(record.created_by?.name, 'Clinic Nurse / Medical Staff', false, pu.name)}`
}

function buildPhysical(record, vitals, pu) {
  return `
    <div class="doc-section"><div class="sec-title">Patient Information</div>${patientRows(pu)}</div>
    <div class="doc-section"><div class="sec-title">Examination Details</div>
      <div class="grid2">
        <div class="field"><div class="flabel">Date of Examination</div><div class="fval">${escapeHtml(fmtDate(record.visit_date))}</div></div>
        <div class="field"><div class="flabel">Attending Staff</div><div class="fval">${escapeHtml(record.created_by?.name || 'Clinic Staff')}</div></div>
      </div>
    </div>
    <div class="doc-section"><div class="sec-title">Vital Signs & Anthropometric Data</div>${vitalsRows(vitals, true)}</div>
    <div class="doc-section"><div class="sec-title">Examination Results</div>
      ${record.chief_complaint ? textBlock('Reason for Examination', record.chief_complaint) : ''}
      ${textBlock('Physical Findings / Assessment', record.assessment || record.diagnosis)}
      ${textBlock('Recommendations', record.treatment || record.recommendation)}
      ${(record.notes || record.remarks) ? textBlock('Additional Notes / Remarks', record.notes || record.remarks) : ''}
    </div>
    ${sigRow(record.created_by?.name, 'Clinic Nurse / Medical Staff', true, pu.name)}`
}

function buildCertificate(record, vitals, pu) {
  const purpose = record.purpose || record.chief_complaint || 'school, athletic, scholarship, and other legitimate purposes'
  const fitness = record.fitness_result || record.recommendation || record.treatment || 'Fit'
  return `
    <div class="doc-section"><div class="sec-title">Patient Information</div>${patientRows(pu)}</div>
    <div class="doc-section"><div class="sec-title">Assessment Details</div>
      <div class="grid2">
        <div class="field"><div class="flabel">Date of Examination</div><div class="fval">${escapeHtml(fmtDate(record.visit_date))}</div></div>
        <div class="field"><div class="flabel">Purpose</div><div class="fval">${escapeHtml(purpose)}</div></div>
      </div>
    </div>
    <div class="doc-section"><div class="sec-title">Physical Assessment — Vital Signs & Anthropometric Data</div>${vitalsRows(vitals, true)}</div>
    <div class="cert-box">
      This is to certify that <strong>${escapeHtml(pu.name || '______________________')}</strong>,
      Student / Employee ID No. <strong>${escapeHtml(pu.student_id || '______________________')}</strong>,
      of <strong>${escapeHtml(pu.department || '______________________')}</strong>,
      has been examined on <strong>${escapeHtml(fmtDate(record.visit_date))}</strong>.
      Based on the medical assessment, the patient is found to be
      <strong>${escapeHtml(fitness)}</strong> for the stated purpose.
    </div>
    <div class="doc-section"><div class="sec-title">Medical Findings & Remarks</div>
      ${textBlock('Medical Findings / Clinical Findings', record.assessment || record.diagnosis)}
      ${(record.notes || record.remarks) ? textBlock('Additional Remarks', record.notes || record.remarks) : ''}
    </div>
    <div class="doc-section"><div class="sec-title">Fitness / Assessment Result</div>
      <div class="flabel">Result</div><div class="fval highlight">${escapeHtml(fitness)}</div>
    </div>
    ${sigRow(record.created_by?.name, 'Attending Nurse / Medical Officer', true, pu.name)}`
}

function buildTreatment(record, vitals, pu) {
  const hasVitals = vitals.blood_pressure || vitals.bp || vitals.temperature || vitals.pulse_rate || vitals.weight || vitals.height
  return `
    <div class="doc-section"><div class="sec-title">Patient Information</div>${patientRows(pu)}</div>
    <div class="doc-section"><div class="sec-title">Incident & Treatment Details</div>
      <div class="grid2">
        <div class="field"><div class="flabel">Date of Treatment</div><div class="fval">${escapeHtml(fmtDate(record.visit_date))}</div></div>
        <div class="field"><div class="flabel">Attending Staff</div><div class="fval">${escapeHtml(record.created_by?.name || 'Clinic Staff')}</div></div>
      </div>
    </div>
    ${hasVitals ? `<div class="doc-section"><div class="sec-title">Vital Signs at Time of Treatment</div>${vitalsRows(vitals, true)}</div>` : ''}
    <div class="doc-section"><div class="sec-title">First Aid / Treatment Record</div>
      ${textBlock('Nature of Incident / Complaint', record.chief_complaint)}
      ${record.symptoms ? textBlock('Symptoms / Presenting Condition', record.symptoms) : ''}
      ${textBlock('Assessment', record.assessment || record.diagnosis)}
      ${textBlock('First Aid / Treatment Given', record.treatment || record.recommendation)}
      ${record.prescription ? textBlock('Medications Administered', record.prescription) : ''}
      ${(record.notes || record.remarks) ? textBlock('Additional Notes / Follow-up Instructions', record.notes || record.remarks) : ''}
    </div>
    ${sigRow(record.created_by?.name, 'Clinic Nurse / Medical Staff', true, pu.name)}`
}

function buildVitals(record, vitals, pu) {
  return `
    <div class="doc-section"><div class="sec-title">Patient Information</div>${patientRows(pu)}</div>
    <div class="doc-section"><div class="sec-title">Monitoring Details</div>
      <div class="grid2">
        <div class="field"><div class="flabel">Date of Monitoring</div><div class="fval">${escapeHtml(fmtDate(record.visit_date))}</div></div>
        <div class="field"><div class="flabel">Attending Staff</div><div class="fval">${escapeHtml(record.created_by?.name || 'Clinic Staff')}</div></div>
      </div>
    </div>
    <div class="doc-section"><div class="sec-title">Blood Pressure & Vital Signs Monitoring</div>${vitalsRows(vitals, true)}</div>
    <div class="doc-section"><div class="sec-title">Clinical Notes</div>
      ${record.chief_complaint ? textBlock('Reason for Monitoring', record.chief_complaint) : ''}
      ${textBlock('Assessment / Findings', record.assessment || record.diagnosis)}
      ${(record.treatment || record.recommendation) ? textBlock('Advice / Recommendations', record.treatment || record.recommendation) : ''}
      ${(record.notes || record.remarks) ? textBlock('Additional Notes', record.notes || record.remarks) : ''}
    </div>
    ${sigRow(record.created_by?.name, 'Clinic Nurse / Medical Staff', false, pu.name)}`
}

function buildDental(record, pu) {
  const teethTags = (record.affected_teeth || []).map(t => `<span class="tooth-tag">#${escapeHtml(t)}</span>`).join('')
  return `
    <div class="doc-section"><div class="sec-title">Patient Information</div>${patientRows(pu)}</div>
    <div class="doc-section"><div class="sec-title">Consultation Overview</div>
      <div class="grid2">
        <div class="field"><div class="flabel">Date of Consultation</div><div class="fval">${escapeHtml(fmtDate(record.consultation_date))}</div></div>
        <div class="field"><div class="flabel">Service</div><div class="fval">${escapeHtml(serviceNameOf(record) || NO_SERVICE)}</div></div>
        <div class="field"><div class="flabel">Attending Dentist</div><div class="fval">${escapeHtml(record.dentist?.name || 'Dentist')}</div></div>
        <div class="field"><div class="flabel">Status</div><div class="fval">Completed</div></div>
      </div>
    </div>
    <div class="doc-section"><div class="sec-title">Vital Signs</div>${vitalsRows(record.vitals || {}, true)}</div>
    <div class="doc-section"><div class="sec-title">Affected Teeth (FDI Notation)</div>
      <div class="teeth-list">${teethTags || EMPTY}</div>
    </div>
    <div class="doc-section"><div class="sec-title">Dental Examination Findings</div>
      ${textBlock('Reason for Visit / Chief Complaint', record.reason_for_visit)}
      ${textBlock('Complaint Category', record.complaint_category)}
      ${textBlock('Dental Findings', record.dental_findings)}
      ${textBlock('Diagnosis', record.diagnosis)}
      ${textBlock('Treatment Performed', record.treatment_performed)}
      ${textBlock('Recommendations / Instructions', record.recommendations)}
      ${textBlock('Patient Notes', record.notes)}
    </div>
    ${sigRow(record.dentist?.name, 'Attending Dentist', true, pu.name)}`
}

/* ── Doc type resolver ──────────────────────────────────────── */
function getDocType(serviceName) {
  if (!serviceName) return 'consultation'
  const s = serviceName.toLowerCase()
  if (s.includes('medical certificate') || s.includes('certificate')) return 'certificate'
  if (s.includes('physical examination') || s.includes('physical exam')) return 'physical'
  if (s.includes('first aid') || s.includes('treatment')) return 'treatment'
  if (s.includes('blood pressure') || s.includes('vital')) return 'vitals'
  return 'consultation'
}

function getDocTitle(docType) {
  switch (docType) {
    case 'certificate': return 'Medical Certificate'
    case 'physical':    return 'Physical Examination Record'
    case 'treatment':   return 'First Aid Treatment Record'
    case 'vitals':      return 'Vital Signs Monitoring Record'
    default:            return 'Medical Consultation Record'
  }
}

/* ── Main component ─────────────────────────────────────────── */
/**
 * @param {object}  record       - The consultation or dental record
 * @param {boolean} isDental     - Set true for dental records
 * @param {object}  patientUser  - { name, student_id, email, department }
 * @param {string}  [buttonLabel]  - Override the default button label
 * @param {string}  [buttonClass]  - CSS class for the button
 */
export default function PrintableRecord({
  record,
  isDental = false,
  patientUser,
  buttonLabel,
  buttonClass = 'btn-secondary',
}) {
  if (!record) return null

  const vitals = record.vitals || {}
  const pu = patientUser || record?.patient?.user || {}

  const serviceName = serviceNameOf(record)

  const docType  = isDental ? 'dental' : getDocType(serviceName)
  const docTitle = isDental ? 'Dental Treatment Record' : getDocTitle(docType)

  const handlePrint = () => {
    let bodyHtml = ''
    if (isDental) {
      bodyHtml = buildDental(record, pu)
    } else if (docType === 'certificate') {
      bodyHtml = buildCertificate(record, vitals, pu)
    } else if (docType === 'physical') {
      bodyHtml = buildPhysical(record, vitals, pu)
    } else if (docType === 'treatment') {
      bodyHtml = buildTreatment(record, vitals, pu)
    } else if (docType === 'vitals') {
      bodyHtml = buildVitals(record, vitals, pu)
    } else {
      bodyHtml = buildConsultation(record, vitals, pu)
    }

    const footer = `
      <div class="doc-footer">
        <span>FSUU University Clinic — Official Record</span>
        <span>Record #${escapeHtml(record?.id || EMPTY)} &nbsp;|&nbsp; Printed: ${escapeHtml(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }))}</span>
      </div>`

    const header = `
      <div class="doc-header">
        <div class="school">Father Saturnino Urios University</div>
        <div class="clinic">University Clinic &amp; Health Services</div>
        <div class="doc-title">${escapeHtml(docTitle)}</div>
        <div class="doc-num">Record No. ${escapeHtml(record?.id || 'N/A')} &nbsp;|&nbsp; Generated: ${escapeHtml(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }))}</div>
      </div>`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(docTitle)} — FSUU Clinic</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="doc-page">
    ${header}
    ${bodyHtml}
    ${footer}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 600);
    };
  <\/script>
</body>
</html>`

    const pw = window.open('', '_blank', 'width=960,height=720')
    if (!pw) {
      toast.error('Pop-up blocked! Please allow pop-ups for this site to enable printing.')
      return
    }
    pw.opener = null // the print window gets no reference back to this page
    pw.document.write(html)
    pw.document.close()
  }

  const cleanLabel = (buttonLabel ? buttonLabel.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() : '') || `Print ${docTitle}`

  return (
    <button
      type="button"
      className={buttonClass}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      onClick={handlePrint}
      title={`Print ${docTitle}`}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      <span>{cleanLabel}</span>
    </button>
  )
}
