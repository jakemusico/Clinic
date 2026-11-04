<?php

namespace Database\Seeders;

use App\Models\ChatbotFaq;
use Illuminate\Database\Seeder;

class ChatbotFaqSeeder extends Seeder
{
    public function run(): void
    {
        ChatbotFaq::truncate();

        $faqs = [
            /* ── APPOINTMENTS ──────────────────────────────────────────── */
            [
                'category'   => 'appointments',
                'sort_order' => 1,
                'keywords'   => 'book, schedule, appointment, reserve, set, make appointment',
                'question'   => 'How do I book an appointment?',
                'answer'     => "To book an appointment:\n1. Log in to your dashboard\n2. Click 'Appointments' in the sidebar\n3. Click 'Book Appointment'\n4. Select a service, staff member, and available time slot\n5. Click 'Confirm Booking'\n\nYou will receive a notification once confirmed by clinic staff.",
            ],
            [
                'category'   => 'appointments',
                'sort_order' => 2,
                'keywords'   => 'reschedule, move, change, transfer, another time',
                'question'   => 'Can I reschedule my appointment?',
                'answer'     => "Yes! You can reschedule a pending appointment:\n1. Go to 'My Appointments'\n2. Find the appointment you want to reschedule\n3. Click the 'Reschedule' button\n4. Pick a new date and time slot\n\nNote: You cannot reschedule confirmed or completed appointments. Contact clinic staff for assistance.",
            ],
            [
                'category'   => 'appointments',
                'sort_order' => 3,
                'keywords'   => 'cancel, cancellation, delete appointment',
                'question'   => 'How do I cancel an appointment?',
                'answer'     => "To cancel an appointment:\n1. Go to 'My Appointments'\n2. Click 'Cancel' on the appointment\n3. Confirm the cancellation\n\nPlease cancel at least 24 hours before your scheduled time as a courtesy to clinic staff.",
            ],
            [
                'category'   => 'appointments',
                'sort_order' => 4,
                'keywords'   => 'pending, confirmed, status, appointment status',
                'question'   => 'What do the appointment statuses mean?',
                'answer'     => "Appointment statuses:\n• **Pending** — Your booking is waiting for clinic staff confirmation\n• **Confirmed** — Your appointment is approved and confirmed\n• **Completed** — The appointment has been attended and finished\n• **Cancelled** — The appointment was cancelled (by you or clinic staff)",
            ],
            [
                'category'   => 'appointments',
                'sort_order' => 5,
                'keywords'   => 'walk-in, walkin, drop in, no appointment, without appointment',
                'question'   => 'Can I walk in without an appointment?',
                'answer'     => "Walk-in patients are accepted based on clinic availability, but we strongly recommend booking an appointment first to guarantee your slot.\n\nFor medical emergencies, proceed directly to the clinic regardless of appointments.",
            ],
            [
                'category'   => 'appointments',
                'sort_order' => 6,
                'keywords'   => 'missed, no show, no-show, absent, did not attend',
                'question'   => 'What happens if I miss my appointment?',
                'answer'     => "If you miss your appointment without prior cancellation, it will be marked as 'cancelled'. Repeated no-shows may affect future booking priority.\n\nIf you experienced an emergency, please contact clinic staff to explain the situation.",
            ],

            /* ── SERVICES ──────────────────────────────────────────────── */
            [
                'category'   => 'services',
                'sort_order' => 1,
                'keywords'   => 'services, offered, available, consultation, medical, dental',
                'question'   => 'What services does the clinic offer?',
                'answer'     => "The University Clinic offers:\n• Medical Consultation (30m)\n• Blood Pressure Monitoring (15m)\n• First Aid Treatment (20m)\n• Physical Examination (60m)\n• Issuance of Medical Certificate (30m)\n• Dental Consultation (45m)\n• Dental Cleaning (30m)\n• Tooth Extraction (30m)\n• Tooth Filling (30m)",
            ],
            [
                'category'   => 'services',
                'sort_order' => 2,
                'keywords'   => 'medical certificate, medcert, certificate, clearance, athlete, scholarship, activity',
                'question'   => 'How do I request an Issuance of Medical Certificate?',
                'answer'     => "To request a Medical Certificate for school, athletic, scholarship, or other valid purposes:\n1. Go to 'Book Appointment' and select the 'Medical' service type\n2. Choose 'Issuance of Medical Certificate'\n3. Pick an available date and time slot\n4. Indicate your purpose (e.g. athlete clearance, scholarship, school activity) in the reason field\n5. Attend your appointment for medical assessment",
            ],
            [
                'category'   => 'services',
                'sort_order' => 3,
                'keywords'   => 'physical exam, PE, medical exam, examination, clearance exam',
                'question'   => 'How do I request a physical/medical examination?',
                'answer'     => "Physical/Medical Examinations (PE) are available for:\n• New students (enrollment requirement)\n• Student organization medical clearance\n• Employment requirements\n\nBook an appointment for 'Physical Examination' and bring your school ID plus any required forms.",
            ],
            [
                'category'   => 'services',
                'sort_order' => 5,
                'keywords'   => 'free, cost, fee, charge, payment',
                'question'   => 'Are clinic services free for students and faculty?',
                'answer'     => "Basic consultation services are free for enrolled students and regular faculty/staff.\n\nSome services may have minimal fees (e.g., laboratory, specialty referrals). Please inquire at the clinic for the updated schedule of fees.",
            ],

            /* ── CLINIC HOURS ──────────────────────────────────────────── */
            [
                'category'   => 'hours',
                'sort_order' => 1,
                'keywords'   => 'hours, time, open, schedule, when, operating',
                'question'   => 'What are the clinic hours?',
                'answer'     => "The University Clinic is open:\n\n**Monday – Friday**\n   Morning: 8:00 AM – 12:00 PM\n   Afternoon: 1:00 PM – 5:00 PM\n\n**Saturday** (selected staff only)\n   8:00 AM – 12:00 PM\n\n**Sunday & Public Holidays** — Closed\n\nFor emergencies outside clinic hours, proceed to the nearest hospital.",
            ],
            [
                'category'   => 'hours',
                'sort_order' => 2,
                'keywords'   => 'holiday, closed, no service, suspension, break',
                'question'   => 'Is the clinic open during holidays?',
                'answer'     => "The clinic is generally **closed on public holidays**. In cases of class/work suspension due to typhoons or other emergencies, clinic services are also suspended.\n\nCheck the official university announcements for specific holiday closures.",
            ],
            [
                'category'   => 'hours',
                'sort_order' => 3,
                'keywords'   => 'location, where, address, find, room',
                'question'   => 'Where is the clinic located?',
                'answer'     => "The University Clinic is located at:\n\n**Ground Floor, Administration Building**\n   University Campus, Main Campus\n\nLook for the clinic signage near the main entrance. You may also ask the guard at the main gate for directions.",
            ],
            [
                'category'   => 'hours',
                'sort_order' => 4,
                'keywords'   => 'contact, hotline, phone, email, reach',
                'question'   => 'How do I contact the clinic?',
                'answer'     => "You can reach the University Clinic through:\n\n**Hotline:** (02) 8888-0000 local 101\n**Email:** clinic@university.edu\n**This chatbot** — for quick FAQ answers\n\nVisit during clinic hours for in-person inquiries.",
            ],

            /* ── RECORDS ──────────────────────────────────────────────── */
            [
                'category'   => 'records',
                'sort_order' => 1,
                'keywords'   => 'medical record, health record, my records, view record, see record',
                'question'   => 'How do I view my medical records?',
                'answer'     => "You can view your clinic records on this portal:\n1. Log in to your dashboard\n2. Click 'My Records' in the sidebar\n3. View your consultation history, diagnoses, and prescriptions\n\nNote: Records are only accessible to you and authorized clinic staff. Privacy is strictly maintained.",
            ],
            [
                'category'   => 'records',
                'sort_order' => 2,
                'keywords'   => 'confidential, privacy, share, who can see, access',
                'question'   => 'Who can see my medical records?',
                'answer'     => "Your medical records are strictly confidential and can only be accessed by:\n• **You** (the patient)\n• **Clinic Staff** who are directly managing your care\n• **Administrators** only with explicit medical access permission\n\nNo one else can view your records. We comply with the Data Privacy Act of 2012 (RA 10173).",
            ],
            [
                'category'   => 'records',
                'sort_order' => 3,
                'keywords'   => 'print, copy, download, get copy, request records',
                'question'   => 'Can I request a copy of my medical records?',
                'answer'     => "Yes, you may request a physical or digital copy of your medical records. Here's how:\n1. Visit the clinic during operating hours, OR\n2. Send an email to clinic@university.edu with your student/employee ID\n3. Provide your purpose/reason for the request\n\nProcessing may take 3–5 business days.",
            ],
            [
                'category'   => 'records',
                'sort_order' => 4,
                'keywords'   => 'update, change, edit, incorrect, wrong record',
                'question'   => 'What if my medical record has incorrect information?',
                'answer'     => "If you notice incorrect information in your records, please:\n1. Contact clinic staff directly at the clinic\n2. Bring a valid ID and supporting documents (e.g., prescription, previous record)\n3. Clinic staff will review and correct the information\n\nDo NOT attempt to alter records yourself — this is a protected system.",
            ],

            /* ── REQUIREMENTS ─────────────────────────────────────────── */
            [
                'category'   => 'requirements',
                'sort_order' => 1,
                'keywords'   => 'bring, requirements, documents, what to bring, needed',
                'question'   => 'What do I need to bring to my appointment?',
                'answer'     => "For your clinic appointment, please bring:\n\n• **Valid School/Employee ID**\n• **Completed appointment booking** (shown in the portal)\n• Any previous prescriptions or lab results (if follow-up)\n• HMO/PhilHealth card (if applicable)\n\nFor physical exams, you may also need a accomplished medical form from your college/department.",
            ],
            [
                'category'   => 'requirements',
                'sort_order' => 2,
                'keywords'   => 'prescription, medicine, refill, medication',
                'question'   => 'Can the clinic give me a prescription or refill?',
                'answer'     => "Yes, the clinic physician can issue prescriptions for common medications during consultation.\n\nFor prescription refills:\n• Book a follow-up consultation appointment\n• Bring your original prescription\n• The doctor will evaluate and issue a new prescription if appropriate\n\nNote: Controlled substances require additional documentation.",
            ],

            /* ── GENERAL ──────────────────────────────────────────────── */
            [
                'category'   => 'general',
                'sort_order' => 1,
                'keywords'   => 'student, faculty, who, eligible, can use, allowed',
                'question'   => 'Who can use the university clinic?',
                'answer'     => "The University Clinic is available to:\n\n• **Enrolled Students** — All undergraduate and graduate students\n• **Faculty & Staff** — All regular and part-time employees\n\nImmediately enrolled/newly hired individuals can register via the portal to access services.",
            ],
            [
                'category'   => 'general',
                'sort_order' => 2,
                'keywords'   => 'register, sign up, create account, new account',
                'question'   => 'How do I register for the clinic portal?',
                'answer'     => "To create a portal account:\n1. Go to the login page\n2. Click 'Create Account'\n3. Fill in your name, school/employee email, and choose your role (Student or Faculty/Staff)\n4. Set a secure password\n5. Click 'Register'\n\nYou can log in immediately after registration.",
            ],
            [
                'category'   => 'general',
                'sort_order' => 3,
                'keywords'   => 'forgot password, reset password, cant login, cannot login',
                'question'   => 'I forgot my password. What do I do?',
                'answer'     => "If you forgot your password:\n1. Go to the Login page\n2. Click 'Forgot Password'\n3. Enter your registered email\n4. Check your email for a reset link\n\nIf you still cannot log in, please contact clinic staff or your system administrator.",
            ],
            [
                'category'   => 'general',
                'sort_order' => 4,
                'keywords'   => 'chatbot, bot, assistant, help, what can you do',
                'question'   => 'What can this chatbot do?',
                'answer'     => "I'm the ClinicCare virtual assistant!\n\nI can help you with:\n• Booking and appointment FAQs\n• Available clinic services\n• Clinic hours and location\n• Medical record questions\n• Requirements and documents\n• General clinic information\n\nType 'menu' to browse all topics, or just type your question!",
            ],

            /* ── DENTAL ──────────────────────────────────────────────── */
            [
                'category'   => 'dental',
                'sort_order' => 1,
                'keywords'   => 'dental, dentist, teeth, tooth, cleaning, oral',
                'question'   => 'What dental services are available?',
                'answer'     => "The clinic provides the following dental services:\n\n• **Dental Consultation** — Initial exam and treatment planning\n• **Oral Prophylaxis (Cleaning)** — Scaling and polishing\n• **Tooth Extraction** — Simple extractions\n• **Dental Prescription** — Pain relief and antibiotics\n• **Oral Health Assessment** — Screening and referral\n\nComplex procedures (braces, root canal, etc.) will be referred to a dental specialist.",
            ],
            [
                'category'   => 'dental',
                'sort_order' => 2,
                'keywords'   => 'toothache, tooth pain, emergency dental',
                'question'   => 'I have a toothache. Can I come in without an appointment?',
                'answer'     => "For severe toothache (dental emergency), yes — you may walk in to the clinic during operating hours and you will be assessed on a priority basis.\n\nHowever, if only mild discomfort, please book an appointment through the portal to ensure the dentist is available.\n\nCall us first: (02) 8888-0000 ext. 101",
            ],

            /* ── EMERGENCY ──────────────────────────────────────────────── */
            [
                'category'   => 'emergency',
                'sort_order' => 1,
                'keywords'   => 'emergency, urgent, accident, collapse, faint, cardiac, seizure',
                'question'   => 'What should I do in a medical emergency on campus?',
                'answer'     => "**IN CASE OF A MEDICAL EMERGENCY:**\n\n1. **Call Campus Security immediately:** 0917-888-0000\n2. **Proceed to the University Clinic** if the patient can be safely moved\n3. **Call 911** or the nearest hospital for life-threatening emergencies\n\n**Nearest Hospital:** University Medical Center (5 mins from campus)\nAmbulance is available at the Campus Security Office\n\nDo NOT delay — act fast!",
            ],
            [
                'category'   => 'emergency',
                'sort_order' => 2,
                'keywords'   => 'first aid, cut, wound, bleeding, injury',
                'question'   => 'Where can I get first aid on campus?',
                'answer'     => "First aid is available at:\n\n• **University Clinic** — Ground Floor, Admin Building\n   Mon–Fri: 8AM–5PM\n\n• **Campus Security Office** — Available 24/7 with basic first aid kit\n\nFor serious injuries, clinic staff will assess, provide immediate care, and coordinate transport to a hospital if needed.",
            ],
        ];

        // Answers that depend on Clinic Info / Staff Schedules use {placeholders}
        // (see database/seeders/data/chatbot_faq_answers.php) instead of typed values.
        $templates = require database_path('seeders/data/chatbot_faq_answers.php');

        foreach ($faqs as $data) {
            if (isset($templates[$data['question']])) {
                $data['answer'] = $templates[$data['question']];
            }
            ChatbotFaq::create($data);
        }

        $this->command->info('ChatbotFaq: Seeded ' . count($faqs) . ' FAQs across ' .
            count(array_unique(array_column($faqs, 'category'))) . ' categories.');
    }
}
