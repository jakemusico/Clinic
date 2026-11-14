<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    use HasFactory, NormalizesText;

    protected array $properCaseFields = ['grade_level', 'name', 'strand'];

    protected $fillable = [
        'grade_level',
        'name',
        'strand',
    ];
}
