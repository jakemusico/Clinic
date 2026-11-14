<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Model;

class ComplaintCategory extends Model
{
    use NormalizesText;

    protected array $properCaseFields = ['name'];

    protected $fillable = [
        'name',
        'type',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active'  => 'boolean',
            'sort_order' => 'integer',
        ];
    }
}
