<?php

namespace Database\Seeders;

use App\Models\ChatbotCategory;
use App\Models\ChatbotFaq;
use Illuminate\Database\Seeder;

/**
 * First-aid / symptom FAQs for the student Help Assistant.
 *
 * Idempotent: upserts by question text, so it is safe to re-run and never
 * wipes FAQs that admins have edited or added themselves (unlike
 * ChatbotFaqSeeder, which truncates).
 *
 *   php artisan db:seed --class=SymptomFirstAidSeeder
 */
class SymptomFirstAidSeeder extends Seeder
{
    private const CATEGORY = 'first-aid';

    public function run(): void
    {
        ChatbotCategory::firstOrCreate(
            ['name' => self::CATEGORY],
            ['is_active' => true, 'sort_order' => 90]
        );

        $faqs = [
            [
                'sort_order' => 1,
                'keywords'   => 'headache, head hurts, head pain, migraine, dizzy, dizziness, sore head',
                'question'   => 'I have a headache. What should I do?',
                'answer'     => "Basic Care: Rest in a quiet, dimly lit room, drink plenty of water to stay hydrated, and place a cool, damp cloth on your forehead. Avoid staring at bright screens. If the pain persists or feels severe, you can click '+ Chat with Nurse' below to talk to our clinic nurse directly, or book an appointment through the portal. (Note: The clinic does not prescribe medication via chat.)",
            ],
            [
                'sort_order' => 2,
                'keywords'   => 'toothache, tooth hurts, tooth pain, teeth, tooth, molar, gums, wisdom tooth, cavity, dental pain, dentist, dental',
                'question'   => 'My tooth hurts. What should I do?',
                'answer'     => "Basic Care: Rinse your mouth gently with warm salt water (half a teaspoon of salt in a glass of warm water) and apply a cold compress on the outside of your cheek for 15 minutes. Avoid very hot, cold, or sugary foods. You can click 'Chat with Dentist' below to talk to our campus dentist directly, or book a Dental Appointment through the portal. (Note: The clinic does not prescribe medication via chat.)",
            ],
            [
                'sort_order' => 3,
                'keywords'   => 'fever, feverish, chills, high temp, temperature, hot body, feeling hot, sick',
                'question'   => 'I have a fever. What should I do?',
                'answer'     => "Basic Care: Rest, drink plenty of water or clear fluids to prevent dehydration, wear light breathable clothing, and apply a cool compress on your forehead or take a lukewarm sponge bath. Please visit the campus clinic for a temperature check or click '+ Chat with Nurse' below to message our nurse directly. (Note: The clinic does not prescribe medication via chat.)",
            ],
            [
                'sort_order' => 4,
                'keywords'   => 'foot hurts, foot pain, ankle, sprain, twisted ankle, sore foot, leg pain, swollen foot',
                'question'   => 'My foot or ankle hurts. What should I do?',
                'answer'     => "Basic Care (R.I.C.E. Method): Rest the injured foot and avoid putting weight on it, apply an Ice pack wrapped in a cloth for 15-20 minutes, use light Compression if available, and Elevate your foot above heart level. If there is swelling or difficulty walking, visit the clinic right away or click '+ Chat with Nurse' below to talk to a nurse. (Note: The clinic does not prescribe medication via chat.)",
            ],
            [
                'sort_order' => 5,
                'keywords'   => 'stomach ache, stomach pain, stomach hurts, stomach hurt, tummy hurts, tummy pain, abdominal pain, cramps, dysmenorrhea, acid, bloated',
                'question'   => 'My stomach hurts. What should I do?',
                'answer'     => "Basic Care: Rest comfortably, sip plain water slowly, and avoid heavy, spicy, oily, or acidic foods. Placing a warm compress on your abdomen may help ease mild discomfort. If the pain persists or comes with nausea or vomiting, visit the clinic or click '+ Chat with Nurse' below to talk to our nurse. (Note: The clinic does not prescribe medication via chat.)",
            ],
            [
                'sort_order' => 6,
                'keywords'   => 'sore throat, throat hurts, cough, coughing, itchy throat, raspy voice',
                'question'   => 'I have a sore throat or cough. What should I do?',
                'answer'     => "Basic Care: Stay hydrated with warm water, gargle with warm salt water, and rest your voice. Avoid cold drinks and smoky or dusty areas. If you develop a fever or persistent cough, book a consultation or click '+ Chat with Nurse' below to message our clinic nurse. (Note: The clinic does not prescribe medication via chat.)",
            ],
            [
                'sort_order' => 7,
                'keywords'   => 'cut, scrape, wound, bleeding, bruise, abrasion, hand, finger, arm, injury, injured, bandage, skin',
                'question'   => 'I have a cut or scrape. What should I do?',
                'answer'     => "Basic Care: Wash your hands first, clean the wound gently with running water and mild soap, apply gentle pressure with a clean cloth until bleeding stops, and cover it with a clean bandage. Please visit the campus clinic so our nurses can properly sanitize and dress the wound, or click '+ Chat with Nurse' below for guidance. (Note: The clinic does not prescribe medication via chat.)",
            ],
        ];

        foreach ($faqs as $faq) {
            ChatbotFaq::updateOrCreate(
                ['question' => $faq['question']],
                [
                    'category'      => self::CATEGORY,
                    'keywords'      => $faq['keywords'],
                    'answer'        => $faq['answer'],
                    'sort_order'    => $faq['sort_order'],
                    'is_active'     => true,
                    'show_on_help'  => true,
                ]
            );
        }
    }
}
