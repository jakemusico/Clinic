<?php

namespace App\Models;

use App\Services\AuditLogger as ServiceAuditLogger;

/**
 * Backward compatibility alias / model shim for App\Services\AuditLogger.
 * Ensures any code referencing App\Models\AuditLogger resolves to the service cleanly.
 */
class AuditLogger extends ServiceAuditLogger
{
}
