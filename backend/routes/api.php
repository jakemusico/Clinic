<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProfilePhotoController;
use App\Http\Controllers\Api\ClinicServiceController;
use App\Http\Controllers\Api\ClinicStaffScheduleController;
use App\Http\Controllers\Api\ClinicRecordController;
use App\Http\Controllers\Api\DentalConsultationController;
use App\Http\Controllers\Api\DentalChartController;
use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ChatbotController;
use App\Http\Controllers\Api\CountersController;
use App\Http\Controllers\Api\ChatbotFaqController;
use App\Http\Controllers\Api\ChatbotCategoryController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SystemSettingsController;
use App\Http\Controllers\Api\SectionController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\CalendarEventController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ComplaintCategoryController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// ── Public Auth ─────────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('login',    [AuthController::class, 'login'])->middleware('throttle:login');
});

// ── Public Settings (terms & privacy for registration page) ─────────────
Route::get('settings/{key}', [SystemSettingsController::class, 'show']);

// ── Public Sections, Grade Levels & Roles ─────────────────────────────────
Route::get('grade-levels', [SectionController::class, 'gradeLevels']);
Route::get('sections', [SectionController::class, 'index']);
Route::get('roles', [UserController::class, 'roles']);

// ── Protected (Sanctum token required, the account must still be active, and an admin-issued
//    password must have been changed: only auth/change-password and auth/logout work until then) ──
Route::middleware(['auth:sanctum', 'active', 'password.changed'])->group(function () {

    // Auth
    Route::post('auth/logout',          [AuthController::class, 'logout']);
    Route::get('auth/me',               [AuthController::class, 'me']);
    Route::put('auth/profile',          [AuthController::class, 'updateProfile']);
    Route::post('auth/change-password', [AuthController::class, 'changePassword']);

    // Profile
    Route::get('profile',               [AuthController::class, 'getProfile']);
    Route::match(['put', 'patch'], 'profile', [AuthController::class, 'updateProfile']);
    Route::post('profile/photo',        [ProfilePhotoController::class, 'store']);
    Route::delete('profile/photo',      [ProfilePhotoController::class, 'destroy']);

    // ── Clinic Services (read: all auth users; write: clinic_staff + dentist + admin) ──
    Route::get('clinic/services', [ClinicServiceController::class, 'index']);
    Route::get('clinic/services/{clinicService}', [ClinicServiceController::class, 'show']);

    Route::middleware('role:clinic_staff,dentist,admin')->group(function () {
        Route::post  ('clinic/services',                   [ClinicServiceController::class, 'store']);
        Route::put   ('clinic/services/{clinicService}',   [ClinicServiceController::class, 'update']);
        Route::delete('clinic/services/{clinicService}',   [ClinicServiceController::class, 'destroy']);
        Route::patch ('clinic/services/{clinicService}/toggle', [ClinicServiceController::class, 'toggle']);
    });

    // ── Clinic Staff / Dentist Schedules ────────────────────────────────
    Route::middleware('role:clinic_staff,dentist,admin')->prefix('clinic/schedules')->group(function () {
        Route::get   ('unavailability',       [ClinicStaffScheduleController::class, 'listUnavailability']);
        Route::post  ('unavailability',       [ClinicStaffScheduleController::class, 'storeUnavailability']);
        Route::delete('unavailability/{staffUnavailability}', [ClinicStaffScheduleController::class, 'destroyUnavailability']);
        Route::get('slots', [ClinicStaffScheduleController::class, 'slots']);

        Route::get   ('',    [ClinicStaffScheduleController::class, 'index']);
        Route::post  ('',    [ClinicStaffScheduleController::class, 'store']);
        Route::put   ('{clinicStaffSchedule}', [ClinicStaffScheduleController::class, 'update']);
        Route::delete('{clinicStaffSchedule}', [ClinicStaffScheduleController::class, 'destroy']);
    });
    
    // ── Patient Search ──────────────────────────────────────────────────
    Route::middleware('role:clinic_staff,dentist,admin')->get('search-patients', [UserController::class, 'searchPatients']);

    // ── Medical Patient Records (Internal gating in Controller) ─────────
    Route::prefix('clinic')->group(function () {
        Route::get('records',               [ClinicRecordController::class, 'index']);
        Route::get('records/{clinicRecord}', [ClinicRecordController::class, 'show']);
        Route::post('records',              [ClinicRecordController::class, 'store']);
        Route::put('records/{clinicRecord}', [ClinicRecordController::class, 'update']);

        Route::get('patients',              [ClinicRecordController::class, 'listPatients']);
        Route::get('people',                [UserController::class, 'peopleList']);
        Route::get('people/{user}',         [UserController::class, 'personProfile']);
    });

    // ── Dental Consultations & Dental Charts ─────────────────────────────
    Route::prefix('dental')->group(function () {
        Route::get('consultations',                       [DentalConsultationController::class, 'index']);
        Route::get('consultations/{dentalConsultation}',  [DentalConsultationController::class, 'show']);
        Route::post('consultations',                      [DentalConsultationController::class, 'store']);
        Route::put('consultations/{dentalConsultation}',  [DentalConsultationController::class, 'update']);

        Route::get('chart/{patientId}',                   [DentalChartController::class, 'show']);
        Route::post('chart/{patientId}/tooth',            [DentalChartController::class, 'updateTooth']);
    });

    // ── Appointment Scheduling ──────────────────────────────────────────
    Route::get('appointments/unread-count', [AppointmentController::class, 'unreadCount']);
    Route::post('appointments/mark-read',   [AppointmentController::class, 'markAllRead']);
    Route::get('appointments',              [AppointmentController::class, 'index']);
    Route::post('appointments',             [AppointmentController::class, 'store'])->middleware('throttle:booking');
    Route::put('appointments/{appointment}/reschedule', [AppointmentController::class, 'reschedule']);
    Route::patch('appointments/{appointment}/status',   [AppointmentController::class, 'updateStatus']);
    Route::patch('appointments/{appointment}/read',     [AppointmentController::class, 'markRead']);

    // Staff lookup for booking selection
    Route::get('clinic/staff-list', [AppointmentController::class, 'listStaff']);

    // ── In-App Notifications ────────────────────────────────────────────
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('notifications/{notification}/unread', [NotificationController::class, 'markAsUnread']);
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::post('notifications/announce', [NotificationController::class, 'announce'])->middleware('throttle:announce'); // Broadcast announcements

    // ── Announcements API ────────────────────────────────────────────────
    Route::get('announcements', [AnnouncementController::class, 'index']);
    Route::post('announcements', [AnnouncementController::class, 'store']);
    Route::put('announcements/{announcement}', [AnnouncementController::class, 'update']);
    Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy']);

    // ── Slot & Date lookup for all authenticated users ───────────────────
    Route::get('appointments/available-dates', [ClinicStaffScheduleController::class, 'availableDates']);
    Route::get('appointments/slots',           [ClinicStaffScheduleController::class, 'slots']);

    // ── Complaint Categories — read by all authenticated users (consultation forms), managed by admin ──
    Route::get('complaint-categories', [ComplaintCategoryController::class, 'index']);

    // ── Chatbot — all authenticated users can chat & view FAQ list ──────
    Route::prefix('chatbot')->group(function () {
        Route::get('menu',                [ChatbotController::class,    'menu']);
        Route::get('category/{category}', [ChatbotController::class,    'category']);
        Route::post('message',            [ChatbotController::class,    'message'])->middleware('throttle:chatbot');
        Route::get('faqs',                [ChatbotFaqController::class, 'index']);
        Route::get('faqs/{chatbotFaq}',   [ChatbotFaqController::class, 'show']);

        // Categories — read by all, manage by clinic_staff, dentist + admin
        Route::get('categories', [ChatbotCategoryController::class, 'index']);

        // FAQ & Category management — clinic_staff, dentist + admin
        Route::middleware('role:clinic_staff,dentist,admin')->group(function () {
            Route::post('faqs',                      [ChatbotFaqController::class, 'store']);
            Route::put('faqs/{chatbotFaq}',          [ChatbotFaqController::class, 'update']);
            Route::delete('faqs/{chatbotFaq}',       [ChatbotFaqController::class, 'destroy']);
            Route::patch('faqs/{chatbotFaq}/toggle', [ChatbotFaqController::class, 'toggle']);
            Route::patch('faqs/{chatbotFaq}/help',   [ChatbotFaqController::class, 'toggleHelp']);

            Route::post('categories',                          [ChatbotCategoryController::class, 'store']);
            Route::put('categories/{chatbotCategory}',         [ChatbotCategoryController::class, 'update']);
            Route::delete('categories/{chatbotCategory}',      [ChatbotCategoryController::class, 'destroy']);
            Route::patch('categories/{chatbotCategory}/toggle', [ChatbotCategoryController::class, 'toggle']);
        });

        // Chatbot Support Admin Statistics — admin only
        Route::middleware('role:admin')->group(function () {
            Route::get('admin/statistics', [ChatbotController::class, 'statistics']);
        });
    });

    // ── Live Chat (Student <-> Nurse/Dentist) ───────────────────────────
    Route::prefix('chat')->group(function () {
        Route::get('status/{staff_role}',                    [ChatController::class, 'getStatus']);
        Route::post('heartbeat',                             [ChatController::class, 'heartbeat']);
        Route::get('student/conversation',                   [ChatController::class, 'getStudentConversation']);
        Route::get('student/unread-count',                   [ChatController::class, 'getStudentUnreadCount']);
        Route::post('student/read-all',                      [ChatController::class, 'markStudentAllRead']);
        Route::get('conversations',                          [ChatController::class, 'listConversations']);
        Route::get('conversations/{conversation}',           [ChatController::class, 'showConversation']);
        Route::post('conversations/{conversation}/messages', [ChatController::class, 'sendMessage'])->middleware('throttle:chat-send');
        Route::patch('conversations/{conversation}/status',  [ChatController::class, 'updateStatus']);
        Route::patch('messages/{message}',                  [ChatController::class, 'updateMessage']);
        Route::delete('messages/{message}',                 [ChatController::class, 'unsendMessage']);
        Route::get('unread-count',                           [ChatController::class, 'getUnreadCount']);
        Route::get('admin/stats',                            [ChatController::class, 'adminStats'])->middleware('role:admin');
    });

    // ── Reports — clinic_staff, dentist + admin ───────────────────────────
    Route::middleware('role:clinic_staff,dentist,admin')->group(function () {
        Route::get('reports/appointments', [ReportController::class, 'appointmentSummary']);
        Route::get('reports/consultations', [ReportController::class, 'consultationSummary']);
        Route::get('reports/inventory', [ReportController::class, 'inventorySummary']);
        Route::get('reports/frequent-symptoms', [ReportController::class, 'symptomsSummary']);
        Route::get('reports/chat', [ReportController::class, 'chatSummary']);
        Route::post('reports/log-export', [ReportController::class, 'logExport']);
    });

    // ── Inventory — clinic_staff, dentist, admin ──────────────────────────
    Route::middleware('role:clinic_staff,dentist,admin')->prefix('inventory')->group(function () {
        Route::get('dashboard',      [InventoryController::class, 'dashboard']);
        Route::get('alert-summary',  [InventoryController::class, 'alertSummary']);
        Route::get('dispensable',    [InventoryController::class, 'dispensableItems']);
        Route::get('consultation-items', [InventoryController::class, 'consultationItems']);

        // Items
        Route::get('item-options',                       [InventoryController::class, 'itemOptions']);
        Route::get('items',                              [InventoryController::class, 'itemIndex']);
        Route::post('items',                             [InventoryController::class, 'itemStore']);
        Route::put('items/{inventoryItem}',              [InventoryController::class, 'itemUpdate']);
        Route::patch('items/{inventoryItem}/toggle',     [InventoryController::class, 'itemToggle']);

        // Batches (stock in)
        Route::get('batches',  [InventoryController::class, 'batchIndex']);
        Route::post('batches', [InventoryController::class, 'batchStore']);

        // Transactions
        Route::get('transactions',  [InventoryController::class, 'transactionIndex']);
        Route::post('stock-out',    [InventoryController::class, 'stockOut']);
    });

    // ── Admin only ────────────────────────────────────────────────────────
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('roles', [UserController::class, 'roles']);
        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::put('users/{user}', [UserController::class, 'update']);
        Route::patch('users/{user}/toggle', [UserController::class, 'toggleStatus']);

        Route::get('audit-logs', [AuditLogController::class, 'index']);

        // Admin notifications target resolution
        Route::get('notifications/{notification}/target', [NotificationController::class, 'resolveTarget']);

        Route::put('settings/{key}', [SystemSettingsController::class, 'update']);
        
        // Sections
        Route::post('sections', [SectionController::class, 'store']);
        Route::put('sections/{section}', [SectionController::class, 'update']);
        Route::delete('sections/{section}', [SectionController::class, 'destroy']);

        // Complaint Categories
        Route::prefix('complaint-categories')->group(function () {
            Route::post('', [ComplaintCategoryController::class, 'store']);
            Route::post('reorder', [ComplaintCategoryController::class, 'reorder']);
            Route::put('{complaintCategory}', [ComplaintCategoryController::class, 'update']);
            Route::patch('{complaintCategory}/toggle', [ComplaintCategoryController::class, 'toggle']);
        });
    });

    // ── Dashboards ────────────────────────────────────────────────────────
    Route::get('dashboard/admin',   [DashboardController::class, 'admin'])->middleware('role:admin');
    Route::get('dashboard/nurse',   [DashboardController::class, 'nurse'])->middleware('role:clinic_staff,nurse,admin');
    Route::get('dashboard/dentist', [DashboardController::class, 'dentist'])->middleware('role:dentist,admin');
    Route::get('dashboard/student', [DashboardController::class, 'student'])->middleware('role:student,faculty_staff');

    // Header + chat-bubble badges in one request (notifications, appointment requests, chat)
    Route::get('counters', CountersController::class);
    
    // ── Calendar Events ───────────────────────────────────────────────────
    Route::get('calendar-events', [CalendarEventController::class, 'index']);
    Route::post('calendar-events', [CalendarEventController::class, 'store']);
    Route::put('calendar-events/{calendarEvent}', [CalendarEventController::class, 'update']);
    Route::delete('calendar-events/{calendarEvent}', [CalendarEventController::class, 'destroy']);
});
