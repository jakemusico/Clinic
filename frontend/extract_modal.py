import re

with open('d:/clinic/frontend/src/pages/clinic/ConsultationsPage.jsx', 'r') as f:
    content = f.read()

# Extract from imports up to export default function ConsultationsPage
start_idx = 0
end_idx = content.find('export default function ConsultationsPage')

if end_idx != -1:
    modal_code = content[start_idx:end_idx]
    
    # We need to export ConsultationModal
    modal_code = modal_code.replace('function ConsultationModal', 'export function ConsultationModal')
    
    with open('d:/clinic/frontend/src/components/ConsultationModal.jsx', 'w') as f:
        f.write(modal_code)
    print("Extracted ConsultationModal.jsx")
else:
    print("Could not find ConsultationsPage")
