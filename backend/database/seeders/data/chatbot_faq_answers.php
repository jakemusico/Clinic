<?php

/**
 * FAQ answers that depend on Admin > Clinic Info or Staff Schedules.
 *
 * Keyed by the exact FAQ question. Placeholders are replaced by the server
 * (App\Services\FaqPlaceholders) every time an answer is sent:
 *
 *   {clinic_hours} {clinic_days} {clinic_location} {clinic_hotline}
 *   {clinic_email} {nurse_schedule} {dentist_schedule}
 *
 * Used by:
 *   - php artisan chatbot:sync-faq-placeholders   (updates existing rows)
 *   - ChatbotFaqSeeder                            (fresh installs)
 *
 * FAQs that contain no clinic data (booking steps, privacy, passwords, ...)
 * are intentionally not listed here and are left untouched.
 */
return [
    // ── hours ────────────────────────────────────────────────────────────
    'What are the clinic hours?' =>
        "The clinic is open {clinic_days}, {clinic_hours}.\n\nNurse duty schedule:\n{nurse_schedule}\n\nDentist duty schedule:\n{dentist_schedule}",

    'Is the clinic open during holidays?' =>
        "The clinic is open {clinic_days}, {clinic_hours}.\n\nFor holiday or class-suspension closures, please contact the clinic via {clinic_hotline}.",

    'Where is the clinic located?' =>
        "The clinic is located at:\n{clinic_location}\n\nFor directions, please contact the clinic via {clinic_hotline}.",

    'How do I contact the clinic?' =>
        "You can reach the clinic through:\nHotline: {clinic_hotline}\nEmail: {clinic_email}\nThis chatbot — for quick FAQ answers\n\nFor in-person inquiries, visit {clinic_days}, {clinic_hours}.",

    // ── records ──────────────────────────────────────────────────────────
    'Can I request a copy of my medical records?' =>
        "Yes, you may request a physical or digital copy of your medical records. Here's how:\n1. Visit the clinic ({clinic_days}, {clinic_hours}), OR\n2. Send an email to {clinic_email} with your student/employee ID\n3. Provide your purpose/reason for the request\n\nProcessing may take 3–5 business days.",

    // ── dental ───────────────────────────────────────────────────────────
    'I have a toothache. Can I come in without an appointment?' =>
        "For severe toothache (dental emergency), yes — you may walk in to the clinic during the dentist's duty hours and you will be assessed on a priority basis.\n\nDentist duty schedule:\n{dentist_schedule}\n\nHowever, if only mild discomfort, please book an appointment through the portal to ensure the dentist is available.\n\nCall us first: {clinic_hotline}",

    // ── emergency ────────────────────────────────────────────────────────
    'What should I do in a medical emergency on campus?' =>
        "**IN CASE OF A MEDICAL EMERGENCY:**\n\n1. **Call the clinic hotline:** {clinic_hotline}\n2. **Proceed to the University Clinic** if the patient can be safely moved:\n{clinic_location}\n3. **Call 911** or go to the nearest hospital for life-threatening emergencies\n\nDo NOT delay — act fast!",

    'Where can I get first aid on campus?' =>
        "First aid is available at the University Clinic:\n{clinic_location}\nClinic days: {clinic_days}, {clinic_hours}\n\nFor serious injuries, clinic staff will assess, provide immediate care, and coordinate transport to a hospital if needed.",
];
