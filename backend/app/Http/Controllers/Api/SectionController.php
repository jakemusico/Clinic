<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Support\CacheVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SectionController extends Controller
{
    public function index()
    {
        // Reference data, the same for everybody: cached 10 minutes; adding, editing or deleting a section starts a new version
        $sections = Cache::remember(
            CacheVersion::key('sections', 'all'),
            600,
            fn () => Section::orderBy('grade_level')->orderBy('name')->get()->toArray()
        );

        return response()->json($sections);
    }

    public function gradeLevels()
    {
        $levels = [
            'Grade 1',
            'Grade 2',
            'Grade 3',
            'Grade 4',
            'Grade 5',
            'Grade 6',
            'Grade 7',
            'Grade 8',
            'Grade 9',
            'Grade 10',
            'Grade 11',
            'Grade 12',
        ];

        return response()->json($levels);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'grade_level' => 'required|string|max:50',
            'name' => 'required|string|max:100',
            'strand' => 'nullable|string|max:100',
        ]);
        
        $exists = Section::where('grade_level', $validated['grade_level'])->where('name', $validated['name'])->exists();
        if ($exists) {
            return response()->json(['message' => 'Section already exists for this grade level.'], 422);
        }
        
        $section = Section::create($validated);
        return response()->json($section, 201);
    }
    
    public function update(Request $request, Section $section)
    {
        $validated = $request->validate([
            'grade_level' => 'required|string|max:50',
            'name' => 'required|string|max:100',
            'strand' => 'nullable|string|max:100',
        ]);
        
        $exists = Section::where('grade_level', $validated['grade_level'])
            ->where('name', $validated['name'])
            ->where('id', '!=', $section->id)
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Section name already exists in this grade.'], 422);
        }
        
        // Handle cascading update for users
        if ($section->name !== $validated['name'] || $section->grade_level !== $validated['grade_level']) {
            \App\Models\User::where('grade_level', $section->grade_level)
                ->where('section', $section->name)
                ->update([
                    'section' => $validated['name'],
                    'grade_level' => $validated['grade_level'],
                ]);
        }
        
        $section->update($validated);
        return response()->json($section);
    }
    
    public function destroy(Section $section)
    {
        $inUse = \App\Models\User::where('grade_level', $section->grade_level)
            ->where('section', $section->name)
            ->exists();
        if ($inUse) {
            return response()->json(['message' => 'Cannot delete section because it is currently assigned to users.'], 422);
        }
        $section->delete();
        return response()->json(['message' => 'Deleted successfully.']);
    }
}
