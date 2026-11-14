<?php

namespace Tests\Unit;

use App\Support\TextNormalizer;
use PHPUnit\Framework\TestCase;

class TextNormalizerTest extends TestCase
{
    public function test_proper_case_basic(): void
    {
        $this->assertSame('Jake Musico', TextNormalizer::properCase('JAKE musico'));
        $this->assertSame('Jake Musico', TextNormalizer::properCase('jake MUSICO'));
        $this->assertSame('Jake Musico', TextNormalizer::properCase('jake musico'));
    }

    public function test_proper_case_particles(): void
    {
        $this->assertSame('Juan Dela Cruz', TextNormalizer::properCase('JUAN DELA CRUZ'));
        $this->assertSame('Maria de la Cruz', TextNormalizer::properCase('MARIA DE LA CRUZ'));
        $this->assertSame('Jose van der Berg', TextNormalizer::properCase('JOSE VAN DER BERG'));
    }

    public function test_proper_case_chain_particles(): void
    {
        // "La" capitalized when it does not continue a particle chain
        $this->assertSame('John La Salle', TextNormalizer::properCase('JOHN LA SALLE'));
        $this->assertSame('Maria de la Cruz', TextNormalizer::properCase('MARIA DE LA CRUZ'));
    }

    public function test_proper_case_suffixes_and_romans(): void
    {
        $this->assertSame('Juan Dela Cruz Jr.', TextNormalizer::properCase('JUAN DELA CRUZ JR'));
        $this->assertSame('Ana Reyes III', TextNormalizer::properCase('ANA REYES III'));
        $this->assertSame('Pedro IV', TextNormalizer::properCase('PEDRO iv'));
    }

    public function test_proper_case_prefixes_and_punctuation(): void
    {
        $this->assertSame("O'Brien", TextNormalizer::properCase("o'brien"));
        $this->assertSame('McDonald', TextNormalizer::properCase('MCDONALD'));
        $this->assertSame('MacArthur', TextNormalizer::properCase('macarthur'));
        $this->assertSame('Machado', TextNormalizer::properCase('MACHADO'));
        $this->assertSame('Mary-Ann', TextNormalizer::properCase('MARY-ANN'));
        $this->assertSame('(Jake) Musico', TextNormalizer::properCase('(JAKE) MUSICO'));
    }

    public function test_proper_case_addresses_and_misc(): void
    {
        $this->assertSame('123 Rizal St.', TextNormalizer::properCase('123 RIZAL ST.'));
        $this->assertSame('College of Engineering', TextNormalizer::properCase('COLLEGE OF ENGINEERING'));
        $this->assertSame('St. Jude', TextNormalizer::properCase('ST. JUDE'));
    }

    public function test_proper_case_idempotent_and_empty(): void
    {
        $this->assertSame('Jake Musico', TextNormalizer::properCase('Jake Musico'));
        $this->assertNull(TextNormalizer::properCase(null));
        $this->assertSame('', TextNormalizer::properCase(''));
        $this->assertSame('   ', TextNormalizer::properCase('   '));
    }

    public function test_sentence_case_basic(): void
    {
        $this->assertSame(
            'Patient reports chest pain. Prescribed paracetamol. Rest advised.',
            TextNormalizer::sentenceCase('patient reports chest pain. prescribed paracetamol. rest advised.')
        );
    }

    public function test_sentence_case_preserves_inner_casing(): void
    {
        // Does NOT lowercase the rest — iPhone, McDonald, ALL-CAPS stay as typed.
        $this->assertSame('Use iPhone for booking. Call McDonald Clinic.', TextNormalizer::sentenceCase('use iPhone for booking. call McDonald Clinic.'));
        $this->assertSame('Notes: BP was 120/80. Patient felt BETTER today.', TextNormalizer::sentenceCase('notes: BP was 120/80. patient felt BETTER today.'));
    }

    public function test_sentence_case_abbreviations(): void
    {
        $this->assertSame('Bring e.g. a valid ID. Arrive early.', TextNormalizer::sentenceCase('bring e.g. a valid ID. arrive early.'));
        $this->assertSame('Version 2.5 is out. Update now.', TextNormalizer::sentenceCase('version 2.5 is out. update now.'));
        $this->assertSame('Meet at 5 p.m. sharp.', TextNormalizer::sentenceCase('meet at 5 p.m. sharp.'));
    }

    public function test_sentence_case_exclamation_question(): void
    {
        $this->assertSame('Are you sure? Yes!', TextNormalizer::sentenceCase('are you sure? yes!'));
    }

    public function test_sentence_case_idempotent_and_empty(): void
    {
        $this->assertSame('Hello world.', TextNormalizer::sentenceCase('Hello world.'));
        $this->assertNull(TextNormalizer::sentenceCase(null));
        $this->assertSame('', TextNormalizer::sentenceCase(''));
    }
}
