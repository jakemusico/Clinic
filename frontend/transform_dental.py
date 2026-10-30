import re

with open('d:/clinic/frontend/src/components/DentalConsultationModal.jsx', 'r') as f:
    content = f.read()

# Replace the component declaration
content = content.replace('export default function DentalConsultationsPage() {', 'export function DentalConsultationModal({ initialData, onClose, onSaved }) {\n  const isEdit = Boolean(initialData?.id);')
content = content.replace('const prefilledAppt = location.state?.appointment', 'const prefilledAppt = initialData?.appointment || initialData;')

# We need to remove the layout, tabs, lists, and just keep the modal wrapper around the form
# The form starts at `        {activeTab === 'new' && (`

start_idx = content.find("{activeTab === 'new' && (")
if start_idx != -1:
    end_idx = content.find("        )}", start_idx)
    form_content = content[start_idx + len("{activeTab === 'new' && ("):end_idx].strip()
    
    # Wrap in modal
    modal_code = f"""
  return (
    <div className="modal-backdrop">
      <div className="modal-content modal-lg">
        <div className="modal-header">
          <h2>{{isEdit ? 'Edit Dental Consultation' : 'New Dental Consultation'}}</h2>
          <button className="btn-close" onClick={{onClose}}>×</button>
        </div>
        <div className="modal-body" style={{padding: 0}}>
          {form_content}
        </div>
      </div>
    </div>
  )
}}
"""
    # Replace everything from `  return (` to the end of the file with our modal_code
    return_idx = content.find("  return (\n    <DashboardLayout")
    if return_idx != -1:
        content = content[:return_idx] + modal_code

with open('d:/clinic/frontend/src/components/DentalConsultationModal.jsx', 'w') as f:
    f.write(content)
