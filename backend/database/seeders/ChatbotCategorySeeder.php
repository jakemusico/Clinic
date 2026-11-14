<?php

namespace Database\Seeders;

use App\Models\ChatbotCategory;
use App\Models\ChatbotFaq;
use Illuminate\Database\Seeder;

class ChatbotCategorySeeder extends Seeder
{
    /**
     * Seed the chatbot_categories table with existing FAQ categories.
     * This creates proper category records from the distinct category values in chatbot_faqs.
     */
    public function run(): void
    {
        // Define display names and default sort order for existing categories
        $categories = [
            ['name' => 'appointments', 'sort_order' => 10],
            ['name' => 'services',     'sort_order' => 20],
            ['name' => 'hours',        'sort_order' => 30],
            ['name' => 'records',      'sort_order' => 40],
            ['name' => 'requirements', 'sort_order' => 50],
            ['name' => 'general',      'sort_order' => 60],
            ['name' => 'dental',       'sort_order' => 70],
            ['name' => 'emergency',    'sort_order' => 80],
        ];

        foreach ($categories as $cat) {
            ChatbotCategory::firstOrCreate(
                ['name' => $cat['name']],
                [
                    'sort_order' => $cat['sort_order'],
                    'is_active'  => true,
                ]
            );
        }

        // Also create any categories from FAQs that aren't in the predefined list
        $faqCategories = ChatbotFaq::whereNotNull('category')
            ->distinct()
            ->pluck('category');

        foreach ($faqCategories as $name) {
            if ($name && trim($name) !== '') {
                ChatbotCategory::firstOrCreate(
                    ['name' => strtolower(trim($name))],
                    [
                        'sort_order' => 999,
                        'is_active'  => true,
                    ]
                );
            }
        }

        // Link FAQs to their category row by name (case-insensitive).
        foreach (ChatbotFaq::whereNull('category_id')->whereNotNull('category')->get() as $faq) {
            $category = ChatbotCategory::whereRaw('LOWER(name) = ?', [strtolower(trim($faq->category))])->first();
            if ($category) {
                $faq->update(['category_id' => $category->id]);
            }
        }
    }
}
