<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
    | Web addresses (origins) of the frontend that may call this API from a browser.
    |
    | Set CORS_ALLOWED_ORIGINS in .env to a comma-separated list, e.g.
    |     CORS_ALLOWED_ORIGINS=https://clinic.example.edu.ph,https://www.clinic.example.edu.ph
    | If it is not set, FRONTEND_URL is used, and if that is not set either, the local Vite dev server
    | (http://localhost:5173), so local development needs no setting.
    | An origin is scheme + host (+ port) with no path and no trailing slash. Not needed at all when the
    | frontend and the API are served from the same address.
    */
    'allowed_origins' => array_values(array_unique(array_filter(array_map(
        fn ($origin) => rtrim(trim($origin), '/'),
        explode(',', (string) (env('CORS_ALLOWED_ORIGINS') ?: env('FRONTEND_URL') ?: 'http://localhost:5173'))
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
