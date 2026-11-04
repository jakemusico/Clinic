<?php

namespace App\Console\Commands;

use App\Models\ChatbotFaq;
use App\Services\FaqPlaceholders;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class SyncFaqPlaceholders extends Command
{
    protected $signature = 'chatbot:sync-faq-placeholders
                            {--dry-run : Show what would change without writing anything}
                            {--restore= : Restore answers from a backup JSON file created by this command}';

    protected $description = 'Rewrite FAQ answers that hardcode clinic data so they use {placeholders} (Clinic Info / Staff Schedules)';

    public function handle(FaqPlaceholders $placeholders): int
    {
        if ($path = $this->option('restore')) {
            return $this->restore($path);
        }

        $templates = require database_path('seeders/data/chatbot_faq_answers.php');
        $dryRun    = (bool) $this->option('dry-run');

        // Safety net: never write a template that uses a token the server cannot replace.
        foreach ($templates as $question => $answer) {
            if ($bad = $placeholders->unknownTokens($answer)) {
                $this->error("Template for \"{$question}\" has unknown placeholder(s): " . implode(', ', $bad));
                return self::FAILURE;
            }
        }

        $faqs    = ChatbotFaq::all();
        $changes = [];
        $missing = [];

        foreach ($templates as $question => $answer) {
            $faq = $faqs->firstWhere('question', $question);
            if (!$faq) {
                $missing[] = $question;
                continue;
            }
            if ($faq->answer !== $answer) {
                $changes[] = [$faq, $answer];
            }
        }

        $this->info(($dryRun ? '[dry run] ' : '') . count($changes) . ' FAQ answer(s) to update, '
            . (count($templates) - count($changes) - count($missing)) . ' already up to date.');

        foreach ($missing as $q) {
            $this->warn("No FAQ found with the question: \"{$q}\" (skipped)");
        }

        foreach ($changes as [$faq, $answer]) {
            $this->line('');
            $this->line("<options=bold>#{$faq->id} [{$faq->category}] {$faq->question}</>");
            $this->line('<fg=red>- ' . str_replace("\n", "\n- ", $faq->answer) . '</>');
            $this->line('<fg=green>+ ' . str_replace("\n", "\n+ ", $answer) . '</>');
        }

        if ($dryRun || !$changes) {
            return self::SUCCESS;
        }

        // Back up EVERY FAQ before touching anything.
        $dir  = storage_path('app/faq-backups');
        File::ensureDirectoryExists($dir);
        $file = $dir . '/chatbot_faqs-' . now()->format('Ymd-His') . '.json';
        File::put($file, json_encode(
            $faqs->map(fn ($f) => ['id' => $f->id, 'question' => $f->question, 'answer' => $f->answer])->values(),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        ));

        foreach ($changes as [$faq, $answer]) {
            $faq->update(['answer' => $answer]);
        }

        $this->newLine();
        $this->info('Updated ' . count($changes) . ' FAQ answer(s).');
        $this->info('Backup: ' . $file);
        $this->line('Undo with: php artisan chatbot:sync-faq-placeholders --restore="' . $file . '"');

        return self::SUCCESS;
    }

    private function restore(string $path): int
    {
        if (!File::exists($path)) {
            $this->error("Backup file not found: {$path}");
            return self::FAILURE;
        }

        $rows = json_decode(File::get($path), true);
        if (!is_array($rows)) {
            $this->error('Backup file is not valid JSON.');
            return self::FAILURE;
        }

        $restored = 0;
        foreach ($rows as $row) {
            $faq = ChatbotFaq::find($row['id'] ?? null);
            if ($faq && $faq->answer !== $row['answer']) {
                $faq->update(['answer' => $row['answer']]);
                $restored++;
            }
        }

        $this->info("Restored {$restored} FAQ answer(s) from backup.");

        return self::SUCCESS;
    }
}
