<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$terms = "TERMS AND CONDITIONS

1. Acceptance of Terms
By creating an account on the FSUU Campus Clinic Portal, you confirm that you have read, understood, and agree to these Terms and Conditions and the Data Privacy Policy below.

2. Use of the Portal
The portal is intended solely for clinic-related services, including consultations, health records, and clinic announcements. You agree to provide accurate and complete information, to keep your login credentials confidential, and not to allow any other person to use your account. You are responsible for all activity carried out under your account.

3. Suspension of Accounts
The institution reserves the right to suspend or deactivate any account that contains false information or is used in violation of these terms or of institutional policies.


DATA PRIVACY POLICY

In accordance with Republic Act No. 10173, also known as the Data Privacy Act of 2012, and its Implementing Rules and Regulations, the clinic is committed to protecting the personal information entrusted to it.

1. Information We Collect
We collect your personal details (name, date of birth, sex, contact number, and address), school information (student ID, grade level, and section), the name and contact details of your parent or guardian where applicable, and health information recorded during your clinic visits.

2. Purpose of Collection
Your information is collected and processed only to provide medical and dental services, to maintain your health records, to contact you or your parent or guardian when necessary, and to support your health and well-being within the institution.

3. Access and Disclosure
Your information may be accessed only by authorized clinic personnel, namely nurses, dentists, and system administrators, who are bound by confidentiality. Your data will not be disclosed to third parties without your consent, except when required by law or in a medical emergency.

4. Storage and Security
We apply organizational, physical, and technical safeguards to protect your data against unauthorized access, alteration, disclosure, loss, or destruction.

5. Retention
Your records are kept only for as long as necessary for the purposes stated above, or as required by law and institutional policy. They are securely disposed of afterwards.

6. Your Rights
As a data subject, you have the right to be informed, to access your personal data, to object to its processing, to request correction of inaccurate data, to request its blocking or deletion, to data portability, and to be indemnified for damages arising from misuse of your data. You may also file a complaint with the National Privacy Commission.

7. Consent
By ticking the checkbox and creating an account, you give your free and informed consent to the collection and processing of your personal and health information as described in this policy.

8. Contact
For questions or requests regarding your personal data, please contact the clinic office or the institution's Data Protection Officer.";

DB::table('system_settings')->updateOrInsert(
    ['key' => 'terms_and_privacy'],
    ['value' => $terms, 'updated_at' => now()]
);

echo "Terms and privacy updated successfully.\n";
