<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Profile photo upload / removal for every role.
 *
 * The image is sent as a multipart file (never base64), stored on the "public"
 * disk under profile-photos/, and only its relative path is saved in users.avatar.
 */
class ProfilePhotoController extends Controller
{
    private const DIR = 'profile-photos';

    /**
     * POST /api/profile/photo   (multipart/form-data, field: photo)
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['bail', 'required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ], [
            'photo.required' => 'Please choose a photo to upload.',
            'photo.uploaded' => 'The photo could not be uploaded. Please choose a file under 2MB and try again.',
            'photo.file'     => 'Please choose a valid photo.',
            'photo.image'    => 'The file must be an image (JPG, PNG or WEBP).',
            'photo.mimes'    => 'The photo must be a JPG, PNG or WEBP image.',
            'photo.max'      => 'The photo must not be larger than 2MB.',
        ]);

        /** @var User $user */
        $user    = $request->user();
        $oldPath = $user->getRawOriginal('avatar');
        $newPath = null;

        try {
            $file = $request->file('photo');
            $ext  = strtolower($file->guessExtension() ?: $file->extension());
            $ext  = $ext === 'jpeg' ? 'jpg' : $ext;
            $name = sprintf('user%d_%s.%s', $user->id, Str::uuid(), $ext);

            $newPath = $file->storeAs(self::DIR, $name, 'public');
            if ($newPath === false) {
                throw new \RuntimeException('Storage disk refused to write the profile photo.');
            }

            $user->forceFill(['avatar' => $newPath])->save();
        } catch (Throwable $e) {
            // Don't leave an orphan file behind if the DB write failed.
            if ($newPath) {
                $this->deleteStoredFile($newPath);
            }

            Log::error('Profile photo upload failed', [
                'user_id'   => $user->id,
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'We could not save your photo right now. Please try again.',
            ], 500);
        }

        // Replace: remove the previous file only after the new one is safely saved.
        if ($oldPath && $oldPath !== $newPath) {
            $this->deleteStoredFile($oldPath);
        }

        AuditLogger::log('profile_photo_updated', User::class, $user->id, ['avatar' => $oldPath], ['avatar' => $newPath]);

        return response()->json([
            'message' => 'Profile photo updated.',
            'user'    => $user->fresh()->toApiArray(),
        ]);
    }

    /**
     * DELETE /api/profile/photo
     */
    public function destroy(Request $request): JsonResponse
    {
        /** @var User $user */
        $user    = $request->user();
        $oldPath = $user->getRawOriginal('avatar');

        try {
            $user->forceFill(['avatar' => null])->save();
        } catch (Throwable $e) {
            Log::error('Profile photo removal failed', [
                'user_id'   => $user->id,
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'We could not remove your photo right now. Please try again.',
            ], 500);
        }

        if ($oldPath) {
            $this->deleteStoredFile($oldPath);
            AuditLogger::log('profile_photo_removed', User::class, $user->id, ['avatar' => $oldPath], ['avatar' => null]);
        }

        return response()->json([
            'message' => 'Profile photo removed.',
            'user'    => $user->fresh()->toApiArray(),
        ]);
    }

    /**
     * Delete a stored photo. Only paths inside profile-photos/ are ever touched.
     */
    private function deleteStoredFile(?string $path): void
    {
        if (! $path || ! str_starts_with($path, self::DIR . '/') || str_contains($path, '..')) {
            return;
        }

        try {
            Storage::disk('public')->delete($path);
        } catch (Throwable $e) {
            Log::warning('Could not delete old profile photo file', ['path' => $path, 'exception' => $e]);
        }
    }
}
