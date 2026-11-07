<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Thrown when a stock-out or a consultation's dispensed items need more stock than is available.
 *
 * It is thrown INSIDE a database transaction, so everything already written in that request
 * (the consultation, the appointment status, earlier dispensed items) is rolled back with it.
 * Rendered as a 422 with the same `{ "message": "..." }` shape the forms already show.
 */
class InsufficientStockException extends RuntimeException
{
    /** @param string[] $errors one message per item that cannot be covered */
    public function __construct(public readonly array $errors)
    {
        parent::__construct(implode(' ', $errors));
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }
}
