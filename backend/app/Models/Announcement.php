<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    use HasFactory, NormalizesText;

    protected array $properCaseFields   = ['title'];
    protected array $sentenceCaseFields = ['message'];

    protected $fillable = [
        'title',
        'message',
        'audience',
        'created_by',
    ];
}
?>
